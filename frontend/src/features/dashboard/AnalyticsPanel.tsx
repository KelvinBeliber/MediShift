import { useMemo, useState } from 'react'
import type { ComponentType, SVGProps } from 'react'
import { Area, AreaChart as RechartsAreaChart, CartesianGrid, Tooltip, XAxis } from 'recharts'
import { ClipboardDocumentCheckIcon, ClockIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { Panel, PANEL_PADDING_FOCAL, PanelLabel } from '@/components/dashboard-primitives/Panel'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { AttendanceTrendPoint, OvertimeTrendPoint, ShiftCoveragePoint } from './types'

/**
 * The screen's analytical centrepiece.
 *
 * ## Why one large panel instead of three small ones
 *
 * The first version of this dashboard put overtime and coverage in two half-
 * width charts at the bottom of the page, at a 16:6 aspect with no fill, no
 * tooltip and no hover. They were the least noticeable thing on a screen whose
 * whole job is analysis. This replaces them with a single tall panel that owns
 * the fold: one chart at a time, at a size worth reading, with the series
 * behind a segmented control.
 *
 * Tabs rather than a legend of toggles because these three series don't share a
 * y-scale — hours, headcount and percent can't sit on one axis without one of
 * them becoming a flat line at the bottom.
 *
 * ## Interaction
 *
 * Built on shadcn's chart primitives (`@/components/ui/chart`, Recharts under
 * the hood). `<AnalyticsTooltip>` formats each series with its own unit so the
 * hover panel reads as a sentence ("Assigned 7 · Required 8") rather than as
 * bare numbers, mirroring the row shape the previous chart engine used.
 */

type SeriesKey = 'attendance' | 'overtime' | 'coverage'

interface SeriesSpec {
  key: SeriesKey
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Shown under the panel title while this series is selected. */
  caption: string
  empty: string
}

const SERIES: SeriesSpec[] = [
  {
    key: 'attendance',
    label: 'Attendance',
    icon: ClipboardDocumentCheckIcon,
    caption: 'Daily present and late headcount',
    empty: 'No attendance was recorded in this window.',
  },
  {
    key: 'overtime',
    label: 'Overtime',
    icon: ClockIcon,
    caption: 'Daily overtime hours',
    empty: 'No overtime was recorded in this window.',
  },
  {
    key: 'coverage',
    label: 'Coverage',
    icon: UserGroupIcon,
    caption: 'Assigned against required staffing',
    empty: 'No shifts are scheduled in this window.',
  },
]

const dateTickFormatter = (value: Date) =>
  value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

interface TooltipRow {
  color: string
  label: string
  value: string | number
}

const CHART_CONFIGS: Record<SeriesKey, ChartConfig> = {
  attendance: {
    present: { label: 'Present', color: 'var(--color-brand-teal)' },
    late: { label: 'Late', color: 'var(--color-shift-night)' },
  },
  overtime: {
    overtimeHours: { label: 'Overtime', color: 'var(--color-shift-afternoon)' },
  },
  coverage: {
    assignedStaff: { label: 'Assigned', color: 'var(--color-brand-teal)' },
    requiredStaff: { label: 'Required', color: 'var(--color-muted-foreground)' },
  },
}

function rowsForPoint(active: SeriesKey, point: Record<string, unknown>): TooltipRow[] {
  if (active === 'attendance') {
    return [
      { color: 'var(--color-brand-teal)', label: 'Present', value: Number(point.present) },
      { color: 'var(--color-shift-night)', label: 'Late', value: Number(point.late) },
    ]
  }
  if (active === 'overtime') {
    return [
      {
        color: 'var(--color-shift-afternoon)',
        label: 'Overtime',
        value: `${Number(point.overtimeHours).toFixed(1)}h`,
      },
    ]
  }
  const assigned = Number(point.assignedStaff)
  const required = Number(point.requiredStaff)
  return [
    { color: 'var(--color-brand-teal)', label: 'Assigned', value: assigned },
    { color: 'var(--color-muted-foreground)', label: 'Required', value: required },
    ...(assigned < required
      ? [{ color: 'var(--color-destructive)', label: 'Short by', value: required - assigned }]
      : []),
  ]
}

interface AnalyticsTooltipProps {
  active?: boolean
  payload?: Array<{ payload: Record<string, unknown> }>
  seriesKey: SeriesKey
}

function AnalyticsTooltip({ active, payload, seriesKey }: AnalyticsTooltipProps) {
  if (!active || !payload?.length) {
    return null
  }
  const point = payload[0]?.payload as Record<string, unknown> | undefined
  if (!point) {
    return null
  }
  const date = point.date instanceof Date ? point.date : new Date(point.date as string)

  return (
    <div className="min-w-[9rem] rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="mb-1.5 font-medium text-foreground">
        {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
      </div>
      <div className="grid gap-1">
        {rowsForPoint(seriesKey, point).map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
                aria-hidden="true"
              />
              {row.label}
            </span>
            <span className="font-medium text-foreground tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AnalyticsPanel({
  attendance,
  overtime,
  coverage,
  isLoading,
  windowDays,
  upcomingWindowDays,
}: {
  attendance: AttendanceTrendPoint[]
  overtime: OvertimeTrendPoint[]
  coverage: ShiftCoveragePoint[]
  isLoading: boolean
  windowDays: number
  upcomingWindowDays: number
}) {
  const [active, setActive] = useState<SeriesKey>('attendance')

  const points = useMemo((): Record<string, unknown>[] => {
    if (active === 'attendance') {
      return attendance.map((p) => ({
        date: new Date(p.date),
        present: p.present,
        late: p.late,
      }))
    }
    if (active === 'overtime') {
      return overtime.map((p) => ({ date: new Date(p.date), overtimeHours: p.overtimeHours }))
    }
    return coverage.map((p) => ({
      date: new Date(p.date),
      assignedStaff: p.assignedStaff,
      requiredStaff: p.requiredStaff,
    }))
  }, [active, attendance, overtime, coverage])

  const spec = SERIES.find((s) => s.key === active)!
  const rangeLabel =
    active === 'coverage' ? `Next ${upcomingWindowDays} days` : `Last ${windowDays} days`

  /** Shown on every tab trigger, not just the caption beneath the chart — the
   * window switches direction (past for attendance/overtime, upcoming for
   * coverage) between tabs, which is easy to miss if it's only stated after
   * you've already switched to it. */
  function windowLabelFor(key: SeriesKey): string {
    return key === 'coverage' ? `Next ${upcomingWindowDays}d` : `Last ${windowDays}d`
  }

  /** The headline figure for the selected series, so the panel always states a total. */
  const headline = useMemo(() => {
    if (active === 'attendance') {
      const total = attendance.reduce((sum, p) => sum + p.present + p.late, 0)
      return { value: total.toLocaleString(), unit: 'shifts attended' }
    }
    if (active === 'overtime') {
      const total = overtime.reduce((sum, p) => sum + p.overtimeHours, 0)
      return { value: total.toFixed(1), unit: 'hours logged' }
    }
    const required = coverage.reduce((sum, p) => sum + p.requiredStaff, 0)
    const assigned = coverage.reduce((sum, p) => sum + p.assignedStaff, 0)
    const pct = required > 0 ? Math.round((assigned / required) * 100) : 100
    return { value: `${pct}%`, unit: 'of required staffing' }
  }, [active, attendance, overtime, coverage])

  return (
    <Panel elevation="focal" className={cn('flex flex-col', PANEL_PADDING_FOCAL)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <PanelLabel>Analytics</PanelLabel>
          <p className="mt-3 flex items-baseline gap-2">
            <span
              className="text-[2.25rem] leading-none font-bold tracking-[-0.025em] tabular-nums"
              data-numeric
            >
              {headline.value}
            </span>
            <span className="text-sm text-muted-foreground">{headline.unit}</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {spec.caption} · {rangeLabel}
          </p>
        </div>

        <Tabs value={active} onValueChange={(v) => setActive(v as SeriesKey)}>
          <TabsList>
            {SERIES.map((s) => (
              <TabsTrigger key={s.key} value={s.key}>
                <s.icon className="size-4" aria-hidden="true" />
                {s.label}
                <span className="text-muted-foreground/70">· {windowLabelFor(s.key)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <Skeleton className="h-[230px] w-full rounded-lg" />
        ) : points.length < 2 ? (
          <div className="flex h-[230px] flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
            <p className="text-sm font-medium">Not enough data to chart</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{spec.empty}</p>
          </div>
        ) : (
          <ChartContainer config={CHART_CONFIGS[active]} className="h-[230px] w-full">
            <RechartsAreaChart data={points} margin={{ top: 16, right: 16, bottom: 8, left: 16 }}>
              <defs>
                <linearGradient id="fillPresent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-brand-teal)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-brand-teal)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillLate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-shift-night)" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="var(--color-shift-night)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="fillOvertime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-shift-afternoon)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-shift-afternoon)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillAssigned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-brand-teal)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-brand-teal)" stopOpacity={0.1} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} strokeDasharray="4 4" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={32}
                tickFormatter={dateTickFormatter}
              />

              {active === 'attendance' && (
                <>
                  <Area
                    dataKey="present"
                    type="natural"
                    fill="url(#fillPresent)"
                    stroke="var(--color-brand-teal)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Area
                    dataKey="late"
                    type="natural"
                    fill="url(#fillLate)"
                    stroke="var(--color-shift-night)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </>
              )}

              {active === 'overtime' && (
                <Area
                  dataKey="overtimeHours"
                  type="natural"
                  fill="url(#fillOvertime)"
                  stroke="var(--color-shift-afternoon)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              )}

              {active === 'coverage' && (
                <>
                  <Area
                    dataKey="assignedStaff"
                    type="natural"
                    fill="url(#fillAssigned)"
                    stroke="var(--color-brand-teal)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Area
                    dataKey="requiredStaff"
                    type="natural"
                    fill="none"
                    stroke="var(--color-muted-foreground)"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={false}
                  />
                </>
              )}

              <Tooltip
                cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }}
                content={<AnalyticsTooltip seriesKey={active} />}
              />
            </RechartsAreaChart>
          </ChartContainer>
        )}
      </div>

      {/* A legend only where two series share the plot. One series needs no key. */}
      {active !== 'overtime' && points.length >= 2 && !isLoading && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {active === 'attendance' ? (
            <>
              <LegendKey colour="var(--color-brand-teal)" label="Present" />
              <LegendKey colour="var(--color-shift-night)" label="Late" />
            </>
          ) : (
            <>
              <LegendKey colour="var(--color-brand-teal)" label="Assigned" />
              <LegendKey colour="var(--color-muted-foreground)" label="Required" dashed />
            </>
          )}
        </div>
      )}
    </Panel>
  )
}

function LegendKey({ colour, label, dashed }: { colour: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-0.5 w-4 rounded-full"
        style={
          dashed
            ? { backgroundImage: `repeating-linear-gradient(90deg, ${colour} 0 4px, transparent 4px 7px)` }
            : { backgroundColor: colour }
        }
        aria-hidden="true"
      />
      {label}
    </span>
  )
}
