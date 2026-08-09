import { describe, expect, it } from 'vitest'
import type { AttendanceRecord } from '@/features/attendance/types'
import type { ShiftSwapRequest } from '@/features/shiftSwaps/types'
import {
  computeAttendanceHighlights,
  hasCleanSweep,
  hasCompletedSwap,
  streakTier,
} from './attendanceStats'

function record(overrides: Partial<AttendanceRecord> & { date: string }): AttendanceRecord {
  return {
    id: overrides.date,
    employee: 'emp-1',
    breaks: [],
    status: 'present',
    ...overrides,
  }
}

const NOW = new Date('2026-08-09T12:00:00.000Z')

describe('computeAttendanceHighlights', () => {
  it('counts consecutive on-time days back from the most recent record', () => {
    const records = [
      record({ date: '2026-08-09', status: 'present' }),
      record({ date: '2026-08-08', status: 'overtime' }),
      record({ date: '2026-08-07', status: 'present' }),
      record({ date: '2026-08-06', status: 'late' }),
    ]
    expect(computeAttendanceHighlights(records, NOW).onTimeStreak).toBe(3)
  })

  it('does not break the streak on a leave or holiday day, and does not count it either', () => {
    const records = [
      record({ date: '2026-08-09', status: 'present' }),
      record({ date: '2026-08-08', status: 'holiday' }),
      record({ date: '2026-08-07', status: 'present' }),
    ]
    expect(computeAttendanceHighlights(records, NOW).onTimeStreak).toBe(2)
  })

  it('reports why the streak is zero', () => {
    const late = computeAttendanceHighlights([record({ date: '2026-08-09', status: 'late' })], NOW)
    expect(late.onTimeStreak).toBe(0)
    expect(late.brokenBy).toBe('late')

    const absent = computeAttendanceHighlights([record({ date: '2026-08-09', status: 'absent' })], NOW)
    expect(absent.brokenBy).toBe('absent')
  })

  it('has no brokenBy when there is no history at all', () => {
    expect(computeAttendanceHighlights([], NOW).brokenBy).toBeUndefined()
  })

  it('sums hours worked only within the last 7 days', () => {
    const records = [
      record({ date: '2026-08-09', totalHoursWorked: 8 }),
      record({ date: '2026-08-03', totalHoursWorked: 7.5 }), // exactly 6 days back — included
      record({ date: '2026-07-20', totalHoursWorked: 100 }), // long past — excluded
    ]
    expect(computeAttendanceHighlights(records, NOW).hoursLast7Days).toBe(15.5)
  })

  it('counts shifts completed as records with a clockOut', () => {
    const records = [
      record({ date: '2026-08-09', clockOut: { time: '2026-08-09T15:00:00Z', method: 'manual' } }),
      record({ date: '2026-08-08' }), // still clocked in — not completed
    ]
    expect(computeAttendanceHighlights(records, NOW).shiftsCompleted).toBe(1)
  })
})

describe('streakTier', () => {
  it('maps streak length to the right tier boundary', () => {
    expect(streakTier(0)).toBe('none')
    expect(streakTier(2)).toBe('none')
    expect(streakTier(3)).toBe('bronze')
    expect(streakTier(6)).toBe('bronze')
    expect(streakTier(7)).toBe('silver')
    expect(streakTier(13)).toBe('silver')
    expect(streakTier(14)).toBe('gold')
    expect(streakTier(30)).toBe('gold')
  })
})

describe('hasCleanSweep', () => {
  it('requires at least 5 records and zero late/absent', () => {
    expect(
      hasCleanSweep({
        onTimeStreak: 4,
        hoursLast7Days: 0,
        shiftsCompleted: 4,
        lateCount: 0,
        absentCount: 0,
        totalRecords: 4,
      }),
    ).toBe(false)

    expect(
      hasCleanSweep({
        onTimeStreak: 5,
        hoursLast7Days: 0,
        shiftsCompleted: 5,
        lateCount: 0,
        absentCount: 0,
        totalRecords: 5,
      }),
    ).toBe(true)

    expect(
      hasCleanSweep({
        onTimeStreak: 0,
        hoursLast7Days: 0,
        shiftsCompleted: 5,
        lateCount: 1,
        absentCount: 0,
        totalRecords: 6,
      }),
    ).toBe(false)
  })
})

describe('hasCompletedSwap', () => {
  const base = {
    id: 's1',
    requestingEmployee: 'emp-1',
    requestingShift: 'sh-1',
  }

  it('is true only for a swap that actually went through', () => {
    const swaps: ShiftSwapRequest[] = [{ ...base, status: 'pending' }]
    expect(hasCompletedSwap(swaps)).toBe(false)

    expect(hasCompletedSwap([{ ...base, status: 'accepted' }])).toBe(true)
    expect(hasCompletedSwap([{ ...base, status: 'manager_approved' }])).toBe(true)
    expect(hasCompletedSwap([{ ...base, status: 'rejected' }])).toBe(false)
  })
})
