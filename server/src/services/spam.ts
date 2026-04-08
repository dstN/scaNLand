/**
 * Basic spam analysis for submissions.
 * Flags suspicious submissions for review or auto-rejects obvious spam.
 */

interface SubmissionData {
  approvalCode: string;
  brandName?: string;
  productName?: string;
  companyName?: string;
  address?: string;
}

interface SpamResult {
  suspicious: boolean;
  autoReject: boolean;
  reasons: string[];
}

export function analyzeSubmission(data: SubmissionData): SpamResult {
  const reasons: string[] = [];

  // Check for obviously invalid approval codes
  if (data.approvalCode.length < 3) {
    reasons.push('approval_code_too_short');
  }

  if (data.approvalCode.length > 30) {
    reasons.push('approval_code_too_long');
  }

  // Check for non-alphanumeric characters (besides spaces and dots)
  if (/[^A-Za-z0-9\s.\-]/.test(data.approvalCode)) {
    reasons.push('approval_code_invalid_chars');
  }

  // Check text fields for spam patterns
  const textFields = [data.brandName, data.productName, data.companyName, data.address];
  for (const field of textFields) {
    if (!field) continue;

    // URL detection
    if (/https?:\/\/|www\./i.test(field)) {
      reasons.push('contains_url');
    }

    // Excessive length
    if (field.length > 500) {
      reasons.push('field_too_long');
    }

    // Repeated characters
    if (/(.)\1{10,}/.test(field)) {
      reasons.push('repeated_characters');
    }
  }

  const autoReject = reasons.includes('contains_url') || reasons.includes('repeated_characters');
  const suspicious = reasons.length > 0;

  return { suspicious, autoReject, reasons };
}
