import { useEffect, useState } from 'react'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

/** Ambient date/time, ticking every second — echoes the shift-clock framing already on Dashboard. */
export function HeaderClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="hidden flex-col items-end leading-tight md:flex">
      <span className="text-sm font-medium tabular-nums text-topbar-foreground">{timeFormatter.format(now)}</span>
      <span className="text-xs text-topbar-foreground/60">{dateFormatter.format(now)}</span>
    </div>
  )
}
