import { AreaChart } from '@/components/charts/area-chart'
import { Area } from '@/components/charts/area'
import { cn } from '@/lib/utils'

/**
 * The micro-chart inside a stat card.
 *
 * Bklit's `AreaChart` with every piece of chrome removed — no axes, no grid, no
 * tooltip, zero margins — so a summary figure carries the shape of its own
 * last 30 days. It is the same renderer as the full-size charts further down
 * the page, which is the point: the sparkline and the chart it previews are
 * visibly the same object at two scales, rather than two different drawings of
 * the same numbers.
 *
 * `fadeEdges` keeps the fill from butting hard against the card padding, and
 * the gradient runs to zero opacity at the baseline so it never competes with
 * the figure above it.
 */
export function Sparkline({
  data,
  dataKey,
  stroke,
  className,
  height = 48,
}: {
  data: Record<string, unknown>[]
  dataKey: string
  /** A CSS colour or `var(--…)`. Defaults to the brand teal. */
  stroke?: string
  className?: string
  height?: number
}) {
  // Two points is the floor for a line. Below that the card shows nothing
  // rather than a misleading flat rule that looks like "no change".
  if (data.length < 2) {
    return <div className={cn('w-full', className)} style={{ height }} aria-hidden="true" />
  }

  const colour = stroke ?? 'var(--color-brand-teal)'

  return (
    <div className={cn('w-full', className)} style={{ height }} aria-hidden="true">
      <AreaChart
        data={data}
        xDataKey="date"
        margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
        style={{ height }}
      >
        <Area
          dataKey={dataKey}
          stroke={colour}
          fill={colour}
          strokeWidth={2}
          fillOpacity={0.18}
          gradientToOpacity={0}
          fadeEdges
          showHighlight={false}
        />
      </AreaChart>
    </div>
  )
}
