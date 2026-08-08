import { toApiError } from '@/lib/api/errors'

/**
 * Fallback copy for a 429 with no `RateLimit-Reset` header to read (older
 * responses, or a proxy that stripped it) — the auth limiter's window is a flat
 * 15 minutes, see `authLimiter` in `backend/src/routes/auth.routes.ts`.
 */
const RATE_LIMITED_FALLBACK = 'Too many attempts. Please wait 15 minutes and try again.'

function formatRetryAfter(seconds: number): string {
  if (seconds <= 90) {
    const rounded = Math.max(1, Math.round(seconds))
    return `Too many attempts. Please try again in ${rounded} second${rounded === 1 ? '' : 's'}.`
  }
  const minutes = Math.max(1, Math.round(seconds / 60))
  return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}

/**
 * The message to show for a failed auth request.
 *
 * Everything except the rate limiter is passed through verbatim: the backend
 * deliberately writes specific, actionable copy ("This account has been
 * deactivated. Contact your administrator.") and replacing it with a generic
 * toast throws away the only useful part of the response.
 */
export function authErrorMessage(error: unknown): string {
  const { status, message, retryAfterSeconds } = toApiError(error)
  if (status !== 429) return message
  return retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds)
    ? formatRetryAfter(retryAfterSeconds)
    : RATE_LIMITED_FALLBACK
}

export { RATE_LIMITED_FALLBACK }
