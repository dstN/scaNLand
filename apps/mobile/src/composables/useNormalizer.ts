import { EU_SUFFIX_CANONICAL, GERMAN_STATE_CODES } from '@scanland/shared';
import type { NormalizedApprovalCode } from '@scanland/shared';

/**
 * Code normalization composable — transforms raw OCR/user input into
 * a canonical format for database lookup.
 */
export function useNormalizer() {
	/**
	 * Normalize a raw text string (from OCR or manual input) into a structured approval code.
	 */
	function normalize(raw: string): NormalizedApprovalCode {
		let text = raw.trim().toUpperCase();

		// Apply OCR character corrections
		text = correctOcrChars(text);

		// Try to extract a structured code
		const extracted = extractCode(text);

		if (extracted) {
			return extracted;
		}

		// Fallback: try to parse as a simple state+number
		return parseSimpleCode(text);
	}

	/**
	 * Extract all candidate codes from a block of OCR text.
	 */
	function extractCandidates(ocrText: string): NormalizedApprovalCode[] {
		// Collapse all whitespace (newlines, tabs, multiple spaces) into single spaces.
		// Approval marks are often printed across multiple lines: "DE\nSN 016\nEG"
		const text = ocrText.toUpperCase().replace(/\s+/g, ' ').trim();
		const candidates: NormalizedApprovalCode[] = [];
		const seen = new Set<string>(); // Deduplicate

		// --- Pattern 1: Full format with country: "DE-BW 061 EG" or "DE BW 061 EG" ---
		// Handles hyphens, spaces, or no separator between country and state
		const fullPattern = /\b([A-Z]{2})[\s\-]*([A-Z]{2})\s+([\d.]{1,6})\s+([A-Z]{2,3})\b/g;
		let match: RegExpExecArray | null;

		while ((match = fullPattern.exec(text)) !== null) {
			const [, country, state, numberPart, suffix] = match;
			const isEuSuffix = suffix in EU_SUFFIX_CANONICAL;
			const isKnownState = GERMAN_STATE_CODES.includes(state as any);

			// Must have either a known state OR a known EU suffix
			if (!isKnownState && !isEuSuffix) continue;

			const cleanNum = cleanApprovalNumber(numberPart);
			if (!cleanNum || cleanNum.length < 1) continue;

			const stateCode = isKnownState ? state : country;
			const normalizedCode = `${stateCode}${cleanNum}`;

			if (seen.has(normalizedCode)) continue;
			seen.add(normalizedCode);

			candidates.push({
				raw: match[0].trim(),
				country: isKnownState ? 'DE' : country,
				stateCode,
				approvalNumber: cleanNum,
				normalizedCode,
				fullCode: `${stateCode} ${cleanNum}`,
				euSuffix: isEuSuffix ? EU_SUFFIX_CANONICAL[suffix] : undefined,
				confidence: calculateConfidence(stateCode, cleanNum, isEuSuffix),
			});
		}

		// --- Pattern 2: State + number + suffix: "BW 061 EG" (no country prefix) ---
		const statePattern = /\b([A-Z]{2})\s+([\d.]{1,6})\s+([A-Z]{2,3})\b/g;

		while ((match = statePattern.exec(text)) !== null) {
			const [, state, numberPart, suffix] = match;
			const isKnownState = GERMAN_STATE_CODES.includes(state as any);
			const isEuSuffix = suffix in EU_SUFFIX_CANONICAL;

			// Require known state code AND known EU suffix to avoid false positives
			if (!isKnownState || !isEuSuffix) continue;

			const cleanNum = cleanApprovalNumber(numberPart);
			if (!cleanNum || cleanNum.length < 1) continue;

			const normalizedCode = `${state}${cleanNum}`;

			if (seen.has(normalizedCode)) continue;
			seen.add(normalizedCode);

			candidates.push({
				raw: match[0].trim(),
				country: 'DE',
				stateCode: state,
				approvalNumber: cleanNum,
				normalizedCode,
				fullCode: `${state} ${cleanNum}`,
				euSuffix: EU_SUFFIX_CANONICAL[suffix],
				confidence: calculateConfidence(state, cleanNum, true),
			});
		}

		// --- Pattern 3: Non-German EU codes: "FR 12.345 CE", "PL 123456 WE" ---
		const euPattern = /\b([A-Z]{2})\s+([\d.]{2,7})\s+(EG|EC|CE|WE|EF|EY)\b/g;

		while ((match = euPattern.exec(text)) !== null) {
			const [, country, numberPart, suffix] = match;

			// Skip if this is a German state code (already caught above)
			if (GERMAN_STATE_CODES.includes(country as any)) continue;

			const cleanNum = cleanApprovalNumber(numberPart);
			if (!cleanNum || cleanNum.length < 2) continue;

			const normalizedCode = `${country}${cleanNum}`;

			if (seen.has(normalizedCode)) continue;
			seen.add(normalizedCode);

			candidates.push({
				raw: match[0].trim(),
				country,
				stateCode: country,
				approvalNumber: cleanNum,
				normalizedCode,
				fullCode: `${country} ${cleanNum}`,
				euSuffix: EU_SUFFIX_CANONICAL[suffix],
				confidence: 0.85, // Has EU suffix, so high confidence
			});
		}

		// Sort by confidence descending
		return candidates.sort((a, b) => b.confidence - a.confidence);
	}

	return {
		normalize,
		extractCandidates,
	};
}

