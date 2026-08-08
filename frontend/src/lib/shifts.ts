/**
 * The hospital's shift windows.
 *
 * These mirror `SHIFT_TIME_DEFAULTS` in
 * `backend/src/services/scheduling/constraintBuilder.ts:11` — the constants the
 * AI scheduler uses when it auto-creates shifts from a department's staffing
 * requirements. They are duplicated here rather than fetched because the auth
 * screens show them before there is a session to fetch anything with.
 *
 * If the backend windows change, change these. There is no test that can catch
 * the drift across the two projects, so the coupling is deliberate and noted in
 * DESIGN.md under "The Shift Band".
 */

export type ShiftKey = 'morning' | 'afternoon' | 'night'

export interface ShiftWindow {
  key: ShiftKey
  label: string
  /** 24-hour `HH:MM`, matching the backend's format. */
  start: string
  end: string
  /** Start hour, inclusive. */
  startHour: number
  /** End hour, exclusive. `night` wraps past midnight. */
  endHour: number
}

export const SHIFT_WINDOWS: Record<ShiftKey, ShiftWindow> = {
  morning: {
    key: 'morning',
    label: 'Morning shift',
    start: '07:00',
    end: '15:00',
    startHour: 7,
    endHour: 15,
  },
  afternoon: {
    key: 'afternoon',
    label: 'Afternoon shift',
    start: '15:00',
    end: '23:00',
    startHour: 15,
    endHour: 23,
  },
  night: {
    key: 'night',
    label: 'Night shift',
    start: '23:00',
    end: '07:00',
    startHour: 23,
    endHour: 7,
  },
}

/** Which shift is on the floor at `at`, per the client's local clock. */
export function currentShift(at: Date = new Date()): ShiftWindow {
  const hour = at.getHours()
  if (hour >= SHIFT_WINDOWS.morning.startHour && hour < SHIFT_WINDOWS.morning.endHour) {
    return SHIFT_WINDOWS.morning
  }
  if (hour >= SHIFT_WINDOWS.afternoon.startHour && hour < SHIFT_WINDOWS.afternoon.endHour) {
    return SHIFT_WINDOWS.afternoon
  }
  return SHIFT_WINDOWS.night
}

/** Milliseconds until the current shift hands over, for scheduling a re-render. */
export function msUntilShiftChange(at: Date = new Date()): number {
  const next = new Date(at)
  next.setMinutes(0, 0, 0)

  const boundaries = [7, 15, 23]
  const nextHour = boundaries.find((h) => h > at.getHours())

  if (nextHour === undefined) {
    next.setDate(next.getDate() + 1)
    next.setHours(boundaries[0]!)
  } else {
    next.setHours(nextHour)
  }

  return next.getTime() - at.getTime()
}
