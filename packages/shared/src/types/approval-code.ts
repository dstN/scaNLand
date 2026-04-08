import type { GermanStateCode } from '../constants/german-states.js';

/**
 * A parsed and normalized approval code ready for database lookup.
 */
export interface NormalizedApprovalCode {
  /** Original raw text from OCR or user input */
  raw: string;
  /** EU country code (DE, FR, PL, etc.) */
  country?: string;
  /** German state code (NW, BY, RP) — only for DE entries */
  stateCode: string;
  /** Numeric portion, zero-padded (e.g., '50264') */
  approvalNumber: string;
  /** Normalized lookup key: stateCode + approvalNumber, no spaces (e.g., 'NW50264') */
  normalizedCode: string;
  /** Display format (e.g., 'NW 50264') */
  fullCode: string;
  /** EU suffix found (EG, CE, WE, etc.) — normalized to canonical form */
  euSuffix?: string;
  /** Confidence score from normalization (0.0 – 1.0) */
  confidence: number;
}

/**
 * A manufacturer entry from the embedded SQLite database.
 */
export interface Manufacturer {
  id: number;
  stateCode: string;
  approvalNumber: string;
  normalizedCode: string;
  fullCode: string;
  companyName: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  categories?: string[];
  restrictions?: string;
  remarks?: string;
  thirdCountryApprovals?: string;
  approvalValidUntil?: string;
  approvalSuspendedSince?: string;
}

/**
 * Result of a lookup operation.
 */
export interface LookupResult {
  /** Whether a match was found */
  matched: boolean;
  /** The matched manufacturer (if any) */
  manufacturer?: Manufacturer;
  /** The normalized code used for lookup */
  normalizedCode: NormalizedApprovalCode;
  /** Match confidence (0.0 – 1.0) */
  confidence: number;
  /** Match method used */
  matchMethod?: 'exact' | 'partial' | 'prefix' | 'levenshtein' | 'transposition';
}
