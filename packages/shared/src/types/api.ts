/**
 * API request/response types for the submission endpoints.
 */

import type { ServerSubmission, ModerationQueue, ModerationStatus } from './submission.js';

/** POST /api/submissions — create a new submission from mobile */
export interface CreateSubmissionRequest {
  approvalCode: string;
  brandName?: string;
  productName?: string;
  companyName?: string;
  address?: string;
  country?: string;
  region?: string;
  category?: string;
  ocrConfidence?: number;
  deviceFingerprint?: string;
  // Image sent as multipart form-data file field
}

export interface CreateSubmissionResponse {
  id: number;
  status: 'accepted' | 'rate_limited';
}

/** GET /api/admin/submissions — list submissions for admin */
export interface ListSubmissionsQuery {
  queue?: ModerationQueue;
  status?: ModerationStatus;
  page?: number;
  limit?: number;
  search?: string;
}

export interface ListSubmissionsResponse {
  items: ServerSubmission[];
  total: number;
  page: number;
  limit: number;
}

/** PATCH /api/admin/submissions/:id — moderate a submission */
export interface ModerateSubmissionRequest {
  action: 'approve' | 'reject' | 'edit';
  rejectionReason?: string;
  editedFields?: Partial<Pick<ServerSubmission, 'approvalCode' | 'brandName' | 'productName' | 'companyName'>>;
}

/** POST /api/auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    email: string;
    role: 'admin' | 'reviewer';
  };
}
