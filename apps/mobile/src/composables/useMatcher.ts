import { ref } from 'vue';
import type { NormalizedApprovalCode, Manufacturer, LookupResult } from '@scanland/shared';
import { useDatabase } from './useDatabase';

/**
 * Matcher composable — performs multi-strategy matching against the database.
 *
 * Matching chain:
 * 1. Exact match on normalized_code
 * 2. Partial match on approval_number
 * 3. Levenshtein distance (≤ 2)
 * 4. Digit transposition detection
 */
export function useMatcher() {
  const { lookupByNormalizedCode, lookupByApprovalNumber, fuzzyLookup } = useDatabase();
  const isSearching = ref(false);

  async function match(code: NormalizedApprovalCode): Promise<LookupResult> {
    isSearching.value = true;
    try {
      // Strategy 1: Exact match on normalized_code (e.g. "BW00061")
      const exact = await lookupByNormalizedCode(code.normalizedCode);
      if (exact) {
        return {
          matched: true,
          manufacturer: exact,
          normalizedCode: code,
          confidence: Math.max(code.confidence, 0.95),
          matchMethod: 'exact',
        };
      }

      // Strategy 2: Prefix match within same state
      // If exact match failed, the scanned number might be a prefix of the DB number
      if (code.stateCode) {
        const num = code.approvalNumber;
        if (num.length >= 2) {
          const prefixResults = await fuzzyLookup(
            `${code.stateCode}${num}`,
            num,
            code.stateCode,
            'prefix'
          );
          if (prefixResults.length === 1) {
            return {
              matched: true,
              manufacturer: prefixResults[0],
              normalizedCode: code,
              confidence: 0.85,
              matchMethod: 'prefix',
            };
          }
          // If multiple prefix matches in same state, return them but lower confidence
          if (prefixResults.length > 1) {
            return {
              matched: true,
              manufacturer: prefixResults[0],
              normalizedCode: code,
              confidence: 0.6,
              matchMethod: 'prefix',
            };
          }
        }
      }

      // Strategy 3: Match by approval number within the SAME state
      if (code.stateCode) {
        const sameStateResults = await lookupByApprovalNumber(code.approvalNumber, code.stateCode);
        if (sameStateResults.length === 1) {
          return {
            matched: true,
            manufacturer: sameStateResults[0],
            normalizedCode: code,
            confidence: 0.8,
            matchMethod: 'partial',
          };
        }
        if (sameStateResults.length > 1) {
          return {
            matched: true,
            manufacturer: sameStateResults[0],
            normalizedCode: code,
            confidence: 0.6,
            matchMethod: 'partial',
          };
        }
      }

      // Strategy 4: Digit transposition — swap adjacent digits and retry
      const transposed = await tryTranspositions(code);
      if (transposed) {
        return {
          matched: true,
          manufacturer: transposed,
          normalizedCode: code,
          confidence: 0.7,
          matchMethod: 'transposition',
        };
      }

      // Strategy 5: Fuzzy match via LIKE — same state first
      if (code.stateCode) {
        const fuzzy = await fuzzyLookup(code.normalizedCode, code.approvalNumber, code.stateCode);
        if (fuzzy.length > 0) {
          const best = fuzzy[0];
          const distance = levenshtein(code.normalizedCode, best.normalizedCode);
          if (distance <= 2) {
            return {
              matched: true,
              manufacturer: best,
              normalizedCode: code,
              confidence: Math.max(0.5, 0.9 - distance * 0.15),
              matchMethod: 'levenshtein',
            };
          }
        }
      }

      // Strategy 6: Cross-state fuzzy as last resort (lower confidence)
      const crossStateFuzzy = await fuzzyLookup(code.normalizedCode, code.approvalNumber);
      if (crossStateFuzzy.length > 0) {
        const best = crossStateFuzzy[0];
        const distance = levenshtein(code.normalizedCode, best.normalizedCode);
        if (distance <= 2) {
          return {
            matched: true,
            manufacturer: best,
            normalizedCode: code,
            confidence: Math.max(0.4, 0.7 - distance * 0.15),
            matchMethod: 'levenshtein',
          };
        }
      }

      // No match
      return {
        matched: false,
        normalizedCode: code,
        confidence: 0,
      };
    } finally {
      isSearching.value = false;
    }
  }

  return { match, isSearching };
}

// ---- Internal helpers ----

async function tryTranspositions(code: NormalizedApprovalCode): Promise<Manufacturer | null> {
  const { lookupByNormalizedCode } = useDatabase();
  const num = code.approvalNumber;

  for (let i = 0; i < num.length - 1; i++) {
    const chars = num.split('');
    [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
    const swapped = chars.join('');
    const transposedCode = `${code.stateCode}${swapped}`;
    const result = await lookupByNormalizedCode(transposedCode);
    if (result) return result;
  }

  return null;
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}
