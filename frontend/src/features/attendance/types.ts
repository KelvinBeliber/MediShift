export interface AttendanceRecord {
  id: string
  employee: { id: string; firstName: string; lastName: string; employeeId: string } | string
  shift?: string
  date: string
  clockIn?: { time: string; method: string }
  clockOut?: { time: string; method: string }
  breaks: { start: string; end?: string }[]
  status: 'present' | 'late' | 'absent' | 'leave' | 'holiday' | 'overtime'
  totalHoursWorked?: number
  overtimeHours?: number
  notes?: string
}

/** One row per employee — `GET /attendance/summary` groups by employee even when scoped to one. */
export interface AttendanceSummaryRow {
  employeeId: string
  employeeName: string
  totalHoursWorked: number
  totalOvertimeHours: number
  presentDays: number
  lateDays: number
  absentDays: number
  overtimeDays: number
  totalRecords: number
}

export interface AttendanceFilters {
  employee?: string
  dateFrom?: string
  dateTo?: string
  status?: string
  page?: number
  limit?: number
}
