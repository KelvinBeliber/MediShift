import { cn } from '@/lib/utils'

/**
 * Adapted from KokonutUI's `loader` (https://kokonutui.com/r/loader.json).
 *
 * Two things changed from the original, both deliberate:
 *
 * - **Motion.** The original animates four counter-rotating conic-gradient
 *   rings and breathes the opacity of its own copy. That is decorative motion
 *   on a surface where someone is waiting on a task, so this keeps the ring
 *   silhouette — which is the MediShift logo's own form — and cuts the rest to
 *   a single arc sweeping a static track.
 * - **Implementation.** The original drives that with `motion/react`. An
 *   infinite rotation is a CSS animation, and pulling the whole animation
 *   runtime into the initial bundle to spin a 40px ring is not a trade worth
 *   making. `animate-spin` honours `prefers-reduced-motion` through the
 *   `motion-reduce` variant instead.
 *
 * Colour comes from the tokens rather than the original's hardcoded black.
 */

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  subtitle?: string
  size?: 'sm' | 'md'
}

const SIZES = {
  sm: { ring: 'size-10', border: 'border-[3px]' },
  md: { ring: 'size-14', border: 'border-4' },
} as const

export default function Loader({ title, subtitle, size = 'md', className, ...props }: LoaderProps) {
  const config = SIZES[size]

  return (
    <div
      className={cn('flex flex-col items-center gap-5 text-center', className)}
      role="status"
      aria-live="polite"
      {...props}
    >
      <div className={cn('relative', config.ring)} aria-hidden="true">
        <div className={cn('absolute inset-0 rounded-full border-border', config.border)} />
        {/* Reduced motion means less motion, not none — a completely static
            ring would signal nothing is happening. The spin is replaced by a
            slow opacity pulse, which carries no vestibular risk. */}
        <div
          className={cn(
            'absolute inset-0 animate-spin rounded-full border-transparent border-t-brand-teal [animation-duration:0.9s]',
            'motion-reduce:animate-pulse motion-reduce:[animation-duration:2s]',
            config.border,
          )}
        />
      </div>

      {(title || subtitle) && (
        <div className="space-y-1.5">
          {title && <p className="text-[0.9375rem] font-semibold text-foreground">{title}</p>}
          {subtitle && (
            <p className="max-w-64 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          )}
        </div>
      )}
    </div>
  )
}
