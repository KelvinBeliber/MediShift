/**
 * Every response from the Node API uses a fixed envelope.
 * See backend/src/utils/ApiResponse.ts and backend/src/middleware/errorHandler.ts.
 */

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiSuccess<T> {
  success: true
  message: string
  data: T
  pagination?: Pagination
}

/** Shape of `details` when the backend rejects a body with Zod (HTTP 422). */
export interface FieldIssue {
  path: string
  message: string
}

export interface ApiFailure {
  success: false
  message: string
  details?: FieldIssue[] | unknown
  /** Present in non-production only. */
  stack?: string
}

/** A paginated list result, already unwrapped from the envelope. */
export interface Paginated<T> {
  items: T[]
  pagination: Pagination
}
