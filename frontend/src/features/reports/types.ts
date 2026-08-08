export interface AttendanceTrendPoint {
  date: string
  present: number
  late: number
  absent: number
  leave: number
  holiday: number
  overtime: number
}

export interface LeaveStatistic {
  leaveType: string
  total: number
  totalDays?: number
  byStatus: Record<string, number>
}

export interface OvertimeTrendPoint {
  date: string
  overtimeHours: number
}

export interface ShiftCoveragePoint {
  date: string
  shiftCount: number
  requiredStaff: number
  assignedStaff: number
  coveragePercent: number
}

export interface DepartmentUtilization {
  department: string
  departmentId: string
  employeeCount: number
  workedHours: number
  scheduledHours: number
  utilizationPercent: number
}

export interface ReportRangeFilters {
  dateFrom: string
  dateTo: string
  department?: string
}
