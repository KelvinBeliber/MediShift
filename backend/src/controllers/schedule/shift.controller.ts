import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { getPaginationParams } from '@utils/pagination';
import { paramId } from '@utils/requestParams';
import { ApiError } from '@utils/ApiError';
import * as shiftService from '@services/schedule/shift.service';
import * as assignmentService from '@services/schedule/shiftAssignment.service';

export const getShifts = asyncHandler(async (req: Request, res: Response) => {
  const pagination = getPaginationParams(req);
  const { schedule, department, dateFrom, dateTo, shiftType } = (req.validatedQuery ?? {}) as Record<
    string,
    string | undefined
  >;

  const { docs, meta } = await shiftService.listShifts(
    {
      schedule,
      department,
      shiftType,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    },
    pagination
  );

  sendSuccess(res, 200, 'Shifts retrieved', docs, meta);
});

export const getShift = asyncHandler(async (req: Request, res: Response) => {
  const shift = await shiftService.getShift(paramId(req.params.id));
  sendSuccess(res, 200, 'Shift retrieved', shift);
});

export const createShift = asyncHandler(async (req: Request, res: Response) => {
  const shift = await shiftService.createShift(req.body);
  sendSuccess(res, 201, 'Shift created', shift);
});

export const updateShift = asyncHandler(async (req: Request, res: Response) => {
  const shift = await shiftService.updateShift(paramId(req.params.id), req.body);
  sendSuccess(res, 200, 'Shift updated', shift);
});

export const deleteShift = asyncHandler(async (req: Request, res: Response) => {
  await shiftService.deleteShift(paramId(req.params.id));
  sendSuccess(res, 200, 'Shift deleted');
});

export const assignEmployee = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const assignment = await assignmentService.assignEmployee(
    paramId(req.params.id),
    req.body.employeeId,
    req.user.id,
    req.body.notes
  );
  sendSuccess(res, 201, 'Employee assigned to shift', assignment);
});

export const updateAssignmentStatus = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await assignmentService.updateAssignmentStatus(
    paramId(req.params.assignmentId, 'assignmentId'),
    req.body.status,
    req.body.notes
  );
  sendSuccess(res, 200, 'Shift assignment updated', assignment);
});

export const removeAssignment = asyncHandler(async (req: Request, res: Response) => {
  await assignmentService.removeAssignment(paramId(req.params.assignmentId, 'assignmentId'));
  sendSuccess(res, 200, 'Shift assignment removed');
});
