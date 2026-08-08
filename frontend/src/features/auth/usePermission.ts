import { useAuthStore } from './store'
import type { PermissionKey } from './permissions'

/**
 * Gate a UI affordance on a permission.
 *
 * Drives both nav visibility and route guards. The key is a typed union, so a
 * typo fails the build instead of silently hiding a feature forever.
 *
 *   const canEdit = usePermission('employee:edit')
 */
export function usePermission(key: PermissionKey): boolean {
  return useAuthStore((state) => (state.user?.role.permissions ?? []).some((p) => p.key === key))
}

/** True if the user holds every listed permission. */
export function usePermissions(keys: readonly PermissionKey[]): boolean {
  return useAuthStore((state) => {
    const held = state.user?.role.permissions ?? []
    return keys.every((key) => held.some((p) => p.key === key))
  })
}

/** True if the user holds at least one of the listed permissions. */
export function useAnyPermission(keys: readonly PermissionKey[]): boolean {
  return useAuthStore((state) => {
    const held = state.user?.role.permissions ?? []
    return keys.some((key) => held.some((p) => p.key === key))
  })
}

export function useCurrentUser() {
  return useAuthStore((state) => state.user)
}

export function useIsAuthenticated() {
  return useAuthStore((state) => state.accessToken !== null && state.user !== null)
}
