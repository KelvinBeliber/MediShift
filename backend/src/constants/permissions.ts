import { ROLES } from './roles';

export const PERMISSIONS = {
  // Employees
  EMPLOYEE_VIEW: 'employee:view',
  EMPLOYEE_CREATE: 'employee:create',
  EMPLOYEE_EDIT: 'employee:edit',
  EMPLOYEE_DELETE: 'employee:delete',

  // Departments
  DEPARTMENT_VIEW: 'department:view',
  DEPARTMENT_MANAGE: 'department:manage',

  // Positions
  POSITION_VIEW: 'position:view',
  POSITION_MANAGE: 'position:manage',

  // Certifications
  CERTIFICATION_VIEW: 'certification:view',
  CERTIFICATION_MANAGE: 'certification:manage',

  // Schedules
  SCHEDULE_VIEW: 'schedule:view',
  SCHEDULE_CREATE: 'schedule:create',
  SCHEDULE_EDIT: 'schedule:edit',
  SCHEDULE_PUBLISH: 'schedule:publish',
  SCHEDULE_GENERATE: 'schedule:generate',
  SCHEDULE_DELETE: 'schedule:delete',

  // Attendance
  ATTENDANCE_VIEW: 'attendance:view',
  ATTENDANCE_MANAGE: 'attendance:manage',
  ATTENDANCE_RECORD_OWN: 'attendance:record_own',

  // Leave
  LEAVE_VIEW: 'leave:view',
  LEAVE_REQUEST: 'leave:request',
  LEAVE_APPROVE: 'leave:approve',

  // Shift swaps
  SHIFT_SWAP_VIEW: 'shift_swap:view',
  SHIFT_SWAP_REQUEST: 'shift_swap:request',
  SHIFT_SWAP_APPROVE: 'shift_swap:approve',

  // Payroll
  PAYROLL_VIEW: 'payroll:view',
  PAYROLL_MANAGE: 'payroll:manage',

  // Announcements & messaging
  ANNOUNCEMENT_VIEW: 'announcement:view',
  ANNOUNCEMENT_MANAGE: 'announcement:manage',
  MESSAGE_SEND: 'message:send',

  // Reports & analytics
  REPORT_VIEW: 'report:view',
  ANALYTICS_VIEW: 'analytics:view',

  // Admin
  ROLE_MANAGE: 'role:manage',
  USER_MANAGE: 'user:manage',
  AUDIT_LOG_VIEW: 'audit_log:view',
  SYSTEM_SETTINGS_MANAGE: 'system_settings:manage',
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionName[] = Object.values(PERMISSIONS);

// Default permission sets used when seeding roles. Actual source of truth at
// runtime is the Role/Permission collections in MongoDB (see Phase 3 seed).
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionName[]> = {
  [ROLES.SUPER_ADMIN]: ALL_PERMISSIONS,
  [ROLES.HOSPITAL_ADMIN]: ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.SYSTEM_SETTINGS_MANAGE),
  [ROLES.HR_MANAGER]: [
    PERMISSIONS.EMPLOYEE_VIEW,
    PERMISSIONS.EMPLOYEE_CREATE,
    PERMISSIONS.EMPLOYEE_EDIT,
    PERMISSIONS.EMPLOYEE_DELETE,
    PERMISSIONS.DEPARTMENT_VIEW,
    PERMISSIONS.POSITION_VIEW,
    PERMISSIONS.POSITION_MANAGE,
    PERMISSIONS.CERTIFICATION_VIEW,
    PERMISSIONS.CERTIFICATION_MANAGE,
    PERMISSIONS.LEAVE_VIEW,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MANAGE,
    PERMISSIONS.PAYROLL_VIEW,
    PERMISSIONS.PAYROLL_MANAGE,
    PERMISSIONS.ANNOUNCEMENT_VIEW,
    PERMISSIONS.ANNOUNCEMENT_MANAGE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  [ROLES.DEPARTMENT_HEAD]: [
    PERMISSIONS.EMPLOYEE_VIEW,
    PERMISSIONS.DEPARTMENT_VIEW,
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.SCHEDULE_CREATE,
    PERMISSIONS.SCHEDULE_EDIT,
    PERMISSIONS.SCHEDULE_PUBLISH,
    PERMISSIONS.SCHEDULE_GENERATE,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.LEAVE_VIEW,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.SHIFT_SWAP_VIEW,
    PERMISSIONS.SHIFT_SWAP_APPROVE,
    PERMISSIONS.ANNOUNCEMENT_VIEW,
    PERMISSIONS.ANNOUNCEMENT_MANAGE,
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.REPORT_VIEW,
  ],
  [ROLES.SHIFT_COORDINATOR]: [
    PERMISSIONS.EMPLOYEE_VIEW,
    PERMISSIONS.DEPARTMENT_VIEW,
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.SCHEDULE_CREATE,
    PERMISSIONS.SCHEDULE_EDIT,
    PERMISSIONS.SCHEDULE_GENERATE,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.SHIFT_SWAP_VIEW,
    PERMISSIONS.SHIFT_SWAP_APPROVE,
    PERMISSIONS.ANNOUNCEMENT_VIEW,
    PERMISSIONS.MESSAGE_SEND,
  ],
  // Note: LEAVE_VIEW and SHIFT_SWAP_VIEW are intentionally NOT granted here.
  // Those permissions mean "can see everyone's records, not just mine" in the
  // leave/shift-swap controllers — a base employee always sees their own
  // records regardless of permissions, via a separate code path.
  [ROLES.EMPLOYEE]: [
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.ATTENDANCE_RECORD_OWN,
    PERMISSIONS.LEAVE_REQUEST,
    PERMISSIONS.SHIFT_SWAP_REQUEST,
    PERMISSIONS.ANNOUNCEMENT_VIEW,
    PERMISSIONS.MESSAGE_SEND,
  ],
};
