import type { ReactNode } from 'react'
import NumberFlow, { continuous } from '@number-flow/react'
import type { ComponentType, SVGProps } from 'react'
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from '@heroicons/react/16/solid'
import { Panel, PANEL_PADDING, PanelLabel } from './Panel'
import { Sparkline } from './Sparkline'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * One figure, named, with its own trend and the context needed to act on it.
 *
 * ## Anatomy
 *
 *   ATTENDANCE                          ◐   ← label + tinted icon chip
 *   94.2%                    ▲ 2.1 pts      ← figure (Metric) + delta pill
 *   ╭─╮╭──╮                                 ← sparkline, its own 30 days
 *   Present or late, last 30 days           ← context line
 *
 * ## The type step
 *
 * **Metric, 36px / 600 / -0.025em / tabular.** The first version of this card
 * used 28px, which sat so close to body copy that a screen of them read as
 * paragraphs. A figure meant to be read across a ward needs to win its card
 * outright, so it now sits between Display (30px, page title) and nothing else
 * — the one place in the system where a number outranks a heading, because on
 * a metrics surface the number *is* the heading.
 *
 * ## Counters
 *
 * `NumberFlow` renders tabular by default and honours `prefers-reduced-motion`
 * internally, satisfying DESIGN.md's Tabular Rule and the reduced-motion floor
 * in one component. It animates on *change*, not on mount — a dashboard that
 * counts up from zero on every visit is a load animation, not information.
 */

export type StatTone = 'default' | 'positive' | 'attention'

/** Icon colour per tone. Plain glyph, no fill chip behind it. */
const ICON_TONE: Record<StatTone, string> = {
  default: 'text-brand-teal-deep',
  positive: 'text-brand-teal-deep',
  attention: 'text-destructive',
}

export interface StatDelta {
  /** Change against the previous window, in the figure's own units. */
  value: number
  /** What the comparison is against, e.g. "vs previous 30 days". */
  label: string
  /** Unit shown after the delta. Percentage-point metrics should pass `pts`. */
  unit?: string
  /**
   * Whether a rise is good. Late arrivals rising is bad; attendance rising is
   * good — without this the arrow would colour the wrong direction green.
   */
  higherIsBetter?: boolean
}

export interface StatCardProps {
  label: string
  value: number
  /** Rendered after the figure, e.g. `%` or `h`. Kept out of the counter so digits align. */
  unit?: string
  /** One short line under the card. Say what the number is *of*, not how it trends. */
  context?: string
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  tone?: StatTone
  decimals?: number
  delta?: StatDelta
  /** Daily series behind this figure. Rendered as a sparkline when 2+ points. */
  series?: Record<string, unknown>[]
  seriesKey?: string
  /** Explains how the figure is derived. Surfaced through a shadcn Tooltip on the label. */
  hint?: string
  className?: string
  fallback?: ReactNode
}

function DeltaPill({ delta }: { delta: StatDelta }) {
  const { value, unit = '', higherIsBetter = true } = delta
  const flat = Math.abs(value) < 0.05
  const good = higherIsBetter ? value > 0 : value < 0

  const Icon = flat ? MinusIcon : value > 0 ? ArrowUpRightIcon : ArrowDownRightIcon

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tabular-nums',
        flat
          ? 'bg-muted text-muted-foreground'
          : good
            ? 'bg-brand-teal/12 text-brand-teal-deep'
            : 'bg-destructive/10 text-destructive',
      )}
      title={delta.label}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {flat ? '—' : `${Math.abs(value).toFixed(1)}${unit}`}
    </span>
  )
}

export function StatCard({
  label,
  value,
  unit,
  context,
  icon: Icon,
  tone = 'default',
  decimals = 0,
  delta,
  series,
  seriesKey,
  hint,
  className,
  fallback,
}: StatCardProps) {
  const sparkColour = tone === 'attention' ? 'var(--color-destructive)' : 'var(--color-brand-teal)'

  return (
    <Panel className={cn('flex flex-col', PANEL_PADDING, className)}>
      <div className="flex items-start justify-between gap-3">
        {hint ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help border-b border-dotted border-muted-foreground/40">
                <PanelLabel>{label}</PanelLabel>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{hint}</TooltipContent>
          </Tooltip>
        ) : (
          <PanelLabel>{label}</PanelLabel>
        )}

        {Icon && (
          <span className="flex size-8 shrink-0 items-center justify-center">
            <Icon className={cn('size-5', ICON_TONE[tone])} aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p
          className={cn(
            'text-[1.875rem] leading-none font-bold tracking-[-0.022em] tabular-nums',
            tone === 'attention' && 'text-destructive',
          )}
          data-numeric
        >
          {fallback ?? (
            <>
              <NumberFlow
                value={value}
                plugins={[continuous]}
                format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }}
                // The figure is announced by the sr-only span below; without
                // this the digit spans get read out one at a time.
                aria-hidden="true"
              />
              <span className="sr-only">
                {value.toFixed(decimals)}
                {unit}
              </span>
              {unit && (
                <span
                  className="ml-1 text-lg font-medium text-muted-foreground"
                  aria-hidden="true"
                >
                  {unit}
                </span>
              )}
            </>
          )}
        </p>

        {delta && <DeltaPill delta={delta} />}
      </div>

      {series && seriesKey && (
        <Sparkline data={series} dataKey={seriesKey} stroke={sparkColour} className="mt-3" />
      )}

      {context && (
        <p className={cn('text-sm text-muted-foreground', series ? 'mt-2' : 'mt-3')}>{context}</p>
      )}
    </Panel>
  )
}

/**
 * The loading state, sized from the real card's own metrics rather than
 * eyeballed: 11px label, 36px figure, 48px sparkline, 20px context, at the same
 * paddings and gaps. A skeleton whose proportions differ from its content
 * produces a layout jump at the moment the user starts reading.
 */
export function StatCardSkeleton({ withSeries = true }: { withSeries?: boolean }) {
  return (
    <div className={cn('rounded-xl border bg-card shadow-[var(--shadow-card)]', PANEL_PADDING)}>
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>
      {withSeries && <Skeleton className="mt-3 h-12 w-full" />}
      <Skeleton className="mt-2 h-5 w-32" />
    </div>
  )
}
