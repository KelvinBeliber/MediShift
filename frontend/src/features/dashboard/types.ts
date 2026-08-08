/**
 * Shapes for the dashboard's endpoints.
 *
 * Hand-written per FRONTEND_STACK.md §3.5 (no shared monorepo package), and
 * verified field-by-field against `backend/src/services/report/report.service.ts`
 * rather than inferred from the prose in API_REFERENCE.md — that table names the
 * metrics but not the keys.
 */

/**
 * `GET /reports/dashboard` — `dashboardSummary()` in report.service.ts.
 *
 * Every percentage is already rounded to two decimals server-side and is a
 * whole-number percentage (94.25 = 94.25%), not a 0–1 fraction.
 *
 * Note `attendancePercent` counts `present + late` over the window — someone
 * who clocked in late still attended. The window is 30 days, echoed back as
 * `windowDays` so the UI can label it without hardcoding the number.
 */
export interface DashboardSummary {
  windowDays: number
  attendancePercent: number
  latePercent: number
  leavePercent: number
  totalOvertimeHours: number
  /** May exceed 100 when a department is over-staffed. Defaults to 100 when nothing is scheduled. */
  upcomingCoveragePercent: number
  openShiftsNext14Days: number
}

/**
 * `GET /reports/attendance-trends` — daily status counts.
 *
 * Only statuses that occurred on a given day are non-zero; the service seeds
 * every key, so the shape is stable. Drives the sparklines under the summary
 * figures, which is why the dashboard fetches it alongside the summary.
 */
export interface AttendanceTrendPoint {
  /** `YYYY-MM-DD`. */
  date: string
  present: number
  late: number
  absent: number
  leave: number
  holiday: number
  overtime: number
}

/** `GET /reports/overtime-trends` — one row per day that had any overtime at all. */
export interface OvertimeTrendPoint {
  /** `YYYY-MM-DD`. */
  date: string
  overtimeHours: number
}

/** `GET /reports/shift-coverage` — one row per day that has shifts. */
export interface ShiftCoveragePoint {
  /** `YYYY-MM-DD`. */
  date: string
  shiftCount: number
  requiredStaff: number
  assignedStaff: number
  coveragePercent: number
}

/** `GET /reports/leave-statistics` — grouped by leave type, then by status. */
export interface LeaveStatistic {
  leaveType: string
  total: number
  byStatus: Record<string, number>
}

/**
 * A shift as `GET /shifts` returns it, with `assignments[]` populated.
 *
 * Only the fields the dashboard reads are typed. `assignments[].employee` is
 * populated with `firstName lastName employeeId` — see `shift.service.ts`'s
 * `listShifts` populate chain.
 */
export interface DashboardShift {
  id: string
  date: string
  shiftType: 'morning' | 'afternoon' | 'night' | 'weekend' | 'holiday' | 'on_call' | 'overtime' | 'half_day'
  startTime: string
  endTime: string
  requiredStaff: number
  department?: { id: string; name: string; code: string } | string | null
  assignments?: {
    id: string
    status: 'assigned' | 'confirmed' | 'declined' | 'completed' | 'no_show'
    employee?: { id: string; firstName: string; lastName: string; employeeId: string } | string
  }[]
}
