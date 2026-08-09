import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { REDUCED_MOTION_QUERY } from '@/lib/motion'

/**
 * Adapted from KokonutUI's `ai-text-loading` (https://kokonutui.com/r/ai-text-loading.json).
 *
 * The original is a 30px bold gradient-clipped headline cycling
 * "Thinking… / Processing… / Analyzing… / Computing… / Almost…", with a
 * `bg-clip-text` sweep animated through `motion/react`. Three problems, all
 * fixed here:
 *
 * - **Gradient text is banned by DESIGN.md.** The one gradient in the brand is
 *   the logo ring and it stays in the logo. This is flat `Corridor Grey`.
 * - **30px bold outranks the page title.** A waiting indicator that is the
 *   largest type on screen is competing with the content it is a placeholder
 *   for. It sets at the same size as the answer it will be replaced by.
 * - **"Processing… / Computing…" says nothing.** The labels here are passed in
 *   by the caller and name the actual tool being run ("Reading overtime for
 *   Cardiology"), which is the only version of this component that tells the
 *   user something they could not already infer from the spinner.
 *
 * The cycling itself is kept — with a real label sequence it is the Live Figure
 * Rule applied to a wait: something visibly moves, so the screen cannot be
 * mistaken for one that has stalled. Under `prefers-reduced-motion` it holds on
 * the first label rather than cycling.
 */

interface AITextLoadingProps {
  texts: string[]
  intervalMs?: number
  className?: string
}

export default function AITextLoading({ texts, intervalMs = 2200, className }: AITextLoadingProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [texts])

  useEffect(() => {
    if (texts.length <= 1) return
    if (window.matchMedia?.(REDUCED_MOTION_QUERY).matches) return

    const timer = window.setInterval(() => {
      setIndex((previous) => (previous + 1) % texts.length)
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [texts, intervalMs])

  const label = texts[index] ?? texts[0] ?? 'Working…'

  return (
    <span
      className={cn('text-[0.9375rem] leading-relaxed text-muted-foreground', className)}
      role="status"
      aria-live="polite"
    >
      {label}
    </span>
  )
}
