import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { getPaginationParams } from '@utils/pagination';
import { paramId } from '@utils/requestParams';
import { ApiError } from '@utils/ApiError';
import { PERMISSIONS } from '@constants/permissions';
import * as leaveService from '@services/leave/leave.service';
import { recordAudit } from '@services/audit/audit.service';

export const getLeaveRequests = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const pagination = getPaginationParams(req);
  const { employee, status, leaveType } = (req.validatedQuery ?? {}) as Record<string, string | undefined>;

  const canViewAll = req.user.permissions.includes(PERMISSIONS.LEAVE_VIEW);
  const scopedEmployee = canViewAll ? employee : req.user.employeeId;

  const { docs, meta } = await leaveService.listLeaveRequests({ employee: scopedEmployee, status, leaveType }, pagination);
  sendSuccess(res, 200, 'Leave requests retrieved', docs, meta);
});

export const getLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const leave = await leaveService.getLeaveRequest(paramId(req.params.id));

  const canViewAll = req.user.permissions.includes(PERMISSIONS.LEAVE_VIEW);
  const ownerId = (leave.employee as unknown as { _id?: { toString(): string } })?._id?.toString() ?? leave.employee.toString();
  if (!canViewAll && ownerId !== req.user.employeeId) {
    throw ApiError.forbidden('You can only view your own leave requests');
  }

  sendSuccess(res, 200, 'Leave request retrieved', leave);
});

export const createLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const requested = req.body.employeeId as string | undefined;
  const employeeId = requested ?? req.user.employeeId;
  if (!employeeId) throw ApiError.badRequest('No employee profile is linked to this account');
  if (requested && requested !== req.user.employeeId && !req.user.permissions.includes(PERMISSIONS.LEAVE_APPROVE)) {
    throw ApiError.forbidden('You can only submit leave requests for yourself');
  }

  const leave = await leaveService.createLeaveRequest({ ...req.body, employeeId });
  sendSuccess(res, 201, 'Leave request submitted', leave);
});

export const cancelLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.employeeId) throw ApiError.badRequest('No employee profile is linked to this account');
  const leave = await leaveService.cancelLeaveRequest(paramId(req.params.id), req.user.employeeId);
  sendSuccess(res, 200, 'Leave request cancelled', leave);
});

export const departmentApprove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const leave = await leaveService.departmentApprove(paramId(req.params.id), req.user.id, req.body.comment);
  recordAudit({ userId: req.user.id, action: 'APPROVE', entityType: 'LeaveRequest', entityId: leave.id, after: leave, req });
  sendSuccess(res, 200, 'Leave request approved by department', leave);
});

export const hrApprove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const leave = await leaveService.hrApprove(paramId(req.params.id), req.user.id, req.body.comment);
  recordAudit({ userId: req.user.id, action: 'APPROVE', entityType: 'LeaveRequest', entityId: leave.id, after: leave, req });
  sendSuccess(res, 200, 'Leave request approved by HR', leave);
});

export const rejectLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  const leave = await leaveService.rejectLeaveRequest(paramId(req.params.id), req.body.rejectionReason);
  recordAudit({ userId: req.user?.id, action: 'REJECT', entityType: 'LeaveRequest', entityId: leave.id, after: leave, req });
  sendSuccess(res, 200, 'Leave request rejected', leave);
});
