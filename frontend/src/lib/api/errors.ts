import axios from 'axios'
import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form'
import type { ApiFailure, FieldIssue } from './types'

/**
 * A normalised API error.
 *
 * The backend deliberately writes actionable messages (e.g. "Employee does not
 * hold the certification(s) required for this shift"). `message` preserves those
 * verbatim — do not replace them with a generic string at the call site.
 */
export class ApiError extends Error {
  readonly status: number
  readonly details?: FieldIssue[] | unknown
  /** Seconds until a 429's rate-limit window resets, from the `RateLimit-Reset` header. */
  readonly retryAfterSeconds?: number

  constructor(
    message: string,
    status: number,
    details?: FieldIssue[] | unknown,
    retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
    this.retryAfterSeconds = retryAfterSeconds
  }

  /** True when the backend rejected the request body via Zod. */
  get isValidationError(): boolean {
    return this.status === 422
  }

  /** Field-level issues, if this was a 422. */
  get fieldIssues(): FieldIssue[] {
    if (!this.isValidationError || !Array.isArray(this.details)) return []
    return this.details.filter(
      (d): d is FieldIssue => typeof d === 'object' && d !== null && 'path' in d && 'message' in d,
    )
  }
}

/** Convert any thrown value into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiFailure | undefined
    const status = error.response?.status ?? 0
    // express-rate-limit's `RateLimit-Reset` is delta-seconds until the window
    // resets (draft-6), not an absolute timestamp — axios lowercases header names.
    const rawReset = error.response?.headers?.['ratelimit-reset']
    const retryAfterSeconds = status === 429 && rawReset !== undefined ? Number(rawReset) : undefined

    if (body && typeof body.message === 'string') {
      return new ApiError(body.message, status, body.details, retryAfterSeconds)
    }
    if (error.code === 'ERR_NETWORK') {
      return new ApiError('Could not reach the server. Is the API running on port 5000?', 0)
    }
    return new ApiError(error.message, status, undefined, retryAfterSeconds)
  }

  if (error instanceof Error) return new ApiError(error.message, 0)
  return new ApiError('An unexpected error occurred', 0)
}

/**
 * Map a 422's field issues onto React Hook Form.
 * Returns true if at least one issue was attached to a field, so the caller can
 * decide whether it still needs to surface a toast for the top-level message.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  const apiError = toApiError(error)
  const issues = apiError.fieldIssues
  if (issues.length === 0) return false

  for (const issue of issues) {
    setError(issue.path as FieldPath<T>, { type: 'server', message: issue.message })
  }
  return true
}
