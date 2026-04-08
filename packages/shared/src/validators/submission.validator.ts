import type { Submission } from '../types/submission.js';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Validate a submission from the mobile app before queuing or uploading.
 */
export function validateSubmission(
  submission: Partial<Submission>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!submission.approvalCode?.trim()) {
    errors.push('Approval code is required');
  }

  // brandName or productName should ideally be provided
  if (!submission.brandName?.trim() && !submission.productName?.trim()) {
    errors.push('At least a brand name or product name is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate an image file for submission upload (client-side).
 */
export function validateImageFile(
  size: number,
  mimeType: string
): { valid: boolean; error?: string } {
  if (size > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: `Image must be smaller than ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB` };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return { valid: false, error: `Image must be JPEG, PNG, or WebP` };
  }

  return { valid: true };
}
