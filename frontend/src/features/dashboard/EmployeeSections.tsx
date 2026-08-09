import { useEffect, useMemo, useReducer, useState } from 'react'
import { Link } from 'react-router'
import NumberFlow, { continuous } from '@number-flow/react'
import { motion, useReducedMotion } from 'motion/react'
import {
  ArrowRightIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon as ClockIconOutline,
  InboxIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline'
import { CalendarDaysIcon, FireIcon, HandRaisedIcon, SparklesIcon } from '@heroicons/react/24/solid'
import { ConfettiBurst } from '@/components/dashboard-primitives/ConfettiBurst'
import { Panel, PANEL_PADDING, PANEL_PADDING_FOCAL, PanelLabel, SectionHeading } from '@/components/dashboard-primitives/Panel'
import { StatCard, StatCardSkeleton } from '@/components/dashboard-primitives/StatCard'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import type { AttendanceRecord } from '@/features/attendance/types'
import type { LeaveRequest } from '@/features/leave/types'
import type { ShiftSwapRequest } from '@/features/shiftSwaps/types'
import type { DashboardShift } from './types'
import {
  computeAttendanceHighlights,
  hasCleanSweep,
  hasCompletedSwap,
  streakTier,
  STREAK_TIER_ORDER,
  type StreakTier,
} from './attendanceStats'
import { staggerContainer } from '@/lib/motion'
import { cn } from '@/lib/utils'

/** The shift scale, per DESIGN.md's Shift Scale Rule. Types outside the three are neutral. */
const SHIFT_STYLE: Record<string, { dot: string; chip: string }> = {
  morning: { dot: 'bg-shift-morning', chip: 'bg-shift-morning/10 text-shift-morning' },
  afternoon: { dot: 'bg-shift-afternoon', chip: 'bg-shift-afternoon/10 text-shift-afternoon' },
  night: { dot: 'bg-shift-night', chip: 'bg-shift-night/10 text-shift-night' },
}

function shiftStyle(type: string) {
  return SHIFT_STYLE[type] ?? { dot: 'bg-muted-foreground', chip: 'bg-muted text-muted-foreground' }
}

function formatShiftDate(iso: string): { label: string; isSoon: boolean } {
  const date = new Date(iso)
  const todayKey = new Date().toDateString()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === todayKey) return { label: 'Today', isSoon: true }
  if (date.toDateString() === tomorrow.toDateString()) return { label: 'Tomorrow', isSoon: true }
  return {
    label: date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
    isSoon: false,
  }
}

/**
 * The employee's next shifts.
 *
 * The empty state names the reason rather than the absence: with no published
 * schedule there is nothing for this list to show, and "no upcoming shifts"
 * alone would read as an error to someone who is in fact rostered.
 */
