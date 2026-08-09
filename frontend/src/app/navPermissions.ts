import type { PermissionKey } from '@/features/auth/permissions'

/**
 * Single source of truth for "which permission(s) unlock this route" — consumed
 * by both the sidebar (AppLayout's NAV_ITEMS, for visibility) and the router
 * (RequirePermission/RequireAnyPermission guards, for access). A route missing
 * here is reachable by every authenticated role.
 *
 * Keeping these as one map is what stops nav visibility and route access from
 * silently drifting apart — e.g. a nav item that shows for a permission the
 * route guard doesn't actually accept, which is exactly what happened with
 * Reports before this existed.
 */
export const ROUTE_PERMISSIONS = {
  '/employees': ['employee:view'],
  '/departments': ['department:view'],
  '/positions': ['position:view'],
  '/certifications': ['certification:view'],
  '/schedules': ['schedule:view'],
  '/payroll': ['payroll:view'],
  '/reports': ['report:view', 'analytics:view'],
  // Same keys as Reports, deliberately: the assistant answers from the same
  // data behind the same gate, so it can never reach further than the Reports
  // screen already does. Employees and Shift Coordinators hold neither.
  '/assistant': ['report:view', 'analytics:view'],
  '/settings': ['system_settings:manage'],
  '/audit-logs': ['audit_log:view'],
} as const satisfies Record<string, readonly PermissionKey[]>

export type GatedRoute = keyof typeof ROUTE_PERMISSIONS

/** Permissions for a route not in ROUTE_PERMISSIONS — reachable by every authenticated role. */
export function routePermissions(to: string): readonly PermissionKey[] | undefined {
  return (ROUTE_PERMISSIONS as Record<string, readonly PermissionKey[] | undefined>)[to]
}
