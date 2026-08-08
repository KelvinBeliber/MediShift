import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import * as roleService from '@services/role/role.service';

export const getRoles = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await roleService.listRoles();
  sendSuccess(res, 200, 'Roles retrieved', roles);
});

export const getPermissions = asyncHandler(async (_req: Request, res: Response) => {
  const permissions = await roleService.listPermissions();
  sendSuccess(res, 200, 'Permissions retrieved', permissions);
});
