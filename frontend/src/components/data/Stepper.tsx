import type { ComponentType, SVGProps } from 'react'
import { cn } from '@/lib/utils'

export interface StepperStep {
  key: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Overrides the active-node label (e.g. "On break" instead of "On shift"). */
  activeLabel?: string
  /** Small timestamp/caption shown beneath the node. */
  caption?: string
  /** `warning` gives the active node an amber tone instead of the default primary one. */
  tone?: 'default' | 'warning'
}

/**
 * A linear progress indicator for a multi-stage approval/state machine — e.g.
 * attendance clock state, leave's two-stage approval, or a shift swap's
 * three-stage approval. Generalized out of AttendancePage's original
 * `StatusStepper` so every multi-stage status in the app can show *where* a
 * request currently sits instead of making the viewer infer it from which
 * action button happens to be present.
 */
export function Stepper({
  steps,
  activeIndex,
  compact = false,
}: {
  steps: StepperStep[]
  activeIndex: number
  /** Dot-only, no labels/captions — for dense contexts like a table cell. */
  compact?: boolean
}) {
  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const isDone = i < activeIndex
        const isActive = i === activeIndex
        const isWarning = isActive && step.tone === 'warning'
        const Icon = step.icon
        return (
          <div
            key={step.key}
            className={cn('flex items-center', compact ? 'flex-1 last:flex-none' : 'flex-1 last:flex-none')}
          >
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex items-center justify-center rounded-full border-2 transition-colors',
                  compact ? 'size-3' : 'size-8',
                  isDone && 'border-primary bg-primary text-primary-foreground',
                  isActive && isWarning && 'border-amber-500 bg-amber-500 text-white',
                  isActive && !isWarning && 'border-primary bg-primary/10 text-primary',
                  !isDone && !isActive && 'border-muted-foreground/30 text-muted-foreground/50',
                )}
              >
                {!compact && <Icon className="size-4" />}
              </div>
              {!compact && (
                <>
                  <span
                    className={cn(
                      'text-xs font-medium whitespace-nowrap',
                      isActive || isDone ? 'text-foreground' : 'text-muted-foreground/60',
                    )}
                  >
                    {isActive && step.activeLabel ? step.activeLabel : step.label}
                  </span>
                  <span className="text-[0.6875rem] text-muted-foreground">{step.caption}</span>
                </>
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'rounded-full bg-muted',
                  compact ? 'mx-1 h-0.5 w-3' : 'mx-2 h-0.5 flex-1',
                  i < activeIndex && 'bg-primary',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
