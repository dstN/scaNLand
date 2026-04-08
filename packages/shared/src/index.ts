// Types
export type {
  NormalizedApprovalCode,
  Manufacturer,
  LookupResult,
  Submission,
  SubmissionStatus,
  ServerSubmission,
  ModerationStatus,
  ModerationQueue,
  CreateSubmissionRequest,
  CreateSubmissionResponse,
  ListSubmissionsQuery,
  ListSubmissionsResponse,
  ModerateSubmissionRequest,
  LoginRequest,
  LoginResponse,
} from './types/index.js';

// Constants
export {
  EU_SUFFIXES,
  EU_SUFFIX_CANONICAL,
  isEuSuffix,
  EU_COUNTRY_CODES,
  COUNTRY_NAMES,
  isEuCountryCode,
  GERMAN_STATE_CODES,
  GERMAN_STATE_NAMES,
  isGermanStateCode,
} from './constants/index.js';

export type { EuSuffix, EuCountryCode, GermanStateCode } from './constants/index.js';

// Validators
export {
  GERMAN_CODE_PATTERN,
  EU_MARK_PATTERN,
  OCR_CANDIDATE_PATTERN,
  isValidGermanCode,
  isValidEuSuffix,
  validateApprovalCode,
  validateSubmission,
  validateImageFile,
} from './validators/index.js';
