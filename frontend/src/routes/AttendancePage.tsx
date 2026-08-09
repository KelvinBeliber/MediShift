import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  BoltIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  SunIcon,
  XCircleIcon,
} from '@heroicons/react/16/solid'
import {
  ArrowLeftOnRectangleIcon,
  ArrowRightOnRectangleIcon,
  CheckCircleIcon as CheckCircleIconOutline,
  PauseCircleIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/data/EmptyState'
import { Pagination } from '@/components/data/Pagination'
import { Stepper, type StepperStep } from '@/components/data/Stepper'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePermission } from '@/features/auth/usePermission'
import { attendanceApi } from '@/features/attendance/api'
import type { AttendanceRecord } from '@/features/attendance/types'
import { toApiError } from '@/lib/api/errors'
import { cn } from '@/lib/utils'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'destructive'> = {
  present: 'success',
  late: 'warning',
  absent: 'destructive',
  leave: 'outline',
  holiday: 'outline',
  overtime: 'warning',
}

/** `absent` is the state most important to catch at a glance, so it gets the
 * most attention-grabbing glyph (a filled X). */
const STATUS_ICON: Record<string, typeof CheckCircleIcon> = {
  present: CheckCircleIcon,
  late: ClockIcon,
  absent: XCircleIcon,
  leave: SunIcon,
  holiday: CalendarDaysIcon,
  overtime: BoltIcon,
}

const TODAY_KEY = ['attendance', 'today']

type ClockState = 'not_started' | 'clocked_in' | 'on_break' | 'clocked_out'

function deriveState(record: AttendanceRecord | null | undefined): ClockState {
  if (!record?.clockIn) return 'not_started'
  if (record.clockOut) return 'clocked_out'
  if (record.breaks.some((b) => !b.end)) return 'on_break'
  return 'clocked_in'
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

/** Ticks once a minute so the "on shift for…" readout stays live without polling the server. */
function useNow(enabled: boolean): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [enabled])
  return now
}

function StatusStepper({ state, record }: { state: ClockState; record: AttendanceRecord | null }) {
  const activeIndex = state === 'not_started' ? 0 : state === 'clocked_out' ? 2 : 1

  const steps: StepperStep[] = [
    {
      key: 'not_started',
      label: 'Clock in',
      icon: ArrowRightOnRectangleIcon,
      caption: record?.clockIn ? formatTime(record.clockIn.time) : undefined,
    },
    {
      key: 'clocked_in',
      label: 'On shift',
      icon: CheckCircleIconOutline,
      activeLabel: state === 'on_break' ? 'On break' : undefined,
      tone: state === 'on_break' ? 'warning' : 'default',
    },
    {
      key: 'clocked_out',
      label: 'Clocked out',
      icon: ArrowLeftOnRectangleIcon,
      caption: record?.clockOut ? formatTime(record.clockOut.time) : undefined,
    },
  ]

  return <Stepper steps={steps} activeIndex={activeIndex} />
}

