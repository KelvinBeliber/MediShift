import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon, CalendarDaysIcon, InboxIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { Panel, PANEL_PADDING, SectionHeading } from '@/components/dashboard-primitives/Panel'
import { StatCard, StatCardSkeleton } from '@/components/dashboard-primitives/StatCard'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import type { LeaveRequest } from '@/features/leave/types'
import type { DashboardShift } from './types'
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
}: {
  shifts: DashboardShift[]
  isLoading: boolean
  windowDays: number
  canViewSchedule: boolean
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
      <div className="flex items-center justify-between gap-3">
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

      {shifts.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-lg border border-dashed bg-secondary/30 px-6 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <CalendarDaysIcon className="size-5 text-muted-foreground" aria-hidden="true" />
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
}: {
  shifts: DashboardShift[]
  shiftsLoading: boolean
  leave: LeaveRequest[]
  leaveLoading: boolean
  unreadCount: number
  unreadLoading: boolean
  canViewSchedule: boolean
  upcomingWindowDays: number
}) {
  return (
    <section aria-labelledby="your-work-heading">
      <SectionHeading description="Your own roster, leave and unread updates.">
        <span id="your-work-heading">Your work</span>
      </SectionHeading>

      {/* The shift list is the substance and takes two thirds; the two figures
          stack beside it on desktop and sit side by side from `sm` up. */}
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <div className="lg:col-span-2">
          <UpcomingShifts
            shifts={shifts}
            isLoading={shiftsLoading}
            windowDays={upcomingWindowDays}
            canViewSchedule={canViewSchedule}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:gap-5">
          <LeaveSummary requests={leave} isLoading={leaveLoading} />
          <UnreadNotifications count={unreadCount} isLoading={unreadLoading} />
        </div>
      </div>
    </section>
  )
}
