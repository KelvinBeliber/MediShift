import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { API_URL, server } from '@/test/server'
import { makeAuthUser, renderRoute, resetAuthStore } from '@/test/utils'
import { useAuthStore } from '@/features/auth/store'
import type { Permission } from '@/features/auth/types'
import type { PermissionKey } from '@/features/auth/permissions'
import { Dashboard } from './Dashboard'
import { selectMyShifts } from './queries'
import type { DashboardShift, OvertimeTrendPoint, ShiftCoveragePoint } from './types'

/**
 * These tests lean on `server.listen({ onUnhandledRequest: 'error' })` from
 * `test/setup.ts`: any request the dashboard fires without a matching handler
 * fails the test. That makes the permission gating directly assertable — the
 * employee cases deliberately register **no** `/reports/*` handler, so if the
 * `enabled` gate ever regresses, the test fails on the unhandled request rather
 * than quietly passing on a 403 the component swallowed.
 */

function envelope<T>(data: T, pagination?: Record<string, number>) {
  return HttpResponse.json({ success: true, message: 'ok', data, ...(pagination ? { pagination } : {}) })
}

function permissions(...keys: PermissionKey[]): Permission[] {
  return keys.map((key) => ({ key, module: key.split(':')[0]! }))
}

function signIn(keys: PermissionKey[], { withEmployee = true } = {}) {
  useAuthStore.setState({
    accessToken: 'test-token',
    isBootstrapped: true,
    user: makeAuthUser({
      role: { id: 'r1', name: 'employee', permissions: permissions(...keys) },
      ...(withEmployee
        ? {
            employee: {
              id: 'emp-1',
              employeeId: 'EMP-000001',
              firstName: 'Rosa',
              lastName: 'Delgado',
              email: 'rosa.delgado@hospital.org',
            },
          }
        : {}),
    }),
  })
}

/**
 * Handlers every role hits regardless of permission.
 *
 * `/leave` is deliberately separate: `server.use()` prepends, so the first
 * matching handler passed wins, and a generic `/leave` stub bundled in here
 * would silently shadow a test's own more specific one.
 */
function selfScopedHandlers({ unreadCount = 0 } = {}) {
  return [http.get(`${API_URL}/notifications`, () => envelope({ notifications: [], unreadCount }))]
}

function leaveHandler(requests: unknown[] = []) {
  return http.get(`${API_URL}/leave`, () =>
    envelope(requests, { page: 1, limit: 50, total: requests.length, totalPages: 1 }),
  )
}

function shiftsHandler(shifts: DashboardShift[]) {
  return http.get(`${API_URL}/shifts`, () =>
    envelope(shifts, { page: 1, limit: 100, total: shifts.length, totalPages: 1 }),
  )
}

const SUMMARY = {
  windowDays: 30,
  attendancePercent: 94.2,
  latePercent: 3.1,
  leavePercent: 2.4,
  totalOvertimeHours: 128.5,
  upcomingCoveragePercent: 87,
  openShiftsNext14Days: 6,
}

function reportHandlers(
  summary = SUMMARY,
  {
    coverage = [],
    overtime = [],
  }: { coverage?: ShiftCoveragePoint[]; overtime?: OvertimeTrendPoint[] } = {},
) {
  return [
    http.get(`${API_URL}/reports/dashboard`, () => envelope(summary)),
    http.get(`${API_URL}/reports/overtime-trends`, () => envelope(overtime)),
    http.get(`${API_URL}/reports/shift-coverage`, () => envelope(coverage)),
  ]
}

beforeEach(() => {
  resetAuthStore()
})

