export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  HOSPITAL_ADMIN: 'hospital_admin',
  HR_MANAGER: 'hr_manager',
  DEPARTMENT_HEAD: 'department_head',
  SHIFT_COORDINATOR: 'shift_coordinator',
  EMPLOYEE: 'employee',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_NAMES: RoleName[] = Object.values(ROLES);
