/**
 * Screen 6 — `/dashboard`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DESIGN DECISIONS — the baseline for screens 7–25
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This screen is the first data surface in the product, so the choices below
 * are inherited everywhere else. They extend DESIGN.md ("The Ward Clock").
 *
 * ── Type scale ─────────────────────────────────────────────────────────────
 *   Hero    40px/600/-0.025em  the analytics panel's headline figure
 *   Metric  36px/600/-0.025em  the figure in a stat card
 *   Display 30px/600/-0.021em  page title, one per screen
 *   Section 20px/600/-0.016em  section headings
 *   Title   18px/600/-0.012em  panel headings
 *   Body    15px/400           prose and field values
 *   Label   14px/500           labels, buttons, links, table headers
 *   Kicker  11px/600/+0.08em   panel labels and state markers
 *
 * `Metric` and `Hero` are additions. On a metrics surface the number *is* the
 * heading, so it is allowed to outrank one — the earlier 28px figure sat so
 * close to body copy that a grid of stat cards read as paragraphs.
 *
 * ── Spacing rhythm ─────────────────────────────────────────────────────────
 * 4px base grid.
 *   Panel padding      24px (`p-6`), 28px (`sm:p-7`) on the focal panel
 *   Grid gutters       20px mobile (`gap-5`) → 24px desktop (`lg:gap-6`)
 *   Section rhythm     48px above a heading, 20px below (`mt-12 mb-5`)
 * The asymmetric section rhythm is DESIGN.md's "more space above a heading than
 * below it", so a heading binds to what it introduces. It lives in
 * `SectionHeading` so no screen re-decides it.
 *
 * ── Elevation ──────────────────────────────────────────────────────────────
 * Four levels, in `Panel`: `flat` (nested blocks), `resting` (every panel),
 * `focal` (one anchor per screen, gradient ground + deeper shadow), and
 * `interactive` (lifts 2px on hover). Shadows are navy-tinted so they read cool.
 * **Shadow carries hierarchy, never decoration** — elevation states how
 * important a panel is, and nested surfaces never stack shadows.
 *
 * ── Motion ─────────────────────────────────────────────────────────────────
 * All values in `lib/motion.ts`; nothing is typed inline.
 *   enter 220ms expo-out · exit 150ms · instant 150ms · layout 280ms
 *   stagger 40ms, capped at 6 siblings
 * Surfaces arrive, content never does. Counters animate on change, not mount.
 * Reduced motion is handled globally by `<MotionConfig reducedMotion="user">`.
 *
 * ── Component boundaries ───────────────────────────────────────────────────
 *   shadcn/ui   structural + interactive primitives: Tabs (chart series),
 *               Tooltip (metric hints), Skeleton, Badge, Avatar, Separator.
 *   Bklit UI    every chart surface, from the 48px sparkline inside a stat card
 *               to the 300px analytics panel — same renderer at both scales, so
 *               a sparkline and the chart it previews are visibly one object.
 *               Its `ChartTooltip` supplies the entire hover layer.
 *   Panel/StatCard  our surfaces, because the vendored shadcn `Card` has fixed
 *               padding and a `shadow-sm` that doesn't match our elevation set.
 *   KokonutUI   its public registry is 40 largely decorative components
 *               (`liquid-glass-card`, `beams-background`); the one idea that
 *               fitted — the concentric ring — was rebuilt on our tokens and
 *               credited in `CoverageRing.tsx`, as `kokonutui/loader.tsx` was.
 *   Motion      entrance choreography, the ring sweep, counters.
 *
 * ── Role branching ─────────────────────────────────────────────────────────
 * One route, one component, sections composed by `usePermission` — never by
 * `user.role.name`. Queries are gated with TanStack Query's `enabled`, so an
 * unpermitted section costs no request. See `queries.ts` for why that matters.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Link } from 'react-router'
import { motion } from 'motion/react'
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  ExclamationCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { ShiftBand } from '@/components/ShiftBand'
import { CoverageRing } from '@/components/dashboard-primitives/CoverageRing'
import {
  Panel,
  PANEL_PADDING_FOCAL,
  PanelLabel,
  SectionHeading,
} from '@/components/dashboard-primitives/Panel'
import { StatCard, StatCardSkeleton } from '@/components/dashboard-primitives/StatCard'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useCurrentUser } from '@/features/auth/usePermission'
import { userDisplayName } from '@/features/auth/user'
import { toApiError } from '@/lib/api/errors'
import { staggerContainer } from '@/lib/motion'
import { AnalyticsPanel } from './AnalyticsPanel'
import { EmployeeSections } from './EmployeeSections'
import { ManagerSections, PendingApprovals } from './ManagerSections'
import { useDashboardQueries } from './queries'
import type { AttendanceTrendPoint, ShiftCoveragePoint } from './types'

/** First name only — a dashboard greeting that uses a surname reads as a form letter. */
function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

