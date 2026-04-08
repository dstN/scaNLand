import { GERMAN_STATE_CODES } from '../constants/german-states.js';
import { EU_SUFFIXES } from '../constants/eu-suffixes.js';

/**
 * Regex pattern for a German BVL approval code.
 * Format: "{STATE} {NUMBER}" e.g., "NW 50264", "BY 12345"
 * The state code is 2 uppercase letters, the number is 1-6 digits.
 */
export const GERMAN_CODE_PATTERN = /^[A-Z]{2}\s?\d{1,6}$/;

/**
 * Regex pattern for a full EU food approval mark.
 * Format: "{COUNTRY} {STATE/REGION} {NUMBER} {EU_SUFFIX}"
 * e.g., "DE NW 50264 EG", "FR 12.345 CE", "PL 123456 WE"
 */
export const EU_MARK_PATTERN = /^[A-Z]{2}\s+[A-Z]{0,3}\s*[\d.\s-]{1,8}\s*[A-Z]{2,3}$/;

/**
 * Loose pattern for extracting candidate codes from OCR text.
 * More permissive to handle OCR noise.
 */
export const OCR_CANDIDATE_PATTERN = /[A-Z]{2}\s*[A-Z]{0,3}\s*[\d.]{1,8}\s*[A-Z]{2,3}/g;

/**
 * Validate a German approval code format (state + number).
 * Accepts: "NW 50264", "NW50264", "BY 12345"
 */
export function isValidGermanCode(code: string): boolean {
  const trimmed = code.trim().toUpperCase();
  if (!GERMAN_CODE_PATTERN.test(trimmed)) return false;

  const stateCode = trimmed.substring(0, 2);
  return GERMAN_STATE_CODES.includes(stateCode as any);
}

/**
 * Validate an EU suffix.
 */
export function isValidEuSuffix(suffix: string): boolean {
  return EU_SUFFIXES.includes(suffix.toUpperCase() as any);
}

/**
 * Validate a raw approval code input (user-entered or OCR).
 * Returns an object with validity and error message.
 */
export function validateApprovalCode(input: string): { valid: boolean; error?: string } {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Approval code is required' };
  }

  if (trimmed.length < 3) {
    return { valid: false, error: 'Approval code is too short' };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Approval code is too long' };
  }

  // Must contain at least some digits
  if (!/\d/.test(trimmed)) {
    return { valid: false, error: 'Approval code must contain numbers' };
  }

  // Must start with letters (state/country code)
  if (!/^[A-Za-z]/.test(trimmed)) {
    return { valid: false, error: 'Approval code must start with a letter' };
  }

  return { valid: true };
}
