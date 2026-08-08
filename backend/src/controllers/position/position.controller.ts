import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { getPaginationParams } from '@utils/pagination';
import { paramId } from '@utils/requestParams';
import * as positionService from '@services/position/position.service';

export const getPositions = asyncHandler(async (req: Request, res: Response) => {
  const pagination = getPaginationParams(req);
  const { docs, meta } = await positionService.listPositions(pagination);
  sendSuccess(res, 200, 'Positions retrieved', docs, meta);
});

export const getPosition = asyncHandler(async (req: Request, res: Response) => {
  const position = await positionService.getPosition(paramId(req.params.id));
  sendSuccess(res, 200, 'Position retrieved', position);
});

export const createPosition = asyncHandler(async (req: Request, res: Response) => {
  const position = await positionService.createPosition(req.body);
  sendSuccess(res, 201, 'Position created', position);
});

export const updatePosition = asyncHandler(async (req: Request, res: Response) => {
  const position = await positionService.updatePosition(paramId(req.params.id), req.body);
  sendSuccess(res, 200, 'Position updated', position);
});

export const deactivatePosition = asyncHandler(async (req: Request, res: Response) => {
  const position = await positionService.deactivatePosition(paramId(req.params.id));
  sendSuccess(res, 200, 'Position deactivated', position);
});
