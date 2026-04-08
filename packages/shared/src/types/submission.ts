/**
 * A submission from a user for a code not found in the database.
 */
export interface Submission {
  id?: number;
  approvalCode: string;
  productImagePath?: string;
  brandName?: string;
  productName?: string;
  companyName?: string;
  address?: string;
  country?: string;
  region?: string;
  category?: string;
  ocrConfidence?: number;
  status: SubmissionStatus;
  createdAt?: string;
  retryCount?: number;
  lastError?: string;
}

export type SubmissionStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

/**
 * Server-side submission with moderation state.
 */
export interface ServerSubmission extends Omit<Submission, 'status' | 'productImagePath'> {
  id: number;
  productImageUrl?: string;
  deviceFingerprint?: string;
  moderationStatus: ModerationStatus;
  moderationQueue: ModerationQueue;
  suspicionReasons: string[];
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type ModerationStatus = 'pending' | 'approved' | 'rejected';
export type ModerationQueue = 'pending' | 'review_required' | 'approved' | 'auto_rejected';
