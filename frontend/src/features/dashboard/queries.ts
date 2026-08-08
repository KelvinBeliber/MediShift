import { useQuery } from '@tanstack/react-query'
import { useAnyPermission, useCurrentUser, usePermission } from '@/features/auth/usePermission'
import { leaveApi } from '@/features/leave/api'
import { notificationsApi } from '@/features/notifications/api'
import { dashboardApi, daysAgo, daysAhead, today } from './api'
import type { DashboardShift } from './types'

/**
 * Every query the dashboard runs, with its permission gate attached.
 *
 * ## The gates are `enabled`, not try/catch
 *
 * `GET /reports/*` is guarded by `authorizeAny(REPORT_VIEW, ANALYTICS_VIEW)`
 * server-side, and the seeded `employee` and `shift_coordinator` roles hold
 * neither (`backend/src/constants/permissions.ts` — DEFAULT_ROLE_PERMISSIONS).
 * Firing the request and handling the 403 would mean every employee's dashboard
 * opens with a guaranteed failed request in the network panel and a wasted
 * round trip, so the queries simply do not run without the permission and the
 * UI composes itself from what the user can actually reach.
 *
 * This is the pattern the remaining screens should copy: gate on `enabled`,
 * render from `usePermission`, never branch on `user.role.name`.
 *
 * ## Windows
 *
 * 30 days back matches `dashboardSummary()`'s own hardcoded window, so the
 * trend charts and the summary figures describe the same period. 14 days ahead
 * matches `openShiftsNext14Days`.
 */

const TREND_WINDOW_DAYS = 30
const UPCOMING_WINDOW_DAYS = 14

/** Trend/summary data is a rolling 30-day aggregate; it does not need re-fetching on every focus. */
const SUMMARY_STALE_MS = 5 * 60 * 1000

export function useDashboardQueries() {
  const user = useCurrentUser()
  const canViewReports = useAnyPermission(['report:view', 'analytics:view'])
  const canViewSchedule = usePermission('schedule:view')
  const canApproveLeave = usePermission('leave:approve')

  const trendFrom = daysAgo(TREND_WINDOW_DAYS)
  const trendTo = today()
  const upcomingTo = daysAhead(UPCOMING_WINDOW_DAYS)

  const summary = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: dashboardApi.summary,
    enabled: canViewReports,
    staleTime: SUMMARY_STALE_MS,
  })

  /** Daily status counts — powers the sparkline under each summary figure. */
  const attendance = useQuery({
    queryKey: ['reports', 'attendance-trends', trendFrom, trendTo],
    queryFn: () => dashboardApi.attendanceTrends(trendFrom, trendTo),
    enabled: canViewReports,
    staleTime: SUMMARY_STALE_MS,
  })

  const overtime = useQuery({
    queryKey: ['reports', 'overtime-trends', trendFrom, trendTo],
    queryFn: () => dashboardApi.overtimeTrends(trendFrom, trendTo),
    enabled: canViewReports,
    staleTime: SUMMARY_STALE_MS,
  })

  const coverage = useQuery({
    queryKey: ['reports', 'shift-coverage', trendTo, upcomingTo],
    queryFn: () => dashboardApi.shiftCoverage(trendTo, upcomingTo),
    enabled: canViewReports,
    staleTime: SUMMARY_STALE_MS,
  })

  /**
   * Pending approvals. `GET /leave` scopes itself server-side: without
   * `leave:view` the caller only ever sees their own requests, so this is
   * gated on `leave:approve` to keep it out of an employee's dashboard, where
   * "needs your approval" would be a list of their own submissions.
   */
  const pendingLeave = useQuery({
    queryKey: ['leave', { status: 'pending', scope: 'dashboard' }],
    queryFn: () => leaveApi.list({ status: 'pending', limit: 5 }),
    enabled: canApproveLeave,
  })

  /**
   * The employee's own upcoming shifts. `GET /shifts` carries no `employee`
   * filter, so the window is fetched and filtered client-side against the
   * linked employee id from `GET /auth/me`.
   *
   * Accounts with no linked Employee record (the bootstrap admin, for one)
   * have no id to match on, so the query does not run — there is no such thing
   * as "my shifts" for an account that is not an employee.
   */
  const employeeId = user?.employee?.id
  const myShifts = useQuery({
    queryKey: ['shifts', 'mine', employeeId, trendTo, upcomingTo],
    queryFn: () => dashboardApi.upcomingShifts(trendTo, upcomingTo),
    enabled: canViewSchedule && Boolean(employeeId),
    select: (page) => selectMyShifts(page.items, employeeId!),
  })

  /** Own leave requests — no permission needed, the API scopes to self. */
  const myLeave = useQuery({
    queryKey: ['leave', { scope: 'mine' }],
    queryFn: () => leaveApi.list({ limit: 50 }),
  })

  const unread = useQuery({
    queryKey: ['notifications', { isRead: false }],
    queryFn: () => notificationsApi.list(false),
  })

  return {
    canViewReports,
    canViewSchedule,
    canApproveLeave,
    summary,
    attendance,
    overtime,
    coverage,
    pendingLeave,
    myShifts,
    myLeave,
    unread,
    windowDays: TREND_WINDOW_DAYS,
    upcomingWindowDays: UPCOMING_WINDOW_DAYS,
  }
}

/**
 * Shifts this employee is actually on, soonest first.
 *
 * `declined` and `no_show` assignments are dropped — a declined shift is not
 * upcoming work, and showing it under "Your next shifts" would tell someone to
 * turn up for a shift they successfully gave away.
 *
 * Exported for its own unit test: this is the one piece of real logic in the
 * employee view, and it is the piece a wrong `.id` comparison would silently
 * empty (see FRONTEND_SCREENS.md on `_id` vs `id`).
 */
export function selectMyShifts(shifts: DashboardShift[], employeeId: string): DashboardShift[] {
  return shifts
    .filter((shift) =>
      (shift.assignments ?? []).some((assignment) => {
        if (assignment.status === 'declined' || assignment.status === 'no_show') return false
        const assignee = assignment.employee
        const id = typeof assignee === 'string' ? assignee : assignee?.id
        return id === employeeId
      }),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
}
