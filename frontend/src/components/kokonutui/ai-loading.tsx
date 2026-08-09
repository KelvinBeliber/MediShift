import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import AITextLoading from './ai-text-loading'

/**
 * Adapted from KokonutUI's `ai-loading` (https://kokonutui.com/r/ai-loading.json).
 *
 * The original renders six counter-rotating conic rings in hardcoded
 * `#FF2E7E` / `#00E5FF` / `#4ADE80` / `#FFA726` / `#FFEB3B` / `#FF4081`, driving
 * a fake progress ring through a canned script — "Scanning web pages…",
 * "Visiting 5 websites…", "Checking accessibility compliance…" — none of which
 * describes anything that is happening.
 *
 * Both halves are replaced:
 *
 * - **The six-colour ring becomes one arc** on a static track, in
 *   `brand-teal-deep`. Six saturated hues that mean nothing are exactly the
 *   decoration the Scarcity Rule exists to prevent, and the ring silhouette is
 *   the MediShift logo's own form — the same reduction already made in
 *   `loader.tsx`.
 * - **The invented progress script becomes an elapsed counter.** `POST
 *   /assistant/ask` is not streamed, so the client genuinely does not know
 *   which tool is running until the whole answer returns — which is precisely
 *   why the original's step list would have to be fabricated here. One honest
 *   label plus a figure that actually moves is worth more than five invented
 *   ones, and it is the Live Figure Rule applied to a wait: the seconds are
 *   what proves the screen has not stalled. There is no percentage, for the
 *   same reason — the backend cannot know how many tool rounds a question needs.
 *
 * The tools that really ran are shown afterwards, on the answer itself, where
 * they are a fact rather than a guess.
 */

interface AILoadingProps {
  label?: string
  className?: string
}

export default function AILoading({
  label = 'Reading your workforce data',
  className,
}: AILoadingProps) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="relative size-5 shrink-0" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border-2 border-border" />
        {/* Reduced motion means less motion, not none — a static ring would
            signal that nothing is happening. Same trade as loader.tsx. */}
        <span
          className={cn(
            'absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand-teal-deep [animation-duration:0.9s]',
            'motion-reduce:animate-pulse motion-reduce:[animation-duration:2s]',
          )}
        />
      </span>
      <AITextLoading texts={[label]} />
      {/* Only once the wait is long enough to be worth reassuring about. */}
      {seconds >= 3 && (
        <span className="text-xs text-muted-foreground tabular-nums" aria-hidden="true">
          {seconds}s
        </span>
      )}
    </div>
  )
}
