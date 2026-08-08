import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import * as reportService from '@services/report/report.service';

function rangeParams(req: Request) {
  const { dateFrom, dateTo, department } = (req.validatedQuery ?? {}) as Record<string, string | undefined>;
  return { dateFrom: new Date(dateFrom as string), dateTo: new Date(dateTo as string), department };
}

export const getAttendanceTrends = asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo, department } = rangeParams(req);
  const data = await reportService.attendanceTrends(dateFrom, dateTo, department);
  sendSuccess(res, 200, 'Attendance trends retrieved', data);
});

export const getLeaveStatistics = asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo, department } = rangeParams(req);
  const data = await reportService.leaveStatistics(dateFrom, dateTo, department);
  sendSuccess(res, 200, 'Leave statistics retrieved', data);
});

export const getOvertimeTrends = asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo, department } = rangeParams(req);
  const data = await reportService.overtimeTrends(dateFrom, dateTo, department);
  sendSuccess(res, 200, 'Overtime trends retrieved', data);
});

export const getShiftCoverage = asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo, department } = rangeParams(req);
  const data = await reportService.shiftCoverage(dateFrom, dateTo, department);
  sendSuccess(res, 200, 'Shift coverage retrieved', data);
});

export const getDepartmentUtilization = asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = rangeParams(req);
  const data = await reportService.departmentUtilization(dateFrom, dateTo);
  sendSuccess(res, 200, 'Department utilization retrieved', data);
});

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const { department } = (req.validatedQuery ?? {}) as Record<string, string | undefined>;
  const data = await reportService.dashboardSummary(department);
  sendSuccess(res, 200, 'Dashboard summary retrieved', data);
});