function ClockWidget() {
  const queryClient = useQueryClient()

  const { data: record, isLoading, error } = useQuery({
    queryKey: TODAY_KEY,
    queryFn: () => attendanceApi.today(),
  })

  const apiError = error ? toApiError(error) : null
  const notLinked = apiError?.status === 400 && apiError.message.toLowerCase().includes('no employee profile')

  const state = deriveState(record)
  const now = useNow(state === 'clocked_in' || state === 'on_break')

  function invalidate(updated: AttendanceRecord) {
    queryClient.setQueryData(TODAY_KEY, updated)
  }

  function handlers(successLabel: string) {
    return {
      onSuccess: (updated: AttendanceRecord) => {
        invalidate(updated)
        toast.success(successLabel)
      },
      onError: (err: unknown) => toast.error(toApiError(err).message),
    }
  }

  const clockIn = useMutation({ mutationFn: () => attendanceApi.clockIn(), ...handlers('Clocked in — have a good shift') })
  const clockOut = useMutation({ mutationFn: () => attendanceApi.clockOut(), ...handlers('Clocked out') })
  const breakStart = useMutation({ mutationFn: () => attendanceApi.breakStart(), ...handlers('Break started') })
  const breakEnd = useMutation({ mutationFn: () => attendanceApi.breakEnd(), ...handlers('Break ended — welcome back') })

  const anyPending = clockIn.isPending || clockOut.isPending || breakStart.isPending || breakEnd.isPending

  const openBreakStart = record?.breaks.find((b) => !b.end)?.start
  const elapsedSinceClockIn = record?.clockIn ? now.getTime() - new Date(record.clockIn.time).getTime() : 0
  const elapsedOnBreak = openBreakStart ? now.getTime() - new Date(openBreakStart).getTime() : 0

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Clock in / out</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-9 w-40" />
        </CardContent>
      </Card>
    )
  }

  if (notLinked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Clock in / out</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your account isn't linked to an employee profile yet, so you can't clock in or out. Ask HR to link
            your account to your employee record.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clock in / out</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <StatusStepper state={state} record={record ?? null} />

        {state === 'not_started' && (
          <p className="text-sm text-muted-foreground">
            You haven't clocked in yet today. Click "Clock in" when you start your shift.
          </p>
        )}
        {state === 'clocked_in' && (
          <p className="text-sm">
            On shift for <span className="font-semibold">{formatDuration(elapsedSinceClockIn)}</span> — clocked
            in at {record?.clockIn && formatTime(record.clockIn.time)}.
          </p>
        )}
        {state === 'on_break' && (
          <p className="text-sm">
            On break for <span className="font-semibold">{formatDuration(elapsedOnBreak)}</span>. End your break
            to resume your shift, or before clocking out.
          </p>
        )}
        {state === 'clocked_out' && record && (
          <p className="text-sm">
            Shift complete —{' '}
            <span className="font-semibold">{record.totalHoursWorked ?? 0}h</span> worked
            {!!record.overtimeHours && (
              <>
                , including <span className="font-semibold">{record.overtimeHours}h</span> overtime
              </>
            )}
            . You're done for today; only one clock-in is allowed per day.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {state === 'not_started' && (
            <Button onClick={() => clockIn.mutate()} disabled={anyPending}>
              <ArrowRightOnRectangleIcon /> {clockIn.isPending ? 'Clocking in…' : 'Clock in'}
            </Button>
          )}
          {state === 'clocked_in' && (
            <>
              <Button variant="outline" onClick={() => breakStart.mutate()} disabled={anyPending}>
                <PauseCircleIcon /> {breakStart.isPending ? 'Starting break…' : 'Start break'}
              </Button>
              <Button onClick={() => clockOut.mutate()} disabled={anyPending}>
                <ArrowLeftOnRectangleIcon /> {clockOut.isPending ? 'Clocking out…' : 'Clock out'}
              </Button>
            </>
          )}
          {state === 'on_break' && (
            <Button onClick={() => breakEnd.mutate()} disabled={anyPending}>
              <PlayCircleIcon /> {breakEnd.isPending ? 'Ending break…' : 'End break'}
            </Button>
          )}
        </div>

        {record && record.breaks.length > 0 && (
          <div className="border-t pt-3">
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Today's breaks
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {record.breaks.map((b, i) => (
                <li key={i}>
                  {formatTime(b.start)} – {b.end ? formatTime(b.end) : 'ongoing'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Screen 15 — `/attendance`. */
export function AttendancePage() {
  const canView = usePermission('attendance:view')
  const canManage = usePermission('attendance:manage')
  const queryClient = useQueryClient()

  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(monthAgo)
  const [dateTo, setDateTo] = useState(today)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', { dateFrom, dateTo, page }],
    queryFn: () => attendanceApi.list({ dateFrom, dateTo, page, limit: 20 }),
    enabled: canView,
  })

  const markAbsentees = useMutation({
    mutationFn: () => attendanceApi.markAbsentees(),
    onSuccess: (result) => {
      toast.success(`Marked ${result.marked} absentee record(s)`)
      void queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const records = data?.items ?? []

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Clock in and out, and (for managers) review the team's attendance history."
        actions={
          canManage && (
            <Button variant="outline" onClick={() => markAbsentees.mutate()} disabled={markAbsentees.isPending}>
              {markAbsentees.isPending ? 'Marking…' : 'Mark absentees for today'}
            </Button>
          )
        }
      />

      <div className="mb-6">
        <ClockWidget />
      </div>

      {canView ? (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">From</span>
              <DatePicker value={dateFrom} onChange={setDateFrom} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">To</span>
              <DatePicker value={dateTo} onChange={setDateTo} />
            </label>
          </div>

          {!isLoading && records.length === 0 && (
            <EmptyState title="No attendance records" description="Nothing recorded for this date range yet." />
          )}

          {records.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock in</TableHead>
                    <TableHead>Clock out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Overtime</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => {
                    const isToday = record.date.slice(0, 10) === today
                    return (
                      <TableRow key={record.id} className={cn(isToday && 'bg-primary/5')}>
                        <TableCell>
                          {(() => {
                            const name =
                              typeof record.employee === 'string'
                                ? record.employee
                                : `${record.employee.firstName} ${record.employee.lastName}`
                            return (
                              <div className="flex items-center gap-2">
                                <EmployeeAvatar name={name} />
                                {name}
                              </div>
                            )
                          })()}
                        </TableCell>
                        <TableCell>
                          {isToday ? (
                            <span className="font-medium">Today</span>
                          ) : (
                            new Date(record.date).toLocaleDateString()
                          )}
                        </TableCell>
                        <TableCell>
                          {record.clockIn ? new Date(record.clockIn.time).toLocaleTimeString() : '—'}
                        </TableCell>
                        <TableCell>
                          {record.clockOut ? new Date(record.clockOut.time).toLocaleTimeString() : '—'}
                        </TableCell>
                        <TableCell>{record.totalHoursWorked ?? '—'}</TableCell>
                        <TableCell>{record.overtimeHours ?? 0}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[record.status] ?? 'outline'} className="capitalize">
                            {(() => {
                              const Icon = STATUS_ICON[record.status]
                              return Icon ? <Icon aria-hidden="true" /> : null
                            })()}
                            {record.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {data && <Pagination meta={data.pagination} onPageChange={setPage} />}
            </>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          You can see your own clock-in status above. Team attendance history is only visible to managers and HR.
        </p>
      )}
    </div>
  )
}
