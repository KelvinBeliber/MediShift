import type { AttendanceRecord } from '@/features/attendance/types'
import type { ShiftSwapRequest } from '@/features/shiftSwaps/types'

/**
 * Gamification, derived only from real records — never invented.
 *
 * `GET /attendance/mine` (self-scoped, see the route's own comment) is the one
 * source of truth here. Everything below is arithmetic over that list, the
 * same way `selectMyShifts` in `queries.ts` derives "my shifts" from a shared
 * `GET /shifts` fetch rather than the backend inventing a personalised
 * endpoint for it.
 */

const ON_TIME_STATUSES = new Set<AttendanceRecord['status']>(['present', 'overtime'])
/** Neither an on-time day nor a miss — a streak should not break on a day off. */
const NEUTRAL_STATUSES = new Set<AttendanceRecord['status']>(['leave', 'holiday'])

export interface AttendanceHighlights {
  /** Consecutive most-recent days present/overtime, walking back from today. Leave/holiday are skipped, not counted. */
  onTimeStreak: number
  /** Why the streak reads 0 — undefined when it doesn't (streak > 0, or there is no history at all). */
  brokenBy?: 'late' | 'absent'
  /** Sum of `totalHoursWorked` for records within the last 7 days. */
  hoursLast7Days: number
  /** Records with a `clockOut` — a shift actually seen through, not just scheduled. */
  shiftsCompleted: number
  lateCount: number
  absentCount: number
  totalRecords: number
}

export function computeAttendanceHighlights(
  records: AttendanceRecord[],
  now: Date = new Date(),
): AttendanceHighlights {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date))

  let onTimeStreak = 0
  let brokenBy: 'late' | 'absent' | undefined
  for (const record of sorted) {
    if (NEUTRAL_STATUSES.has(record.status)) continue
    if (ON_TIME_STATUSES.has(record.status)) {
      onTimeStreak += 1
      continue
    }
    if (record.status === 'late' || record.status === 'absent') brokenBy = record.status
    break
  }
  if (onTimeStreak > 0) brokenBy = undefined

  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const hoursLast7Days = records
    .filter((r) => new Date(r.date) >= sevenDaysAgo)
    .reduce((sum, r) => sum + (r.totalHoursWorked ?? 0), 0)

  return {
    onTimeStreak,
    brokenBy,
    hoursLast7Days: Math.round(hoursLast7Days * 10) / 10,
    shiftsCompleted: records.filter((r) => Boolean(r.clockOut)).length,
    lateCount: records.filter((r) => r.status === 'late').length,
    absentCount: records.filter((r) => r.status === 'absent').length,
    totalRecords: records.length,
  }
}

export type StreakTier = 'none' | 'bronze' | 'silver' | 'gold'

/** Order matters — index compared to detect an upgrade vs. a reset in `useStreakCelebration`. */
export const STREAK_TIER_ORDER: StreakTier[] = ['none', 'bronze', 'silver', 'gold']

const STREAK_THRESHOLDS: { tier: StreakTier; min: number }[] = [
  { tier: 'gold', min: 14 },
  { tier: 'silver', min: 7 },
  { tier: 'bronze', min: 3 },
]

export function streakTier(streak: number): StreakTier {
  return STREAK_THRESHOLDS.find((t) => streak >= t.min)?.tier ?? 'none'
}

/** No late arrivals or absences across a sample big enough to mean something. */
export function hasCleanSweep(highlights: AttendanceHighlights): boolean {
  return highlights.totalRecords >= 5 && highlights.lateCount === 0 && highlights.absentCount === 0
}

/** A swap this employee raised or received that actually went through. */
export function hasCompletedSwap(swaps: ShiftSwapRequest[]): boolean {
  return swaps.some((s) => s.status === 'accepted' || s.status === 'manager_approved')
}
