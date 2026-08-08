export const PAYROLL_STATUSES = ['draft', 'finalized', 'exported'] as const
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number]

export interface PayrollInput {
  id: string
  employee: { id: string; firstName: string; lastName: string; employeeId: string } | string
  periodStart: string
  periodEnd: string
  totalHoursWorked: number
  regularHours: number
  overtimeHours: number
  nightDifferentialHours: number
  holidayHours: number
  tardinessMinutes: number
  undertimeMinutes: number
  absences: number
  status: PayrollStatus
  notes?: string
}

export interface PayrollFilters {
  employee?: string
  status?: string
  periodStart?: string
  periodEnd?: string
  page?: number
  limit?: number
}

export interface GeneratePayrollInput {
  periodStart: string
  periodEnd: string
  department?: string
}
