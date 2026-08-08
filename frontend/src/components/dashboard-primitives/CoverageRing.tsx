import { motion } from 'motion/react'
import { DURATION, EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Staffing coverage for the next 14 days, as a dial.
 *
 * ## Why a ring
 *
 * The product's north star is "The Ward Clock" — instruments you can read from
 * across a corridor. Coverage is the one figure on this screen that is a
 * *proportion of a whole*, and a proportion read at distance is a dial, not a
 * row of digits.
 *
 * ## The shortfall is the headline
 *
 * A charge nurse does not act on "92% covered", they act on "8 shifts short".
 * The centre carries the open-shift count; the percentage is the caption. The
 * gap in the ring *is* the shortfall — one quantity drawn once, rather than a
 * percentage and a count competing for the same spot.
 *
 * ## Colour
 *
 * A gradient sweep from `brand-teal` to `brand-teal-deep` along the arc, so the
 * dial has depth without the ring becoming a second accent. It flips to a
 * `destructive` gradient below `AT_RISK_BELOW`, so red on this screen always
 * means the same thing. The track is a soft tint of the same hue rather than a
 * flat hairline — at 14px stroke a hairline track made the ring look unfinished.
 *
 * ## Adapted from KokonutUI
 *
 * The concentric-progress idea comes from KokonutUI's `apple-activity-card`
 * (https://kokonutui.com/r/apple-activity-card.json). The original is three
 * hardcoded Apple-fitness rings with literal `#FF2D55`/`#A3F900` strokes, a
 * scale-in bounce and no data interface. This is one ring on our own tokens,
 * driven by the real `upcomingCoveragePercent` and `openShiftsNext14Days`,
 * credited the same way `components/kokonutui/loader.tsx` credits its source.
 */

/** Below this, the ring reads as at-risk. Matches the wording in the caption. */
const AT_RISK_BELOW = 90

interface CoverageRingProps {
  /** `upcomingCoveragePercent` — 0–100, may exceed 100 if over-staffed. */
  percent: number
  /** `openShiftsNext14Days`. */
  openShifts: number
  className?: string
  size?: number
}

export function CoverageRing({ percent, openShifts, className, size = 208 }: CoverageRingProps) {
  const stroke = 14
  const radius = (size - stroke) / 2
  const circumference = radius * 2 * Math.PI
  // Clamped for drawing only — an over-staffed 104% ring should read as full,
  // not wrap around and understate itself.
  const drawn = Math.max(0, Math.min(100, percent)) / 100
  const atRisk = percent < AT_RISK_BELOW
  const fullyStaffed = openShifts === 0

  const from = atRisk ? 'var(--color-destructive)' : 'var(--color-brand-teal)'
  const to = atRisk ? 'var(--color-destructive)' : 'var(--color-brand-teal-deep)'

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label={`Upcoming staffing coverage ${percent}% — ${openShifts} open shift${openShifts === 1 ? '' : 's'} in the next 14 days`}
        >
          <defs>
            <linearGradient id="coverage-arc" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>

          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className={atRisk ? 'stroke-destructive/12' : 'stroke-brand-teal/12'}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke="url(#coverage-arc)"
            strokeDasharray={circumference}
            // The sweep is the shape of the measurement, so watching it draw
            // tells you the size of the gap. It runs once and settles.
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - drawn) }}
            transition={{ duration: DURATION.layout * 2.5, ease: EASE_OUT }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span
            className={cn(
              'text-[2.5rem] leading-none font-bold tracking-[-0.03em] tabular-nums',
              atRisk && 'text-destructive',
            )}
            data-numeric
            aria-hidden="true"
          >
            {openShifts}
          </span>
          <span
            className="mt-2 text-[0.6875rem] leading-none font-semibold tracking-[0.08em] text-muted-foreground uppercase"
            aria-hidden="true"
          >
            {fullyStaffed ? 'Fully staffed' : openShifts === 1 ? 'Open shift' : 'Open shifts'}
          </span>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <span className="text-base font-semibold text-foreground tabular-nums" data-numeric>
          {percent}%
        </span>{' '}
        of required staffing assigned
        <span className="mt-0.5 block text-xs">over the next 14 days</span>
      </p>
    </div>
  )
}
