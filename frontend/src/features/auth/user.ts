import type { AuthUser } from './types'

/**
 * A name to show for the signed-in user.
 *
 * The linked Employee record (HR-managed) is authoritative when present.
 * Otherwise fall back to the name captured at registration on the `User`
 * model itself — accounts with neither (the bootstrap admin, for one) fall
 * back further to the email local-part rather than rendering an empty string.
 */
export function userDisplayName(user: AuthUser | null): string {
  if (!user) return ''

  const employee = user.employee
  if (employee) {
    const full = employee.fullName?.trim()
    if (full) return full

    const parts = [employee.firstName, employee.lastName].filter(Boolean)
    if (parts.length) return parts.join(' ')
  }

  const ownName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  if (ownName) return ownName

  return user.email.split('@')[0] ?? user.email
}

/** `hr_manager` -> `Hr manager`. Role names are snake_case on the wire. */
export function roleLabel(user: AuthUser | null): string {
  if (!user) return ''
  const spaced = user.role.name.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
