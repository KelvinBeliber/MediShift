import { get, getPaginated, post } from '@/lib/api/client'
import type { AttendanceFilters, AttendanceRecord, AttendanceSummaryRow } from './types'

export const attendanceApi = {
  clockIn: (employeeId?: string) => post<AttendanceRecord>('/attendance/clock-in', { employeeId, method: 'manual' }),
  clockOut: (employeeId?: string) => post<AttendanceRecord>('/attendance/clock-out', { employeeId, method: 'manual' }),
  breakStart: (employeeId?: string) => post<AttendanceRecord>('/attendance/break-start', { employeeId }),
  breakEnd: (employeeId?: string) => post<AttendanceRecord>('/attendance/break-end', { employeeId }),
  today: (employeeId?: string) =>
    get<AttendanceRecord | null>('/attendance/today', { params: { employeeId } }),
  list: (filters: AttendanceFilters) => getPaginated<AttendanceRecord>('/attendance', { params: filters }),
  /**
   * The caller's own history — always self-scoped server-side, so it works for
   * `employee`/`shift_coordinator` accounts that hold no `attendance:view`.
   * See `backend/src/routes/attendance.routes.ts` `GET /mine`.
   */
  mine: (filters: Pick<AttendanceFilters, 'dateFrom' | 'dateTo' | 'limit'> = {}) =>
    getPaginated<AttendanceRecord>('/attendance/mine', { params: filters }),
  summary: (dateFrom: string, dateTo: string, employee?: string) =>
    get<AttendanceSummaryRow[]>('/attendance/summary', { params: { dateFrom, dateTo, employee } }),
  markAbsentees: (date?: string) => post<{ marked: number }>('/attendance/mark-absentees', date ? { date } : {}),
}
