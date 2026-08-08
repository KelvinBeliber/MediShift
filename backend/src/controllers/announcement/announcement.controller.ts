import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { getPaginationParams } from '@utils/pagination';
import { paramId } from '@utils/requestParams';
import { ApiError } from '@utils/ApiError';
import { PERMISSIONS } from '@constants/permissions';
import * as announcementService from '@services/announcement/announcement.service';

export const getAnnouncements = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const pagination = getPaginationParams(req);
  const { priority } = (req.validatedQuery ?? {}) as Record<string, string | undefined>;

  const canManage = req.user.permissions.includes(PERMISSIONS.ANNOUNCEMENT_MANAGE);
  const employeeDepartment = await announcementService.resolveEmployeeDepartment(req.user.employeeId);

  const { docs, meta } = await announcementService.listAnnouncements(
    { canManage, employeeDepartment },
    { priority },
    pagination
  );
  sendSuccess(res, 200, 'Announcements retrieved', docs, meta);
});

export const getAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const announcement = await announcementService.getAnnouncement(paramId(req.params.id));
  sendSuccess(res, 200, 'Announcement retrieved', announcement);
});

export const createAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const announcement = await announcementService.createAnnouncement({ ...req.body, author: req.user.id });
  sendSuccess(res, 201, 'Announcement published', announcement);
});

export const updateAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const announcement = await announcementService.updateAnnouncement(paramId(req.params.id), req.body);
  sendSuccess(res, 200, 'Announcement updated', announcement);
});

export const deactivateAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const announcement = await announcementService.deactivateAnnouncement(paramId(req.params.id));
  sendSuccess(res, 200, 'Announcement deactivated', announcement);
});
