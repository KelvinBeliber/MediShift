import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BuildingOffice2Icon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  SunIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { AreaChart } from '@/components/charts/area-chart'
import { Area } from '@/components/charts/area'
import { Grid } from '@/components/charts/grid'
import { XAxis } from '@/components/charts/x-axis'
import { ChartTooltip } from '@/components/charts/tooltip'
import { PageHeader } from '@/components/layout/PageHeader'
import { Panel, PANEL_PADDING_FOCAL, PanelLabel } from '@/components/dashboard-primitives/Panel'
import { EmptyState } from '@/components/data/EmptyState'
import { DatePicker } from '@/components/ui/date-picker'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAnyPermission } from '@/features/auth/usePermission'
import { reportsApi } from '@/features/reports/api'
import { toApiError } from '@/lib/api/errors'

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const LEAVE_TYPE_LABEL: Record<string, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  emergency: 'Emergency',
  maternity: 'Maternity',
  paternity: 'Paternity',
  bereavement: 'Bereavement',
  study: 'Study',
}

function ChartFrame({
  isLoading,
  empty,
  hasData,
  children,
}: {
  isLoading: boolean
  empty: string
  hasData: boolean
  children: ReactNode
}) {
  if (isLoading) return <Skeleton className="h-[280px] w-full rounded-lg" />
  if (!hasData) {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
        <p className="text-sm font-medium">Not enough data to chart</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{empty}</p>
      </div>
    )
  }
  return <>{children}</>
}

function AttendanceTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'attendance-trends', dateFrom, dateTo],
    queryFn: () => reportsApi.attendanceTrends({ dateFrom, dateTo }),
  })
  const points = (data ?? []).map((p) => ({ date: new Date(p.date), present: p.present, late: p.late, absent: p.absent }))

  if (error) return <EmptyState title="Couldn't load attendance trends" description={toApiError(error).message} />

  return (
    <Panel elevation="focal" className={PANEL_PADDING_FOCAL}>
      <PanelLabel>Attendance trends</PanelLabel>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">Daily present, late and absent counts.</p>
      <ChartFrame isLoading={isLoading} hasData={points.length >= 2} empty="No attendance was recorded in this range.">
        <AreaChart data={points} xDataKey="date" aspectRatio="16 / 5" margin={{ top: 16, right: 16, bottom: 32, left: 16 }}>
          <Grid />
          <XAxis numTicks={6} />
          <Area dataKey="present" stroke="var(--color-brand-teal)" fill="var(--color-brand-teal)" fillOpacity={0.2} gradientToOpacity={0} strokeWidth={2.5} />
          <Area dataKey="late" stroke="var(--color-shift-afternoon)" fill="var(--color-shift-afternoon)" fillOpacity={0.14} gradientToOpacity={0} strokeWidth={2} />
          <Area dataKey="absent" stroke="var(--color-destructive)" fill="var(--color-destructive)" fillOpacity={0.1} gradientToOpacity={0} strokeWidth={1.5} dashArray="5,4" />
          <ChartTooltip
            dotVariant="ring"
            rows={(point) => [
              { color: 'var(--color-brand-teal)', label: 'Present', value: Number(point.present) },
              { color: 'var(--color-shift-afternoon)', label: 'Late', value: Number(point.late) },
              { color: 'var(--color-destructive)', label: 'Absent', value: Number(point.absent) },
            ]}
          />
        </AreaChart>
      </ChartFrame>
    </Panel>
  )
}

function OvertimeTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'overtime-trends', dateFrom, dateTo],
    queryFn: () => reportsApi.overtimeTrends({ dateFrom, dateTo }),
  })
  const points = (data ?? []).map((p) => ({ date: new Date(p.date), overtimeHours: p.overtimeHours }))
  const total = (data ?? []).reduce((sum, p) => sum + p.overtimeHours, 0)

  if (error) return <EmptyState title="Couldn't load overtime trends" description={toApiError(error).message} />

  return (
    <Panel elevation="focal" className={PANEL_PADDING_FOCAL}>
      <PanelLabel>Overtime trends</PanelLabel>
      <p className="mt-1 text-2xl font-bold tabular-nums">{total.toFixed(1)}h logged</p>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">Daily overtime hours across the range.</p>
      <ChartFrame isLoading={isLoading} hasData={points.length >= 2} empty="No overtime was recorded in this range.">
        <AreaChart data={points} xDataKey="date" aspectRatio="16 / 5" margin={{ top: 16, right: 16, bottom: 32, left: 16 }}>
          <Grid />
          <XAxis numTicks={6} />
          <Area dataKey="overtimeHours" stroke="var(--color-shift-afternoon)" fill="var(--color-shift-afternoon)" fillOpacity={0.24} gradientToOpacity={0} strokeWidth={2.5} />
          <ChartTooltip
            dotVariant="ring"
            rows={(point) => [{ color: 'var(--color-shift-afternoon)', label: 'Overtime', value: `${Number(point.overtimeHours).toFixed(1)}h` }]}
          />
        </AreaChart>
      </ChartFrame>
    </Panel>
  )
}

function CoverageTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'shift-coverage', dateFrom, dateTo],
    queryFn: () => reportsApi.shiftCoverage({ dateFrom, dateTo }),
  })
  const points = (data ?? []).map((p) => ({ date: new Date(p.date), assignedStaff: p.assignedStaff, requiredStaff: p.requiredStaff }))

  if (error) return <EmptyState title="Couldn't load shift coverage" description={toApiError(error).message} />

  return (
    <Panel elevation="focal" className={PANEL_PADDING_FOCAL}>
      <PanelLabel>Shift coverage</PanelLabel>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">Assigned staff against what each day's shifts require.</p>
      <ChartFrame isLoading={isLoading} hasData={points.length >= 2} empty="No shifts fall in this range.">
        <AreaChart data={points} xDataKey="date" aspectRatio="16 / 5" margin={{ top: 16, right: 16, bottom: 32, left: 16 }}>
          <Grid />
          <XAxis numTicks={6} />
          <Area dataKey="assignedStaff" stroke="var(--color-brand-teal)" fill="var(--color-brand-teal)" fillOpacity={0.22} gradientToOpacity={0} strokeWidth={2.5} />
          <Area dataKey="requiredStaff" stroke="var(--color-muted-foreground)" fill="var(--color-muted-foreground)" fillOpacity={0} strokeWidth={1.5} showLine dashArray="5,4" showHighlight={false} />
          <ChartTooltip
            dotVariant="ring"
            rows={(point) => {
              const assigned = Number(point.assignedStaff)
              const required = Number(point.requiredStaff)
              return [
                { color: 'var(--color-brand-teal)', label: 'Assigned', value: assigned },
                { color: 'var(--color-muted-foreground)', label: 'Required', value: required },
                ...(assigned < required ? [{ color: 'var(--color-destructive)', label: 'Short by', value: required - assigned }] : []),
              ]
            }}
          />
        </AreaChart>
      </ChartFrame>
    </Panel>
  )
}

function LeaveTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'leave-statistics', dateFrom, dateTo],
    queryFn: () => reportsApi.leaveStatistics({ dateFrom, dateTo }),
  })

  if (error) return <EmptyState title="Couldn't load leave statistics" description={toApiError(error).message} />

  const rows = data ?? []
  const max = Math.max(1, ...rows.map((r) => r.total))

  return (
    <Panel elevation="focal" className={PANEL_PADDING_FOCAL}>
      <PanelLabel>Leave statistics</PanelLabel>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">Requests overlapping this range, by type and status.</p>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No leave requests" description="Nothing overlaps this date range." />
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.leaveType}>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="font-medium">{LEAVE_TYPE_LABEL[row.leaveType] ?? row.leaveType}</span>
                <span className="tabular-nums text-muted-foreground">{row.total} request{row.total === 1 ? '' : 's'}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand-teal-deep" style={{ width: `${(row.total / max) * 100}%` }} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground capitalize">
                {Object.entries(row.byStatus).map(([status, count]) => (
                  <span key={status}>
                    {count} {status.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function DepartmentUtilizationTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'department-utilization', dateFrom, dateTo],
    queryFn: () => reportsApi.departmentUtilization(dateFrom, dateTo),
  })

  if (error) return <EmptyState title="Couldn't load department utilization" description={toApiError(error).message} />

  const rows = data ?? []

  return (
    <Panel elevation="focal" className={PANEL_PADDING_FOCAL}>
      <PanelLabel>Department utilization</PanelLabel>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">Worked hours against scheduled hours, per department.</p>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No active departments" description="Nothing to show yet." />
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.departmentId}>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="font-medium">{row.department}</span>
                <span className="tabular-nums text-muted-foreground">
                  {row.workedHours}h / {row.scheduledHours}h · {row.employeeCount} staff
                </span>
              </div>
              <Progress value={Math.min(100, row.utilizationPercent)} className="h-1.5" aria-label={`${row.utilizationPercent}% utilized`} />
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">{row.utilizationPercent}% utilized</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/** Screen 22 — `/reports`. Distinct from the Dashboard: an arbitrary date range, one metric at a time. */
export function ReportsPage() {
  const canView = useAnyPermission(['report:view', 'analytics:view'])
  const [dateFrom, setDateFrom] = useState(daysAgo(30))
  const [dateTo, setDateTo] = useState(today())

  if (!canView) {
    return <EmptyState title="Reports & analytics" description="You don't have permission to view reports." />
  }

  return (
    <div>
      <PageHeader title="Reports & analytics" description="Pick a date range and drill into a specific metric." />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1.5 block text-muted-foreground">From</span>
          <DatePicker value={dateFrom} onChange={setDateFrom} />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-muted-foreground">To</span>
          <DatePicker value={dateTo} onChange={setDateTo} />
        </label>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">
            <ClipboardDocumentCheckIcon className="size-4" aria-hidden="true" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="overtime">
            <ClockIcon className="size-4" aria-hidden="true" />
            Overtime
          </TabsTrigger>
          <TabsTrigger value="coverage">
            <UserGroupIcon className="size-4" aria-hidden="true" />
            Coverage
          </TabsTrigger>
          <TabsTrigger value="leave">
            <SunIcon className="size-4" aria-hidden="true" />
            Leave
          </TabsTrigger>
          <TabsTrigger value="departments">
            <BuildingOffice2Icon className="size-4" aria-hidden="true" />
            Departments
          </TabsTrigger>
        </TabsList>
        <TabsContent value="attendance" className="mt-4">
          <AttendanceTab dateFrom={dateFrom} dateTo={dateTo} />
        </TabsContent>
        <TabsContent value="overtime" className="mt-4">
          <OvertimeTab dateFrom={dateFrom} dateTo={dateTo} />
        </TabsContent>
        <TabsContent value="coverage" className="mt-4">
          <CoverageTab dateFrom={dateFrom} dateTo={dateTo} />
        </TabsContent>
        <TabsContent value="leave" className="mt-4">
          <LeaveTab dateFrom={dateFrom} dateTo={dateTo} />
        </TabsContent>
        <TabsContent value="departments" className="mt-4">
          <DepartmentUtilizationTab dateFrom={dateFrom} dateTo={dateTo} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
