import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { getPaginationParams } from '@utils/pagination';
import { paramId } from '@utils/requestParams';
import { ApiError } from '@utils/ApiError';
import * as messageService from '@services/message/message.service';

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const message = await messageService.sendMessage({ ...req.body, sender: req.user.id });
  sendSuccess(res, 201, 'Message sent', message);
});

export const getDirectInbox = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const inbox = await messageService.getDirectInbox(req.user.id);
  sendSuccess(res, 200, 'Inbox retrieved', inbox);
});

export const getDirectConversation = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const pagination = getPaginationParams(req);
  const { docs, meta } = await messageService.getDirectConversation(
    req.user.id,
    paramId(req.params.userId, 'userId'),
    pagination
  );
  sendSuccess(res, 200, 'Conversation retrieved', docs, meta);
});

export const getDepartmentConversation = asyncHandler(async (req: Request, res: Response) => {
  const pagination = getPaginationParams(req);
  const { docs, meta } = await messageService.getDepartmentConversation(
    paramId(req.params.departmentId, 'departmentId'),
    pagination
  );
  sendSuccess(res, 200, 'Department conversation retrieved', docs, meta);
});

export const markMessageRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const message = await messageService.markMessageRead(paramId(req.params.id), req.user.id);
  sendSuccess(res, 200, 'Message marked as read', message);
});
