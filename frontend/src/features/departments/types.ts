export const SHIFT_TYPES = [
  'morning',
  'afternoon',
  'night',
  'weekend',
  'holiday',
  'on_call',
  'overtime',
  'half_day',
] as const

/** Only these three auto-expand into shifts by the AI generator — see docs/FRONTEND_SCREENS.md > Departments. */
export const AUTO_GENERATED_SHIFT_TYPES = ['morning', 'afternoon', 'night', 'weekend'] as const

export type ShiftType = (typeof SHIFT_TYPES)[number]

export interface StaffingRequirement {
  shiftType: ShiftType
  minStaff: number
  requiredCertifications: string[]
}

export interface DepartmentEmployeeRef {
  id: string
  firstName: string
  lastName: string
  employeeId: string
  status?: string
}

export interface Department {
  id: string
  name: string
  code: string
  description?: string
  manager?: { id: string; firstName: string; lastName: string; employeeId: string } | null
  staffingRequirements: StaffingRequirement[]
  isActive: boolean
  employees?: DepartmentEmployeeRef[]
}

export interface DepartmentStats {
  department: string
  totalEmployees: number
  activeEmployees: number
  byEmploymentType: { employmentType: string; count: number }[]
  staffingRequirements: StaffingRequirement[]
}

export interface DepartmentInput {
  name: string
  code: string
  description?: string
  manager?: string
  staffingRequirements?: StaffingRequirement[]
}
