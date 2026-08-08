import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { paramId } from '@utils/requestParams';
import { ApiError } from '@utils/ApiError';
import * as systemSettingService from '@services/systemSetting/systemSetting.service';

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await systemSettingService.listSettings();
  sendSuccess(res, 200, 'Settings retrieved', settings);
});

export const getSetting = asyncHandler(async (req: Request, res: Response) => {
  const setting = await systemSettingService.getSetting(paramId(req.params.key, 'key'));
  sendSuccess(res, 200, 'Setting retrieved', setting);
});

export const upsertSetting = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const setting = await systemSettingService.upsertSetting(paramId(req.params.key, 'key'), req.body, req.user.id);
  sendSuccess(res, 200, 'Setting saved', setting);
});

export const deleteSetting = asyncHandler(async (req: Request, res: Response) => {
  await systemSettingService.deleteSetting(paramId(req.params.key, 'key'));
  sendSuccess(res, 200, 'Setting deleted');
});
