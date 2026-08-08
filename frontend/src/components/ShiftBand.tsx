import { useEffect, useReducer } from 'react'
import { cn } from '@/lib/utils'
import { currentShift, msUntilShiftChange, type ShiftKey } from '@/lib/shifts'

/**
 * Which shift is on the floor right now, and how long it has left.
 *
 * The dot colours are the logo ring's own sweep — teal, blue, violet — reused
 * in the ring's order for morning, afternoon, night. The windows are real
 * backend constants, not decoration; see `@/lib/shifts`.
 *
 * The handover countdown is what proves this is computed rather than a
 * hardcoded string: the shift name only changes three times a day, so on any
 * single visit it would be indistinguishable from static copy. It is also the
 * more useful figure to someone reading this mid-shift.
 */
const DOT: Record<ShiftKey, string> = {
  morning: 'bg-shift-morning',
  afternoon: 'bg-shift-afternoon',
  night: 'bg-shift-night',
}

function formatHandover(ms: number): string {
  const totalMinutes = Math.max(1, Math.round(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export function ShiftBand({ className }: { className?: string }) {
  // Ticking on a plain interval rather than arming a timeout at the exact
  // handover: `currentShift()` returns a shared object out of SHIFT_WINDOWS, so
  // a boundary timer keyed on the shift value could hand React an identical
  // reference, bail out of the re-render, and never schedule its replacement —
  // latching the band on a stale shift for the rest of the session.
  const [, tick] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    const timer = setInterval(tick, 60_000)
    return () => clearInterval(timer)
  }, [])

  const shift = currentShift()
  const handover = formatHandover(msUntilShiftChange())

  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase',
        className,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', DOT[shift.key])} aria-hidden="true" />
      <span>{shift.label}</span>
      <span className="text-border" aria-hidden="true">
        ·
      </span>
      <time className="font-medium tracking-[0.02em] tabular-nums">
        {shift.start}&ndash;{shift.end}
      </time>
      <span className="text-border" aria-hidden="true">
        ·
      </span>
      <span className="font-medium tracking-[0.02em] normal-case">
        hands over in <span className="tabular-nums">{handover}</span>
      </span>
    </p>
  )
}