// ---- Internal helpers ----

/**
 * Apply common OCR character corrections in numeric context.
 */
function correctOcrChars(text: string): string {
	// Only correct characters that are clearly in numeric positions
	// This is intentionally conservative to avoid false corrections
	return text
		.replace(/(?<=\d)[O](?=\d)/g, '0') // O between digits → 0
		.replace(/(?<=\d)[l|I](?=\d)/g, '1') // l/I between digits → 1
		.replace(/(?<=[A-Z]\s*)\d/g, (m) => m); // keep digits after letters as-is
}

/**
 * Extract a structured approval code from text.
 */
function extractCode(text: string): NormalizedApprovalCode | null {
	// Full pattern: "DE NW 50264 EG" or "NW 50264 EG" or "FR 12.345 CE"
	const fullPattern = /^([A-Z]{2})\s+([A-Z]{2})\s+([\d.\s-]+)\s+([A-Z]{2,3})$/;
	const shortPattern = /^([A-Z]{2})\s+([\d.\s-]+)\s*([A-Z]{2,3})?$/;

	let match = fullPattern.exec(text);
	if (match) {
		const [, country, state, numberPart, suffix] = match;
		const cleanNum = cleanApprovalNumber(numberPart);
		const paddedNum = cleanNum.padStart(5, '0');
		const isEuSuffix = suffix in EU_SUFFIX_CANONICAL;

		return {
			raw: text,
			country,
			stateCode: state,
			approvalNumber: paddedNum,
			normalizedCode: `${state}${paddedNum}`,
			fullCode: `${state} ${paddedNum}`,
			euSuffix: isEuSuffix ? EU_SUFFIX_CANONICAL[suffix] : suffix,
			confidence: calculateConfidence(state, cleanNum, isEuSuffix),
		};
	}

	match = shortPattern.exec(text);
	if (match) {
		const [, prefix, numberPart, suffix] = match;
		const cleanNum = cleanApprovalNumber(numberPart);
		const paddedNum = cleanNum.padStart(5, '0');
		const isEuSuffix = suffix ? suffix in EU_SUFFIX_CANONICAL : false;

		return {
			raw: text,
			country: GERMAN_STATE_CODES.includes(prefix as any) ? 'DE' : prefix,
			stateCode: prefix,
			approvalNumber: paddedNum,
			normalizedCode: `${prefix}${paddedNum}`,
			fullCode: `${prefix} ${paddedNum}`,
			euSuffix: isEuSuffix && suffix ? EU_SUFFIX_CANONICAL[suffix] : suffix,
			confidence: calculateConfidence(prefix, cleanNum, isEuSuffix),
		};
	}

	return null;
}

/**
 * Parse a simple "NW50264" or "NW 50264" code without EU suffix.
 */
function parseSimpleCode(text: string): NormalizedApprovalCode {
	const match = /^([A-Z]{2})\s*(\d+)$/.exec(text);

	if (match) {
		const [, state, number] = match;
		const padded = number.padStart(5, '0');
		return {
			raw: text,
			country: GERMAN_STATE_CODES.includes(state as any) ? 'DE' : undefined,
			stateCode: state,
			approvalNumber: padded,
			normalizedCode: `${state}${padded}`,
			fullCode: `${state} ${padded}`,
			confidence: 0.6,
		};
	}

	// Cannot parse — return low-confidence result
	return {
		raw: text,
		stateCode: '',
		approvalNumber: text.replace(/\D/g, ''),
		normalizedCode: text.replace(/[\s.\-]/g, ''),
		fullCode: text,
		confidence: 0.2,
	};
}

function cleanApprovalNumber(raw: string): string {
	return raw.replace(/[\s.\-]/g, '');
}

function calculateConfidence(stateCode: string, number: string, hasEuSuffix: boolean): number {
	let confidence = 0.5;

	// Known German state code boosts confidence
	if (GERMAN_STATE_CODES.includes(stateCode as any)) {
		confidence += 0.2;
	}

	// Reasonable number length (3-6 digits)
	if (number.length >= 3 && number.length <= 6) {
		confidence += 0.15;
	}

	// EU suffix present
	if (hasEuSuffix) {
		confidence += 0.15;
	}

	return Math.min(confidence, 1.0);
}