export function UpcomingShifts({
  shifts,
  isLoading,
  windowDays,
  canViewSchedule,
  pendingSwapCount = 0,
}: {
  shifts: DashboardShift[]
  isLoading: boolean
  windowDays: number
  canViewSchedule: boolean
  /** Swap requests this employee raised or was targeted by that are still pending a decision. */
  pendingSwapCount?: number
}) {
  if (isLoading) {
    return (
      <Panel className={PANEL_PADDING}>
        <Skeleton className="h-6 w-36" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </Panel>
    )
  }

  return (
    <Panel className={PANEL_PADDING} role="region" aria-labelledby="upcoming-shifts-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h3
            id="upcoming-shifts-heading"
            className="text-lg leading-[1.35] font-bold tracking-[-0.012em]"
          >
            Your next shifts
          </h3>
          {shifts.length > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {shifts.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {pendingSwapCount > 0 && (
            <Link
              to="/shift-swaps"
              className="flex items-center gap-1.5 text-sm font-medium text-brand-teal-deep underline-offset-4 hover:underline"
            >
              {pendingSwapCount} pending swap{pendingSwapCount === 1 ? '' : 's'}
            </Link>
          )}
          {canViewSchedule && shifts.length > 0 && (
            <Link
              to="/schedules"
              className="group flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              All schedules
              <ArrowRightIcon
                className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          )}
        </div>
      </div>

      {shifts.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-lg border border-dashed bg-secondary/30 px-6 py-10 text-center">
          <span className="flex size-10 items-center justify-center">
            <CalendarDaysIcon className="size-7 text-muted-foreground" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-medium">
            Nothing rostered in the next {windowDays} days
          </p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Shifts appear here once your department publishes its schedule.
          </p>
        </div>
      ) : (
        <ul className="mt-2">
          {shifts.slice(0, 5).map((shift, index) => {
            const { label, isSoon } = formatShiftDate(shift.date)
            const style = shiftStyle(shift.shiftType)
            return (
              <li key={shift.id}>
                {index > 0 && <Separator />}
                <div className="flex items-center gap-3 py-2.5">
                  <span
                    className={cn(
                      'flex size-10 shrink-0 flex-col items-center justify-center rounded-lg',
                      style.chip,
                    )}
                  >
                    <span className={cn('size-2 rounded-full', style.dot)} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {label}
                      {isSoon && (
                        <Badge variant="outline" className="px-1.5 py-0 text-[0.6875rem]">
                          Soon
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-sm text-muted-foreground capitalize">
                      {shift.shiftType.replace('_', ' ')}
                      {typeof shift.department === 'object' && shift.department
                        ? ` · ${shift.department.name}`
                        : ''}
                    </p>
                  </div>
                  <time
                    className="shrink-0 text-sm font-medium tabular-nums"
                    dateTime={`${shift.date.slice(0, 10)}T${shift.startTime}`}
                  >
                    {shift.startTime}&ndash;{shift.endTime}
                  </time>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/**
 * Leave, summarised from the employee's own requests.
 *
 * ## Why this is "taken", not "balance"
 *
 * There is no leave entitlement or balance anywhere in the backend — not on the
 * Employee model, not on LeaveRequest, and no endpoint returns one. A "12 days
 * remaining" figure would have to be invented, and DESIGN.md is explicit that
 * product facts are not invented to fill a layout. This counts what the API
 * actually knows: approved days taken this calendar year, and how many requests
 * are still waiting on someone.
 */
export function LeaveSummary({
  requests,
  isLoading,
}: {
  requests: LeaveRequest[]
  isLoading: boolean
}) {
  const { approvedDays, pendingCount } = useMemo(() => {
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime()
    let days = 0
    let pending = 0

    for (const request of requests) {
      const started = new Date(request.startDate).getTime()
      if (request.status === 'approved' && started >= yearStart) days += request.totalDays
      if (request.status === 'pending' || request.status === 'department_approved') pending += 1
    }

    return { approvedDays: days, pendingCount: pending }
  }, [requests])

  if (isLoading) return <StatCardSkeleton withSeries={false} />

  return (
    <StatCard
      label="Leave taken"
      value={approvedDays}
      unit={approvedDays === 1 ? ' day' : ' days'}
      icon={PaperAirplaneIcon}
      context={
        pendingCount > 0
          ? `${pendingCount} request${pendingCount === 1 ? '' : 's'} awaiting approval`
          : `Approved so far in ${new Date().getFullYear()}`
      }
    />
  )
}

/** Unread notifications, as a figure that names what it's about. */
export function UnreadNotifications({
  count,
  isLoading,
}: {
  count: number
  isLoading: boolean
}) {
  if (isLoading) return <StatCardSkeleton withSeries={false} />

  return (
    <StatCard
      label="Unread"
      value={count}
      icon={InboxIcon}
      tone={count > 0 ? 'attention' : 'default'}
      context={count === 0 ? 'You are all caught up' : 'Schedule, leave and swap updates'}
    />
  )
}

/** Unread direct messages — a distinct figure from notifications above, from `GET /messages/conversations`. */
export function UnreadMessages({
  count,
  isLoading,
}: {
  count: number
  isLoading: boolean
}) {
  if (isLoading) return <StatCardSkeleton withSeries={false} />

  return (
    <StatCard
      label="Messages"
      value={count}
      icon={ChatBubbleLeftRightIcon}
      tone={count > 0 ? 'attention' : 'default'}
      context={count === 0 ? 'No unread messages' : 'Unread direct messages'}
    />
  )
}

/** Hours actually logged, from the employee's own attendance records — not a schedule estimate. */
export function HoursLogged({
  hours,
  isLoading,
}: {
  hours: number
  isLoading: boolean
}) {
  if (isLoading) return <StatCardSkeleton withSeries={false} />

  return (
    <StatCard
      label="Hours logged"
      value={hours}
      unit="h"
      decimals={1}
      icon={ClockIconOutline}
      context="Last 7 days"
    />
  )
}

/**
 * "Has the streak's own tier changed since we last showed this employee a
 * dashboard, and did it go up?" — the gate for the one-time confetti burst.
 *
 * Stored per employee id (never per account) because ward tablets are shared:
 * two employees signing in on the same browser must never see each other's
 * milestone replayed, or missed, on first login. A tier *drop* (a late
 * clock-in resetting the streak) still updates the stored value so the climb
 * back up can be celebrated again, it just doesn't fire the burst itself.
 */
function useStreakCelebration(employeeId: string | undefined, tier: StreakTier): boolean {
  const [celebrate, setCelebrate] = useState(false)

  useEffect(() => {
    if (!employeeId) return
    const storageKey = `medishift:streak-tier:${employeeId}`
    const lastSeen = (localStorage.getItem(storageKey) as StreakTier | null) ?? 'none'
    if (tier === lastSeen) return

    localStorage.setItem(storageKey, tier)
    if (STREAK_TIER_ORDER.indexOf(tier) <= STREAK_TIER_ORDER.indexOf(lastSeen)) return

    setCelebrate(true)
    const timeout = setTimeout(() => setCelebrate(false), 900)
    return () => clearTimeout(timeout)
  }, [employeeId, tier])

  return celebrate
}

/** Re-renders once a minute so "clocked in at 07:02 · Nh so far" keeps counting up without a reload. */
function useMinuteTick(): void {
  const [, tick] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const timer = setInterval(tick, 60_000)
    return () => clearInterval(timer)
  }, [])
}

function describeToday(record: AttendanceRecord | null | undefined, now: Date): { label: string; detail?: string } {
  if (!record?.clockIn) return { label: 'Not clocked in yet' }

  if (record.clockOut) {
    return { label: 'Clocked out', detail: `${(record.totalHoursWorked ?? 0).toFixed(1)}h logged today` }
  }

  const clockInTime = new Date(record.clockIn.time)
  const clockInLabel = clockInTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const onBreak = record.breaks.some((b) => !b.end)
  if (onBreak) return { label: 'On break', detail: `Clocked in at ${clockInLabel}` }

  const hoursSoFar = Math.max(0, (now.getTime() - clockInTime.getTime()) / 3_600_000)
  return { label: `Clocked in at ${clockInLabel}`, detail: `${hoursSoFar.toFixed(1)}h so far` }
}

function streakSubtitle(
  highlights: ReturnType<typeof computeAttendanceHighlights>,
  tier: StreakTier,
): string {
  if (highlights.totalRecords === 0) return 'Clock in to start your streak.'
  if (highlights.onTimeStreak === 0) {
    return highlights.brokenBy === 'absent'
      ? 'Marked absent last time — a new streak starts your next shift.'
      : 'Late last time — a new streak starts your next shift.'
  }
  const base = `On time for your last ${highlights.onTimeStreak} shift${highlights.onTimeStreak === 1 ? '' : 's'}`
  const tierLabel = tier === 'gold' ? 'Gold' : tier === 'silver' ? 'Silver' : tier === 'bronze' ? 'Bronze' : null
  return tierLabel ? `${base} · ${tierLabel} tier` : base
}

function StreakSpotlightSkeleton() {
  return (
    <Panel elevation="focal" className={cn(PANEL_PADDING_FOCAL, 'mb-4 lg:mb-5')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-end gap-3">
          <Skeleton className="size-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="space-y-2 text-right">
          <Skeleton className="ml-auto h-3 w-12" />
          <Skeleton className="ml-auto h-4 w-36" />
        </div>
      </div>
    </Panel>
  )
}

/**
 * The one focal, expressive panel on the employee dashboard: a real on-time
 * streak (from `GET /attendance/mine`) and today's live clock status
 * (`GET /attendance/today`), plus any badges the employee has actually
 * earned. Every figure here is arithmetic over real records — see
 * `attendanceStats.ts` — never an invented target or a locked/wishlist item.
 *
 * This is where DESIGN.md's usual restraint is deliberately spent: one
 * amber accent (`--color-achievement-amber`, scoped to earned moments only)
 * and one celebratory burst when the streak's tier goes up. Everything else
 * on the page stays inside the navy/green/teal system.
 */
function StreakSpotlight({
  today: todayRecord,
  todayLoading,
  canRecordAttendance,
  highlights,
  historyLoading,
  swaps,
  employeeId,
}: {
  today: AttendanceRecord | null | undefined
  todayLoading: boolean
  /** Whether this account can clock in at all — see `queries.ts`'s `canRecordAttendance`. */
  canRecordAttendance: boolean
  highlights: ReturnType<typeof computeAttendanceHighlights>
  historyLoading: boolean
  swaps: ShiftSwapRequest[]
  employeeId?: string
}) {
  useMinuteTick()
  const prefersReducedMotion = useReducedMotion()

  const tier = streakTier(highlights.onTimeStreak)
  const celebrate = useStreakCelebration(employeeId, tier)
  const cleanSweep = hasCleanSweep(highlights)
  const teamPlayer = hasCompletedSwap(swaps)
  const hasBadges = cleanSweep || teamPlayer

  if (historyLoading || (canRecordAttendance && todayLoading)) return <StreakSpotlightSkeleton />

  const todayStatus = canRecordAttendance ? describeToday(todayRecord, new Date()) : null
  const subtitle = streakSubtitle(highlights, tier)
  const flameTint =
    tier === 'none'
      ? 'bg-muted text-muted-foreground'
      : 'bg-achievement-amber/12 text-achievement-amber-deep'

  return (
    <Panel
      elevation="focal"
      className={cn(PANEL_PADDING_FOCAL, 'relative mb-4 overflow-hidden lg:mb-5')}
      role="region"
      aria-labelledby="streak-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <PanelLabel>
            <span id="streak-heading">Your streak</span>
          </PanelLabel>
          <div className="mt-2.5 flex items-end gap-3.5">
            <span className={cn('relative flex size-14 shrink-0 items-center justify-center rounded-2xl', flameTint)}>
              <FireIcon className="size-7" aria-hidden="true" />
              {celebrate && !prefersReducedMotion && <ConfettiBurst />}
            </span>
            <div>
              <p className="flex items-baseline gap-1.5">
                <NumberFlow
                  value={highlights.onTimeStreak}
                  plugins={[continuous]}
                  className="text-[2rem] leading-none font-bold tracking-[-0.025em] tabular-nums"
                  aria-hidden="true"
                />
                <span className="sr-only">{highlights.onTimeStreak}</span>
                <span className="text-sm font-medium text-muted-foreground">
                  day{highlights.onTimeStreak === 1 ? '' : 's'}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </div>

        {todayStatus && (
          <div className="text-right">
            <PanelLabel>Today</PanelLabel>
            <p className="mt-2.5 text-sm font-semibold">{todayStatus.label}</p>
            {todayStatus.detail && (
              <p className="text-sm text-muted-foreground tabular-nums">{todayStatus.detail}</p>
            )}
          </div>
        )}
      </div>

      {hasBadges && (
        <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
          {cleanSweep && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-achievement-amber/12 px-2.5 py-1.5 text-xs font-semibold text-achievement-amber-deep">
              <SparklesIcon className="size-3.5" aria-hidden="true" />
              Clean sweep
            </span>
          )}
          {teamPlayer && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-teal/12 px-2.5 py-1.5 text-xs font-semibold text-brand-teal-deep">
              <HandRaisedIcon className="size-3.5" aria-hidden="true" />
              Team player
            </span>
          )}
        </div>
      )}
    </Panel>
  )
}

/**
 * The employee view.
 *
 * A fragment of sections rather than a page: `Dashboard.tsx` owns the grid so
 * employee and manager blocks share one rhythm instead of each inventing one.
 */
export function EmployeeSections({
  shifts,
  shiftsLoading,
  leave,
  leaveLoading,
  unreadCount,
  unreadLoading,
  canViewSchedule,
  upcomingWindowDays,
  employeeId,
  canRecordAttendance,
  attendanceToday,
  attendanceTodayLoading,
  attendanceHistory,
  attendanceHistoryLoading,
  shiftSwaps,
  shiftSwapsLoading,
  unreadMessages,
  unreadMessagesLoading,
}: {
  shifts: DashboardShift[]
  shiftsLoading: boolean
  leave: LeaveRequest[]
  leaveLoading: boolean
  unreadCount: number
  unreadLoading: boolean
  canViewSchedule: boolean
  upcomingWindowDays: number
  employeeId?: string
  canRecordAttendance: boolean
  attendanceToday: AttendanceRecord | null | undefined
  attendanceTodayLoading: boolean
  attendanceHistory: AttendanceRecord[]
  attendanceHistoryLoading: boolean
  shiftSwaps: ShiftSwapRequest[]
  shiftSwapsLoading: boolean
  unreadMessages: number
  unreadMessagesLoading: boolean
}) {
  const highlights = useMemo(() => computeAttendanceHighlights(attendanceHistory), [attendanceHistory])
  const pendingSwapCount = shiftSwaps.filter((s) => s.status === 'pending').length

  return (
    <motion.section
      aria-labelledby="your-work-heading"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <SectionHeading description="Your own roster, leave and unread updates.">
        <span id="your-work-heading">Your work</span>
      </SectionHeading>

      <StreakSpotlight
        today={attendanceToday}
        todayLoading={attendanceTodayLoading}
        canRecordAttendance={canRecordAttendance}
        highlights={highlights}
        historyLoading={attendanceHistoryLoading}
        swaps={shiftSwaps}
        employeeId={employeeId}
      />

      {/* The shift list is the substance and takes two thirds; the stat rail
          stacks beside it on desktop and sits 2-up from `sm` up. */}
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <div className="lg:col-span-2">
          <UpcomingShifts
            shifts={shifts}
            isLoading={shiftsLoading}
            windowDays={upcomingWindowDays}
            canViewSchedule={canViewSchedule}
            pendingSwapCount={shiftSwapsLoading ? 0 : pendingSwapCount}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:gap-5">
          <LeaveSummary requests={leave} isLoading={leaveLoading} />
          <UnreadNotifications count={unreadCount} isLoading={unreadLoading} />
          <UnreadMessages count={unreadMessages} isLoading={unreadMessagesLoading} />
          <HoursLogged hours={highlights.hoursLast7Days} isLoading={attendanceHistoryLoading} />
        </div>
      </div>
    </motion.section>
  )
}
