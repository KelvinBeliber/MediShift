import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuthStore } from '@/features/auth/store'
import { useSessionBootstrap } from '@/features/auth/useSession'
import { useAnyPermission, usePermission } from '@/features/auth/usePermission'
import type { PermissionKey } from '@/features/auth/permissions'
import { FullPageSpinner } from '@/components/layout/FullPageSpinner'

/**
 * Blocks rendering until the cold-load session restore has settled, so an
 * authenticated user reloading a deep link isn't bounced to /login before the
 * refresh cookie has had a chance to work.
 */
export function RequireAuth() {
  const isBootstrapped = useSessionBootstrap()
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!isBootstrapped) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return <Outlet />
}

/** Keeps signed-in users off the auth screens. */
export function RequireAnonymous() {
  const isBootstrapped = useSessionBootstrap()
  const user = useAuthStore((s) => s.user)

  if (!isBootstrapped) return <FullPageSpinner />
  if (user) return <Navigate to="/dashboard" replace />

  return <Outlet />
}

/**
 * Route-level permission gate. Nav items should use `usePermission` directly to
 * hide themselves; this stops a user who types the URL anyway.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionKey
  children?: ReactNode
}) {
  const allowed = usePermission(permission)
  if (!allowed) return <Navigate to="/dashboard" replace />
  return children ? <>{children}</> : <Outlet />
}

/** Like RequirePermission, but passes if the user holds any one of several permissions. */
export function RequireAnyPermission({
  permissions,
  children,
}: {
  permissions: readonly PermissionKey[]
  children?: ReactNode
}) {
  const allowed = useAnyPermission(permissions)
  if (!allowed) return <Navigate to="/dashboard" replace />
  return children ? <>{children}</> : <Outlet />
}
