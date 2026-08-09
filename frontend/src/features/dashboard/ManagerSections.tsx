import { Link } from 'react-router'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import { Panel, PANEL_PADDING, SectionHeading } from '@/components/dashboard-primitives/Panel'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import type { LeaveRequest } from '@/features/leave/types'
import { LeaveStatusBadge } from '@/features/leave/LeaveStatusBadge'
import type { ShiftCoveragePoint } from './types'

function employeeName(employee: LeaveRequest['employee']): string {
  if (typeof employee === 'string') return 'Employee'
  return `${employee.firstName} ${employee.lastName}`
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatRange(start: string, end: string): string {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const from = new Date(start).toLocaleDateString(undefined, options)
  const to = new Date(end).toLocaleDateString(undefined, options)
  return from === to ? from : `${from} – ${to}`
}

/**
 * An empty state that reads as a resolved condition, not a missing feature.
 *
 * Shared by both panels below so "nothing to do" looks identical wherever it
 * appears — an inconsistent empty state is the fastest way to make a dashboard
 * feel unfinished.
 */
function RestingState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed bg-secondary/30 px-6 py-10 text-center">
      <span className="flex size-10 items-center justify-center">
        <CheckCircleIcon className="size-7 text-brand-teal-deep" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function PanelHeading({
  title,
  count,
  to,
  linkLabel,
}: {
  title: string
  count?: number
  to?: string
  linkLabel?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <h3 className="text-lg leading-[1.35] font-bold tracking-[-0.012em]">{title}</h3>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="tabular-nums">
            {count}
          </Badge>
        )}
      </div>
      {to && linkLabel && (
        <Link
          to={to}
          className="group flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {linkLabel}
          <ArrowRightIcon
            className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      )}
    </div>
  )
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Panel className={PANEL_PADDING}>
      <Skeleton className="h-6 w-40" />
      <div className="mt-5 space-y-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </Panel>
  )
}

/**
 * Leave waiting on this user.
 *
 * The two-stage machine (`pending → department_approved → approved`) is shown
 * as the badge rather than flattened, because which stage a request sits at
 * decides which button the approver will need on `/leave`. The card does not
 * approve — a decision that declines someone's leave belongs on the screen
 * showing the whole request, not on a dashboard row.
 */
export function PendingApprovals({
  requests,
  isLoading,
  total,
}: {
  requests: LeaveRequest[]
  isLoading: boolean
  total: number
}) {
  if (isLoading) return <ListSkeleton />

  return (
    <Panel className={PANEL_PADDING}>
      <PanelHeading
        title="Waiting on you"
        count={total}
        to={total > 0 ? '/leave' : undefined}
        linkLabel={total > 0 ? 'Review all' : undefined}
      />

      {requests.length === 0 ? (
        <div className="mt-5">
          <RestingState
            title="No leave requests need a decision"
            description="New requests from your team arrive here."
          />
        </div>
      ) : (
        <ul className="mt-2">
          {requests.map((request, index) => (
            <li key={request.id}>
              {index > 0 && <Separator />}
              <div className="flex items-center gap-3 py-2.5">
                <Avatar size="sm">
                  <AvatarFallback>{initials(employeeName(request.employee))}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{employeeName(request.employee)}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    <span className="capitalize">{request.leaveType}</span> ·{' '}
                    <span className="tabular-nums">
                      {formatRange(request.startDate, request.endDate)}
                    </span>{' '}
                    ·{' '}
                    <span className="tabular-nums">
                      {request.totalDays} day{request.totalDays === 1 ? '' : 's'}
                    </span>
                  </p>
                </div>
                <LeaveStatusBadge status={request.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/**
 * Days in the next fortnight that are short-staffed, worst first.
 *
 * The actionable half of the coverage figure: the ring says how big the gap is,
 * this says which days it falls on. Fully covered days are omitted — a warnings
 * panel that lists non-warnings trains people to skip it.
 *
 * Each row carries a shadcn `Progress` bar of assigned-against-required, so the
 * severity of a gap is visible without reading the two numbers and subtracting.
 */
export function StaffingWarnings({
  coverage,
  isLoading,
}: {
  coverage: ShiftCoveragePoint[]
  isLoading: boolean
}) {
  if (isLoading) return <ListSkeleton />

  const short = coverage
    .filter((day) => day.assignedStaff < day.requiredStaff)
    .sort((a, b) => a.coveragePercent - b.coveragePercent)

  return (
    <Panel className={PANEL_PADDING}>
      <PanelHeading
        title="Short-staffed days"
        count={short.length}
        to={short.length > 0 ? '/schedules' : undefined}
        linkLabel={short.length > 0 ? 'Open schedules' : undefined}
      />

      {short.length === 0 ? (
        <div className="mt-5">
          <RestingState
            title="Every scheduled day is fully staffed"
            description="Days that fall below their required staffing appear here."
          />
        </div>
      ) : (
        <ul className="mt-2">
          {short.slice(0, 5).map((day, index) => {
            const missing = day.requiredStaff - day.assignedStaff
            return (
              <li key={day.date}>
                {index > 0 && <Separator />}
                <div className="py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center">
                      <ExclamationTriangleIcon className="size-6 text-destructive" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        <time dateTime={day.date} className="tabular-nums">
                          {new Date(day.date).toLocaleDateString(undefined, {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </time>
                      </p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {day.assignedStaff} of {day.requiredStaff} assigned across {day.shiftCount}{' '}
                        shift{day.shiftCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive tabular-nums">
                      {missing} short
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, day.coveragePercent)}
                    className="mt-3 h-1.5"
                    aria-label={`${day.coveragePercent}% staffed`}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/** The manager/admin blocks, composed onto the shared grid. */
export function ManagerSections({
  pendingRequests,
  pendingTotal,
  pendingLoading,
  coverage,
  coverageLoading,
  canApproveLeave,
}: {
  pendingRequests: LeaveRequest[]
  pendingTotal: number
  pendingLoading: boolean
  coverage: ShiftCoveragePoint[]
  coverageLoading: boolean
  canApproveLeave: boolean
}) {
  return (
    <section aria-labelledby="attention-heading">
      <SectionHeading description="Decisions and gaps that need someone to act on them.">
        <span id="attention-heading">Needs attention</span>
      </SectionHeading>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        {canApproveLeave && (
          <PendingApprovals
            requests={pendingRequests}
            isLoading={pendingLoading}
            total={pendingTotal}
          />
        )}
        <StaffingWarnings coverage={coverage} isLoading={coverageLoading} />
      </div>
    </section>
  )
}