/**
 * Per-day percentages for the sparklines.
 *
 * The summary endpoint gives one number per metric over the whole window; the
 * shape behind it has to be derived from the daily status counts. Days with no
 * records are skipped rather than plotted as 0% — a ward with no attendance
 * logged on a Sunday did not have 0% attendance.
 */
function toRates(points: AttendanceTrendPoint[]) {
  return points
    .map((p) => {
      const total = p.present + p.late + p.absent + p.leave + p.holiday
      if (total === 0) return null
      return {
        date: new Date(p.date),
        attendanceRate: ((p.present + p.late) / total) * 100,
        lateRate: (p.late / total) * 100,
        leaveRate: (p.leave / total) * 100,
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
}

/**
 * The error state.
 *
 * FRONTEND_STACK.md §3.1 point 4 is explicit: the backend writes actionable
 * messages and they are surfaced verbatim, not replaced by a generic toast. A
 * toast is also the wrong vessel — it disappears, and this is a whole section
 * that failed to load.
 */
function SectionError({ error, label }: { error: unknown; label: string }) {
  const apiError = toApiError(error)

  return (
    <Panel className={PANEL_PADDING_FOCAL} role="alert">
      <div className="flex gap-3">
        <ExclamationCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-destructive">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{apiError.message}</p>
        </div>
      </div>
    </Panel>
  )
}

/**
 * The coverage dial, in its own panel beside the analytics chart.
 *
 * The ring alone left a panel that was mostly ground — a dial and a caption in
 * a sea of padding next to the analytics chart's tabs and legend. The
 * required/assigned breakdown below the ring is the arithmetic the ring is
 * drawn from, made legible on its own; the status badge and the link to
 * `/schedules` (only shown when there's somewhere to go) give the panel the
 * same "figure, then what to do about it" shape as `StaffingWarnings`, its
 * detail-view counterpart in "Needs attention" above.
 */
function CoveragePanel({
  percent,
  openShifts,
  coverage,
  isLoading,
}: {
  percent: number
  openShifts: number
  coverage: ShiftCoveragePoint[]
  isLoading: boolean
}) {
  const totalRequired = coverage.reduce((sum, day) => sum + day.requiredStaff, 0)
  const totalAssigned = coverage.reduce((sum, day) => sum + day.assignedStaff, 0)
  const fullyStaffed = openShifts === 0

  return (
    <Panel className="flex flex-col p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <PanelLabel>Upcoming staffing</PanelLabel>
        {!isLoading && (
          <Badge variant={fullyStaffed ? 'success' : 'destructive'}>
            {fullyStaffed ? 'Fully staffed' : `${openShifts} open`}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center py-3">
        {isLoading ? (
          <div className="flex flex-col items-center">
            <Skeleton className="size-[168px] rounded-full" />
            <Skeleton className="mt-4 h-6 w-44" />
          </div>
        ) : (
          <CoverageRing percent={percent} openShifts={openShifts} size={168} />
        )}
      </div>

      {!isLoading && (
        <>
          <Separator />
          <div className="grid grid-cols-2 divide-x pt-4">
            <div className="text-center">
              <p className="text-xl font-bold tracking-[-0.021em] tabular-nums">{totalAssigned}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Assigned</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold tracking-[-0.021em] tabular-nums">{totalRequired}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Required</p>
            </div>
          </div>

          {!fullyStaffed && (
            <Link
              to="/schedules"
              className="group mt-4 flex items-center justify-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Open schedules
              <ArrowRightIcon
                className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          )}
        </>
      )}
    </Panel>
  )
}

export function Dashboard() {
  const user = useCurrentUser()
  const {
    canViewReports,
    canViewSchedule,
    canApproveLeave,
    canRecordAttendance,
    summary,
    attendance,
    overtime,
    coverage,
    pendingLeave,
    myShifts,
    myLeave,
    unread,
    myAttendance,
    myAttendanceToday,
    myShiftSwaps,
    myMessages,
    windowDays,
    upcomingWindowDays,
  } = useDashboardQueries()

  const greeting = user ? firstNameOf(userDisplayName(user)) : null
  const unreadMessageCount = (myMessages.data ?? []).reduce((sum, item) => sum + item.unreadCount, 0)
  const summaryData = summary.data
  const summaryWindow = summaryData?.windowDays ?? windowDays
  const rates = toRates(attendance.data ?? [])
  const overtimeSeries = (overtime.data ?? []).map((p) => ({
    date: new Date(p.date),
    overtimeHours: p.overtimeHours,
  }))

  const metricsLoading = summary.isPending || attendance.isPending

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-[1440px]">
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <header className="mb-6">
          <ShiftBand className="mb-3" />
          <h1 className="text-[1.75rem] leading-[1.15] font-bold tracking-[-0.021em]">
            {greeting ? `Good to see you, ${greeting}` : 'Dashboard'}
          </h1>
          <p className="mt-1.5 text-[0.9375rem] text-muted-foreground">
            {canViewReports
              ? `Attendance, staffing and overtime across the last ${summaryWindow} days.`
              : 'Your shifts, leave and notifications.'}
          </p>
        </header>

        {summary.isError && (
          <div className="mb-5">
            <SectionError error={summary.error} label="Summary metrics could not be loaded" />
          </div>
        )}

        {/* ── Summary metrics ─────────────────────────────────────────────────
            Permission-gated, not role-gated. `employee` and `shift_coordinator`
            hold neither `report:view` nor `analytics:view` in the seeded role
            set, so for them this block is absent and no request is made. */}
        {canViewReports && !summary.isError && (
          <motion.section
            aria-labelledby="summary-heading"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5"
          >
            <h2 id="summary-heading" className="sr-only">
              Summary metrics
            </h2>

            {metricsLoading ? (
              Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)
            ) : (
              <>
                <StatCard
                  label="Attendance"
                  value={summaryData?.attendancePercent ?? 0}
                  unit="%"
                  decimals={1}
                  icon={UserGroupIcon}
                  series={rates}
                  seriesKey="attendanceRate"
                  hint="Anyone who clocked in counts as attending, including late arrivals."
                  context={`Present or late, last ${summaryWindow} days`}
                />
                <StatCard
                  label="Late arrivals"
                  value={summaryData?.latePercent ?? 0}
                  unit="%"
                  decimals={1}
                  icon={ClockIcon}
                  tone={(summaryData?.latePercent ?? 0) > 10 ? 'attention' : 'default'}
                  series={rates}
                  seriesKey="lateRate"
                  hint="Share of all attendance records flagged late against the employee's scheduled shift."
                  context="Share of all attendance records"
                />
                <StatCard
                  label="On leave"
                  value={summaryData?.leavePercent ?? 0}
                  unit="%"
                  decimals={1}
                  icon={CalendarDaysIcon}
                  series={rates}
                  seriesKey="leaveRate"
                  context="Share of all attendance records"
                />
                <StatCard
                  label="Overtime"
                  value={summaryData?.totalOvertimeHours ?? 0}
                  unit="h"
                  decimals={1}
                  // Hours accumulated, not a direction of travel — a trend
                  // arrow here would assert a movement the figure doesn't carry.
                  icon={ClockIcon}
                  series={overtimeSeries}
                  seriesKey="overtimeHours"
                  context={`Logged across the last ${summaryWindow} days`}
                />
              </>
            )}
          </motion.section>
        )}

        {/* ── Manager / admin view: needs attention ───────────────────────────
            Actionable items (pending approvals, short-staffed days) surface
            immediately below the headline numbers, above the passive
            analytics chart — a manager's dashboard should lead with what
            needs a decision, not what's merely interesting to look at. */}
        {canViewReports && (
          <ManagerSections
            pendingRequests={pendingLeave.data?.items ?? []}
            pendingTotal={pendingLeave.data?.pagination.total ?? 0}
            pendingLoading={pendingLeave.isPending && pendingLeave.fetchStatus !== 'idle'}
            coverage={coverage.data ?? []}
            coverageLoading={coverage.isPending}
            canApproveLeave={canApproveLeave}
          />
        )}

        {/* An approver without reporting permissions still needs their queue.
            No seeded role is in that position today — every role holding
            `leave:approve` also holds `report:view` — but the permissions are
            independent and editable at runtime through the Role collection, so
            the queue hangs off the permission that governs it. */}
        {!canViewReports && canApproveLeave && (
          <section aria-labelledby="approvals-heading">
            <SectionHeading description="Leave requests waiting on a decision from you.">
              <span id="approvals-heading">Needs attention</span>
            </SectionHeading>
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
              <PendingApprovals
                requests={pendingLeave.data?.items ?? []}
                total={pendingLeave.data?.pagination.total ?? 0}
                isLoading={pendingLeave.isPending && pendingLeave.fetchStatus !== 'idle'}
              />
            </div>
          </section>
        )}

        {/* ── Analytics + coverage ────────────────────────────────────────────
            The analytical centre of the screen — informative, not actionable,
            so it now sits below "Needs attention" rather than above it. */}
        {canViewReports && !summary.isError && (
          <section aria-labelledby="analytics-heading" className="mt-5">
            <h2 id="analytics-heading" className="sr-only">
              Analytics
            </h2>
            <div className="grid gap-4 xl:grid-cols-3 xl:gap-5">
              <div className="xl:col-span-2">
                <AnalyticsPanel
                  attendance={attendance.data ?? []}
                  overtime={overtime.data ?? []}
                  coverage={coverage.data ?? []}
                  isLoading={metricsLoading || coverage.isPending}
                  windowDays={windowDays}
                  upcomingWindowDays={upcomingWindowDays}
                />
              </div>
              <CoveragePanel
                percent={summaryData?.upcomingCoveragePercent ?? 0}
                openShifts={summaryData?.openShiftsNext14Days ?? 0}
                coverage={coverage.data ?? []}
                isLoading={summary.isPending || coverage.isPending}
              />
            </div>
          </section>
        )}

        {/* ── Employee view ───────────────────────────────────────────────────
            Everyone gets this, managers included: a department head is also
            someone with shifts and leave. Last for managers/admins — it's
            their own personal shift info, less central to overseeing the
            team than the sections above; still first-and-only content for an
            employee, who never sees the two sections above it. */}
        <EmployeeSections
          shifts={myShifts.data ?? []}
          shiftsLoading={myShifts.isPending && myShifts.fetchStatus !== 'idle'}
          leave={myLeave.data?.items ?? []}
          leaveLoading={myLeave.isPending}
          unreadCount={unread.data?.unreadCount ?? 0}
          unreadLoading={unread.isPending}
          canViewSchedule={canViewSchedule}
          upcomingWindowDays={upcomingWindowDays}
          employeeId={user?.employee?.id}
          canRecordAttendance={canRecordAttendance}
          attendanceToday={myAttendanceToday.data}
          attendanceTodayLoading={myAttendanceToday.isPending && myAttendanceToday.fetchStatus !== 'idle'}
          attendanceHistory={myAttendance.data ?? []}
          attendanceHistoryLoading={myAttendance.isPending && myAttendance.fetchStatus !== 'idle'}
          shiftSwaps={myShiftSwaps.data ?? []}
          shiftSwapsLoading={myShiftSwaps.isPending && myShiftSwaps.fetchStatus !== 'idle'}
          unreadMessages={unreadMessageCount}
          unreadMessagesLoading={myMessages.isPending}
        />
      </div>
    </TooltipProvider>
  )
}

export default Dashboard
