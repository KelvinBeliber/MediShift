import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { getPaginationParams } from '@utils/pagination';
import { paramId } from '@utils/requestParams';
import { ApiError } from '@utils/ApiError';
import { PERMISSIONS } from '@constants/permissions';
import * as attendanceService from '@services/attendance/attendance.service';

function resolveTargetEmployee(req: Request): string {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const requested = req.body.employeeId as string | undefined;
  const target = requested ?? req.user.employeeId;

  if (!target) {
    throw ApiError.badRequest('No employee profile is linked to this account');
  }
  if (requested && requested !== req.user.employeeId && !req.user.permissions.includes(PERMISSIONS.ATTENDANCE_MANAGE)) {
    throw ApiError.forbidden('You can only record attendance for yourself');
  }
  return target;
}

export const clockIn = asyncHandler(async (req: Request, res: Response) => {
  const employeeId = resolveTargetEmployee(req);
  const attendance = await attendanceService.clockIn(employeeId, req.body.method, req.body.location);
  sendSuccess(res, 200, 'Clocked in', attendance);
});

export const clockOut = asyncHandler(async (req: Request, res: Response) => {
  const employeeId = resolveTargetEmployee(req);
  const attendance = await attendanceService.clockOut(employeeId, req.body.method, req.body.location);
  sendSuccess(res, 200, 'Clocked out', attendance);
});

export const breakStart = asyncHandler(async (req: Request, res: Response) => {
  const employeeId = resolveTargetEmployee(req);
  const attendance = await attendanceService.breakStart(employeeId);
  sendSuccess(res, 200, 'Break started', attendance);
});

export const breakEnd = asyncHandler(async (req: Request, res: Response) => {
  const employeeId = resolveTargetEmployee(req);
  const attendance = await attendanceService.breakEnd(employeeId);
  sendSuccess(res, 200, 'Break ended', attendance);
});

export const getToday = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const requested = req.query.employeeId as string | undefined;
  const employeeId = requested ?? req.user.employeeId;
  if (!employeeId) throw ApiError.badRequest('No employee profile is linked to this account');
  if (requested && requested !== req.user.employeeId && !req.user.permissions.includes(PERMISSIONS.ATTENDANCE_MANAGE)) {
    throw ApiError.forbidden('You can only view attendance for yourself');
  }

  const attendance = await attendanceService.getToday(employeeId);
  sendSuccess(res, 200, "Today's attendance retrieved", attendance);
});

export const getAttendanceList = asyncHandler(async (req: Request, res: Response) => {
  const pagination = getPaginationParams(req);
  const { employee, dateFrom, dateTo, status } = (req.validatedQuery ?? {}) as Record<string, string | undefined>;

  const { docs, meta } = await attendanceService.listAttendance(
    {
      employee,
      status,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    },
    pagination
  );
  sendSuccess(res, 200, 'Attendance records retrieved', docs, meta);
});

export const getAttendanceRecord = asyncHandler(async (req: Request, res: Response) => {
  const attendance = await attendanceService.getAttendance(paramId(req.params.id));
  sendSuccess(res, 200, 'Attendance record retrieved', attendance);
});

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const { employee, dateFrom, dateTo } = (req.validatedQuery ?? {}) as Record<string, string>;
  const summary = await attendanceService.getSummary(employee, new Date(dateFrom), new Date(dateTo));
  sendSuccess(res, 200, 'Attendance summary retrieved', summary);
});

export const markAbsentees = asyncHandler(async (req: Request, res: Response) => {
  const date = req.body.date ? new Date(req.body.date) : new Date();
  const result = await attendanceService.markAbsentees(date);
  sendSuccess(res, 200, 'Absentees marked', result);
});
