import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { getPaginationParams } from '@utils/pagination';
import { paramId } from '@utils/requestParams';
import { ApiError } from '@utils/ApiError';
import * as notificationService from '@services/notifications/notification.service';

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const pagination = getPaginationParams(req);
  const { isRead } = (req.validatedQuery ?? {}) as Record<string, string | undefined>;

  const { docs, meta, unreadCount } = await notificationService.listNotifications(
    req.user.id,
    { isRead: isRead === undefined ? undefined : isRead === 'true' },
    pagination
  );
  sendSuccess(res, 200, 'Notifications retrieved', { notifications: docs, unreadCount }, meta);
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const notification = await notificationService.markAsRead(paramId(req.params.id), req.user.id);
  sendSuccess(res, 200, 'Notification marked as read', notification);
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const result = await notificationService.markAllAsRead(req.user.id);
  sendSuccess(res, 200, 'All notifications marked as read', result);
});