describe('Dashboard — role branching', () => {
  it('does not request the report endpoints for a user without report:view', async () => {
    // No /reports/* handler is registered. If the query gate regresses, MSW's
    // `onUnhandledRequest: 'error'` turns that into a failure here.
    server.use(...selfScopedHandlers(), leaveHandler(), shiftsHandler([]))
    signIn(['schedule:view', 'leave:request'])

    renderRoute(<Dashboard />)

    expect(await screen.findByText('Your work')).toBeInTheDocument()
    expect(screen.queryByText('Attendance')).not.toBeInTheDocument()
    expect(screen.queryByText('Upcoming staffing')).not.toBeInTheDocument()
    expect(screen.queryByText('Needs attention')).not.toBeInTheDocument()
  })

  it('renders the employee sections: own shifts, leave and unread count', async () => {
    server.use(
      ...selfScopedHandlers({ unreadCount: 4 }),
      leaveHandler([
        {
          id: 'lr-1',
          employee: 'emp-1',
          leaveType: 'vacation',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          totalDays: 3,
          status: 'approved',
          createdAt: new Date().toISOString(),
        },
      ]),
      shiftsHandler([
        {
          id: 'sh-1',
          date: new Date().toISOString(),
          shiftType: 'night',
          startTime: '23:00',
          endTime: '07:00',
          requiredStaff: 3,
          assignments: [{ id: 'a1', status: 'confirmed', employee: { id: 'emp-1', firstName: 'Rosa', lastName: 'Delgado', employeeId: 'EMP-000001' } }],
        },
      ]),
    )
    signIn(['schedule:view', 'leave:request'])

    renderRoute(<Dashboard />)

    // Scoped to the panel: the ShiftBand in the page header renders the same
    // 23:00–07:00 window whenever the night shift happens to be on the floor.
    const panel = await screen.findByRole('region', { name: 'Your next shifts' })
    expect(within(panel).getByText('23:00–07:00')).toBeInTheDocument()
    expect(within(panel).getByText('night')).toBeInTheDocument()
    expect(await screen.findByText('Leave taken')).toBeInTheDocument()
    expect(await screen.findByText('Unread')).toBeInTheDocument()
  })

  it('renders summary metrics and manager sections for a user with report:view', async () => {
    server.use(
      ...selfScopedHandlers(),
      shiftsHandler([]),
      ...reportHandlers(SUMMARY, {
        coverage: [
          { date: '2026-08-09', shiftCount: 3, requiredStaff: 9, assignedStaff: 6, coveragePercent: 66.67 },
          { date: '2026-08-10', shiftCount: 3, requiredStaff: 9, assignedStaff: 9, coveragePercent: 100 },
        ],
        overtime: [
          { date: '2026-07-20', overtimeHours: 4.5 },
          { date: '2026-07-21', overtimeHours: 2 },
        ],
      }),
      leaveHandler(),
    )
    signIn(['report:view', 'schedule:view'])

    renderRoute(<Dashboard />)

    expect(await screen.findByText('Upcoming staffing')).toBeInTheDocument()
    expect(await screen.findByText('Late arrivals')).toBeInTheDocument()
    expect(await screen.findByText('Short-staffed days')).toBeInTheDocument()
    // The at-risk day (6 of 9 assigned) is surfaced with its shortfall; the
    // fully-covered one is not listed at all.
    expect(await screen.findByText('3 short')).toBeInTheDocument()

    // "Attendance" and "Overtime" each name both a summary card and an
    // analytics tab, so they're asserted by role rather than by text.
    expect(await screen.findByRole('tab', { name: /Attendance/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Overtime/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Coverage/ })).toBeInTheDocument()
  })

  it('switches the analytics series when a tab is selected', async () => {
    server.use(
      ...selfScopedHandlers(),
      shiftsHandler([]),
      ...reportHandlers(SUMMARY, {
        overtime: [
          { date: '2026-07-20', overtimeHours: 4.5 },
          { date: '2026-07-21', overtimeHours: 2 },
        ],
      }),
      leaveHandler(),
    )
    signIn(['report:view', 'schedule:view'])

    const { user } = renderRoute(<Dashboard />)

    // The caption renders as `{caption} · {range}` across separate text nodes,
    // so it is matched on the element's full text rather than a single node.
    const caption = (text: string) => (_: string, el: Element | null) =>
      el?.tagName === 'P' && el.textContent?.startsWith(text) === true

    expect(await screen.findByText(caption('Daily present and late headcount'))).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Overtime/ }))
    expect(await screen.findByText(caption('Daily overtime hours'))).toBeInTheDocument()
    // 4.5 + 2, as the panel's headline figure.
    expect(screen.getByText('6.5')).toBeInTheDocument()
  })

  it('shows the approvals queue only for an approver', async () => {
    server.use(
      ...selfScopedHandlers(),
      shiftsHandler([]),
      ...reportHandlers(),
      http.get(`${API_URL}/leave`, ({ request }) => {
        const status = new URL(request.url).searchParams.get('status')
        if (status !== 'pending') return envelope([], { page: 1, limit: 50, total: 0, totalPages: 1 })
        return envelope(
          [
            {
              id: 'lr-9',
              employee: { id: 'emp-2', firstName: 'Amara', lastName: 'Okafor', employeeId: 'EMP-000002' },
              leaveType: 'sick',
              startDate: '2026-08-12',
              endDate: '2026-08-13',
              totalDays: 2,
              status: 'pending',
              createdAt: '2026-08-01',
            },
          ],
          { page: 1, limit: 5, total: 1, totalPages: 1 },
        )
      }),
    )
    signIn(['report:view', 'leave:approve', 'schedule:view'])

    renderRoute(<Dashboard />)

    expect(await screen.findByText('Waiting on you')).toBeInTheDocument()
    expect(await screen.findByText('Amara Okafor')).toBeInTheDocument()
  })

  it('surfaces the backend error message verbatim when the summary fails', async () => {
    server.use(
      ...selfScopedHandlers(),
      leaveHandler(),
      shiftsHandler([]),
      http.get(`${API_URL}/reports/dashboard`, () =>
        HttpResponse.json(
          { success: false, message: 'Insufficient permissions for this resource' },
          { status: 403 },
        ),
      ),
      http.get(`${API_URL}/reports/overtime-trends`, () => envelope([])),
      http.get(`${API_URL}/reports/shift-coverage`, () => envelope([])),
    )
    signIn(['report:view', 'schedule:view'])

    renderRoute(<Dashboard />)

    await waitFor(() =>
      expect(screen.getByText('Insufficient permissions for this resource')).toBeInTheDocument(),
    )
    expect(screen.getByText('Summary metrics could not be loaded')).toBeInTheDocument()
  })

  it('shows real empty states rather than blank panels', async () => {
    server.use(
      ...selfScopedHandlers(),
      shiftsHandler([]),
      ...reportHandlers(),
      leaveHandler(),
    )
    signIn(['report:view', 'leave:approve', 'schedule:view'])

    renderRoute(<Dashboard />)

    expect(await screen.findByText('Nothing rostered in the next 14 days')).toBeInTheDocument()
    expect(await screen.findByText('No leave requests need a decision')).toBeInTheDocument()
    expect(await screen.findByText('Every scheduled day is fully staffed')).toBeInTheDocument()
  })

  it('skips the "my shifts" query for an account with no linked employee record', async () => {
    // No /shifts handler: an account with no employee id has no shifts to fetch.
    server.use(...selfScopedHandlers(), leaveHandler())
    signIn(['schedule:view'], { withEmployee: false })

    renderRoute(<Dashboard />)

    expect(await screen.findByText('Nothing rostered in the next 14 days')).toBeInTheDocument()
  })
})

