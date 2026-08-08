import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { getPaginationParams } from '@utils/pagination';
import { paramId } from '@utils/requestParams';
import { ApiError } from '@utils/ApiError';
import { PERMISSIONS } from '@constants/permissions';
import * as shiftSwapService from '@services/shiftSwap/shiftSwap.service';

export const getSwapRequests = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const pagination = getPaginationParams(req);
  const { employee, status } = (req.validatedQuery ?? {}) as Record<string, string | undefined>;

  const canViewAll = req.user.permissions.includes(PERMISSIONS.SHIFT_SWAP_VIEW) && Boolean(employee);
  const scopedEmployee = canViewAll ? employee : req.user.employeeId;

  const { docs, meta } = await shiftSwapService.listSwapRequests({ employee: scopedEmployee, status }, pagination);
  sendSuccess(res, 200, 'Shift swap requests retrieved', docs, meta);
});

export const getSwapRequest = asyncHandler(async (req: Request, res: Response) => {
  const swap = await shiftSwapService.getSwapRequest(paramId(req.params.id));
  sendSuccess(res, 200, 'Shift swap request retrieved', swap);
});

export const createSwapRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const requested = req.body.requestingEmployeeId as string | undefined;
  const requestingEmployeeId = requested ?? req.user.employeeId;
  if (!requestingEmployeeId) throw ApiError.badRequest('No employee profile is linked to this account');
  if (
    requested &&
    requested !== req.user.employeeId &&
    !req.user.permissions.includes(PERMISSIONS.SHIFT_SWAP_APPROVE)
  ) {
    throw ApiError.forbidden('You can only request swaps for yourself');
  }

  const swap = await shiftSwapService.createSwapRequest({ ...req.body, requestingEmployeeId });
  sendSuccess(res, 201, 'Shift swap request created', swap);
});

export const acceptSwapRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.employeeId) throw ApiError.badRequest('No employee profile is linked to this account');
  const swap = await shiftSwapService.acceptSwapRequest(paramId(req.params.id), req.user.employeeId);
  sendSuccess(res, 200, 'Shift swap accepted', swap);
});

export const approveSwapRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const swap = await shiftSwapService.approveSwapRequest(paramId(req.params.id), req.user.id);
  sendSuccess(res, 200, 'Shift swap approved and schedule updated', swap);
});

export const rejectSwapRequest = asyncHandler(async (req: Request, res: Response) => {
  const swap = await shiftSwapService.rejectSwapRequest(paramId(req.params.id), req.body.rejectionReason);
  sendSuccess(res, 200, 'Shift swap rejected', swap);
});

export const cancelSwapRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.employeeId) throw ApiError.badRequest('No employee profile is linked to this account');
  const swap = await shiftSwapService.cancelSwapRequest(paramId(req.params.id), req.user.employeeId);
  sendSuccess(res, 200, 'Shift swap cancelled', swap);
});
