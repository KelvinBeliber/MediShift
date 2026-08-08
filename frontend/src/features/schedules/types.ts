import type { ShiftType } from '@/features/departments/types'

export const SCHEDULE_STATUSES = ['draft', 'generating', 'generated', 'published', 'archived'] as const
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number]

export const SHIFT_ASSIGNMENT_STATUSES = ['assigned', 'confirmed', 'declined', 'completed', 'no_show'] as const
export type ShiftAssignmentStatus = (typeof SHIFT_ASSIGNMENT_STATUSES)[number]

export interface ScheduleStats {
  solveTimeSeconds?: number
  objectiveValue?: number
  totalShifts?: number
  totalEmployees?: number
  totalAssignments?: number
  coveragePercent?: number
}

export interface ScheduleRef {
  id: string
  name: string
  code: string
}

export interface Schedule {
  id: string
  department: ScheduleRef | string
  month: number
  year: number
  startDate: string
  endDate: string
  status: ScheduleStatus
  notes?: string
  publishedAt?: string
  stats?: ScheduleStats
  /** Only populated by `GET /schedules/:id`. */
  shifts?: Shift[]
}

export interface EmployeeRef {
  id: string
  firstName: string
  lastName: string
  employeeId: string
}

export interface ShiftAssignment {
  id: string
  employee: EmployeeRef | string
  status: ShiftAssignmentStatus
  isAiGenerated: boolean
  notes?: string
}

export interface Shift {
  id: string
  schedule: string
  department: ScheduleRef | string
  date: string
  shiftType: ShiftType
  startTime: string
  endTime: string
  requiredStaff: number
  requiredCertifications: string[]
  notes?: string
  assignments?: ShiftAssignment[]
}

export interface ShiftGenerationWarning {
  shiftType: ShiftType
  minStaff: number
  reason: string
}

export interface ShiftGenerationByType {
  shiftType: ShiftType
  count: number
  totalStaffSlots: number
}

export interface ShiftGenerationSummary {
  scheduleId: string
  existingShiftCount: number
  hasStaffingRequirements: boolean
  proposedShiftCount: number
  proposedByType: ShiftGenerationByType[]
  totalStaffSlots: number
  dateRange: { startDate: string; endDate: string }
  warnings: ShiftGenerationWarning[]
}

export interface UnfilledShift {
  shiftId: string
  requiredStaff: number
  assignedCount: number
  shortBy: number
}

export interface GenerationResult {
  status: 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'UNKNOWN' | 'MODEL_INVALID' | string
  assignments: { shiftId: string; employeeId: string }[]
  unfilledShifts: UnfilledShift[]
  stats?: ScheduleStats
  message: string
}

export interface ScheduleListFilters {
  department?: string
  month?: number
  year?: number
  status?: string
  page?: number
  limit?: number
}

export interface CreateScheduleInput {
  department: string
  month: number
  year: number
  notes?: string
}

export interface ShiftListFilters {
  schedule?: string
  department?: string
  dateFrom?: string
  dateTo?: string
  shiftType?: string
  page?: number
  limit?: number
}

export interface ShiftInput {
  schedule: string
  department?: string
  date: string
  shiftType: ShiftType
  startTime: string
  endTime: string
  requiredStaff: number
  requiredCertifications?: string[]
  notes?: string
}