describe('selectMyShifts', () => {
  const base = { date: '2026-08-10', shiftType: 'morning' as const, startTime: '07:00', endTime: '15:00', requiredStaff: 2 }

  it('keeps shifts the employee is assigned to and drops the rest', () => {
    const shifts: DashboardShift[] = [
      { ...base, id: 'a', assignments: [{ id: '1', status: 'confirmed', employee: { id: 'emp-1', firstName: 'R', lastName: 'D', employeeId: 'E1' } }] },
      { ...base, id: 'b', assignments: [{ id: '2', status: 'confirmed', employee: { id: 'emp-2', firstName: 'A', lastName: 'O', employeeId: 'E2' } }] },
      { ...base, id: 'c', assignments: [] },
    ]

    expect(selectMyShifts(shifts, 'emp-1').map((s) => s.id)).toEqual(['a'])
  })

  it('drops declined and no-show assignments — a shift given away is not upcoming work', () => {
    const shifts: DashboardShift[] = [
      { ...base, id: 'declined', assignments: [{ id: '1', status: 'declined', employee: { id: 'emp-1', firstName: 'R', lastName: 'D', employeeId: 'E1' } }] },
      { ...base, id: 'noshow', assignments: [{ id: '2', status: 'no_show', employee: { id: 'emp-1', firstName: 'R', lastName: 'D', employeeId: 'E1' } }] },
    ]

    expect(selectMyShifts(shifts, 'emp-1')).toEqual([])
  })

  it('matches an unpopulated employee reference', () => {
    const shifts: DashboardShift[] = [
      { ...base, id: 'a', assignments: [{ id: '1', status: 'assigned', employee: 'emp-1' }] },
    ]

    expect(selectMyShifts(shifts, 'emp-1').map((s) => s.id)).toEqual(['a'])
  })

  it('returns shifts soonest first', () => {
    const shifts: DashboardShift[] = [
      { ...base, id: 'later', date: '2026-08-12', assignments: [{ id: '1', status: 'assigned', employee: 'emp-1' }] },
      { ...base, id: 'sooner', date: '2026-08-09', assignments: [{ id: '2', status: 'assigned', employee: 'emp-1' }] },
    ]

    expect(selectMyShifts(shifts, 'emp-1').map((s) => s.id)).toEqual(['sooner', 'later'])
  })
})
