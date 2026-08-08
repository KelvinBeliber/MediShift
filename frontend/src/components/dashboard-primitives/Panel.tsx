import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { panelVariants } from '@/lib/motion'

/**
 * The surface every data screen is built out of.
 *
 * ## Elevation
 *
 * Four levels. The first three are real shadows (`--shadow-card`,
 * `--shadow-card-hover`, `--shadow-focal` in `index.css`), all tinted with the
 * brand navy so they read cool rather than grey:
 *
 * | Level      | Treatment                                   | Used for                      |
 * |------------|---------------------------------------------|-------------------------------|
 * | `flat`     | hairline only, no shadow                    | nested blocks inside a panel  |
 * | `resting`  | hairline + `shadow-card`                    | every normal panel            |
 * | `focal`    | hairline + `shadow-focal` + gradient ground | one anchor panel per screen   |
 * | `interactive` | resting, lifting to `shadow-card-hover` | panels that are also links    |
 *
 * The earlier version of this file was flat at every level, on the reading that
 * shadows make a dense grid noisy. On a schedule table that holds; on a metrics
 * dashboard it produced a screen with no visual hierarchy at all. The rule that
 * replaced it: **shadow carries hierarchy, never decoration** — a panel's
 * elevation says how important it is, and a screen has exactly one focal panel.
 *
 * Nested panels stay `flat`, so DESIGN.md's "cards are never nested" survives as
 * "nested surfaces never stack shadows".
 */

const ELEMENTS = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  li: motion.li,
} as const

export type PanelElevation = 'flat' | 'resting' | 'focal'

const ELEVATION: Record<PanelElevation, string> = {
  flat: 'border bg-card',
  resting: 'border bg-card shadow-[var(--shadow-card)]',
  focal:
    'border bg-gradient-to-b from-secondary/70 to-card shadow-[var(--shadow-focal)]',
}

interface PanelProps {
  children: ReactNode
  className?: string
  elevation?: PanelElevation
  /** Adds hover/focus affordances. Only for panels that are themselves clickable. */
  interactive?: boolean
  /**
   * Opts the panel into the parent's staggered mount. Off for panels that
   * appear mid-session (a section revealed by a filter), where an entrance
   * would read as the page reloading.
   */
  animate?: boolean
  as?: keyof typeof ELEMENTS
  /** Landmark and labelling props — a panel is often a labelled region or an alert. */
  id?: string
  role?: string
  'aria-labelledby'?: string
  'aria-label'?: string
}

export function Panel({
  children,
  className,
  elevation = 'resting',
  interactive = false,
  animate = true,
  as = 'div',
  id,
  role,
  'aria-labelledby': ariaLabelledBy,
  'aria-label': ariaLabel,
}: PanelProps) {
  const Component = ELEMENTS[as]

  return (
    <Component
      id={id}
      role={role}
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      variants={animate ? panelVariants : undefined}
      className={cn(
        'rounded-xl text-card-foreground',
        ELEVATION[elevation],
        interactive &&
          'cursor-pointer transition-[box-shadow,border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-card-hover)] motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      {children}
    </Component>
  )
}

/**
 * Panel padding, as one decision.
 *
 * Widened from the original 20px: at `p-5` with 28px figures the summary cards
 * had no room to breathe and the screen read as cramped. 24px on data surfaces,
 * 28px on the focal panel.
 */
export const PANEL_PADDING = 'p-5'
export const PANEL_PADDING_FOCAL = 'p-5 sm:p-6'

/**
 * A section heading with the vertical rhythm DESIGN.md asks for: more space
 * above a heading than below it, so the heading binds to what it introduces.
 * `mt-12 mb-5` (48px / 20px) is that rule made concrete.
 */
export function SectionHeading({
  children,
  description,
  action,
  className,
}: {
  children: ReactNode
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mt-8 mb-4 flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-xl leading-[1.3] font-bold tracking-[-0.016em]">{children}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/**
 * The label above a figure or a panel's contents.
 *
 * One component so every "ATTENDANCE" / "WAITING ON YOU" label on every screen
 * shares a size, weight and colour instead of each being typed by hand.
 */
export function PanelLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'text-[0.6875rem] leading-none font-semibold tracking-[0.08em] text-muted-foreground uppercase',
        className,
      )}
    >
      {children}
    </p>
  )
}
