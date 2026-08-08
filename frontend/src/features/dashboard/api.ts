import { get, getPaginated } from '@/lib/api/client'
import type {
  AttendanceTrendPoint,
  DashboardShift,
  DashboardSummary,
  LeaveStatistic,
  OvertimeTrendPoint,
  ShiftCoveragePoint,
} from './types'

/** `YYYY-MM-DD`, the format every report endpoint's `z.coerce.date()` accepts. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function daysAgo(days: number): string {
  return isoDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000))
}

export function daysAhead(days: number): string {
  return isoDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000))
}

export function today(): string {
  return isoDate(new Date())
}

export const dashboardApi = {
  /**
   * Requires `report:view` or `analytics:view` — see `backend/src/routes/report.routes.ts`.
   * The `employee` and `shift_coordinator` roles hold neither, so callers must
   * gate this on permission rather than catching the 403.
   */
  summary: () => get<DashboardSummary>('/reports/dashboard'),

  attendanceTrends: (dateFrom: string, dateTo: string) =>
    get<AttendanceTrendPoint[]>('/reports/attendance-trends', { params: { dateFrom, dateTo } }),

  overtimeTrends: (dateFrom: string, dateTo: string) =>
    get<OvertimeTrendPoint[]>('/reports/overtime-trends', { params: { dateFrom, dateTo } }),

  shiftCoverage: (dateFrom: string, dateTo: string) =>
    get<ShiftCoveragePoint[]>('/reports/shift-coverage', { params: { dateFrom, dateTo } }),

  leaveStatistics: (dateFrom: string, dateTo: string) =>
    get<LeaveStatistic[]>('/reports/leave-statistics', { params: { dateFrom, dateTo } }),

  /**
   * Upcoming shifts across the window. `GET /shifts` has no `employee` filter
   * (see `shiftQuerySchema`), so "my shifts" is a client-side filter over this
   * — the approach FRONTEND_SCREENS.md §6 explicitly sanctions. Sorted by date
   * ascending so the caller can take the first N without re-sorting.
   */
  upcomingShifts: (dateFrom: string, dateTo: string, limit = 100) =>
    getPaginated<DashboardShift>('/shifts', {
      params: { dateFrom, dateTo, limit, sort: 'date' },
    }),
}
