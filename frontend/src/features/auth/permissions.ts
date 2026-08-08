/**
 * The 36 permissions seeded by backend/src/database/seed.ts.
 *
 * Kept as a literal union so `usePermission('employe:view')` is a compile error
 * rather than a check that silently returns false forever.
 */
export const PERMISSION_KEYS = [
  'analytics:view',
  'announcement:manage',
  'announcement:view',
  'attendance:manage',
  'attendance:record_own',
  'attendance:view',
  'audit_log:view',
  'certification:manage',
  'certification:view',
  'department:manage',
  'department:view',
  'employee:create',
  'employee:delete',
  'employee:edit',
  'employee:view',
  'leave:approve',
  'leave:request',
  'leave:view',
  'message:send',
  'payroll:manage',
  'payroll:view',
  'position:manage',
  'position:view',
  'report:view',
  'role:manage',
  'schedule:create',
  'schedule:delete',
  'schedule:edit',
  'schedule:generate',
  'schedule:publish',
  'schedule:view',
  'shift_swap:approve',
  'shift_swap:request',
  'shift_swap:view',
  'system_settings:manage',
  'user:manage',
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export const ROLE_NAMES = [
  'super_admin',
  'hospital_admin',
  'hr_manager',
  'department_head',
  'shift_coordinator',
  'employee',
] as const

export type RoleName = (typeof ROLE_NAMES)[number]
