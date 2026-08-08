import { get } from '@/lib/api/client'
import type {
  AttendanceTrendPoint,
  DepartmentUtilization,
  LeaveStatistic,
  OvertimeTrendPoint,
  ReportRangeFilters,
  ShiftCoveragePoint,
} from './types'

export const reportsApi = {
  attendanceTrends: (f: ReportRangeFilters) => get<AttendanceTrendPoint[]>('/reports/attendance-trends', { params: f }),
  leaveStatistics: (f: ReportRangeFilters) => get<LeaveStatistic[]>('/reports/leave-statistics', { params: f }),
  overtimeTrends: (f: ReportRangeFilters) => get<OvertimeTrendPoint[]>('/reports/overtime-trends', { params: f }),
  shiftCoverage: (f: ReportRangeFilters) => get<ShiftCoveragePoint[]>('/reports/shift-coverage', { params: f }),
  /** No `department` filter server-side — always every department. */
  departmentUtilization: (dateFrom: string, dateTo: string) =>
    get<DepartmentUtilization[]>('/reports/department-utilization', { params: { dateFrom, dateTo } }),
}
