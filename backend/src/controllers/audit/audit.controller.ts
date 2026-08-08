import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { getPaginationParams } from '@utils/pagination';
import { paramId } from '@utils/requestParams';
import { ApiError } from '@utils/ApiError';
import * as auditService from '@services/audit/audit.service';

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const pagination = getPaginationParams(req);
  const { entityType, entityId, user, action, dateFrom, dateTo } = (req.validatedQuery ?? {}) as Record<
    string,
    string | undefined
  >;

  const { docs, meta } = await auditService.listAuditLogs(
    {
      entityType,
      entityId,
      user,
      action,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    },
    pagination
  );
  sendSuccess(res, 200, 'Audit logs retrieved', docs, meta);
});

export const getAuditLog = asyncHandler(async (req: Request, res: Response) => {
  const log = await auditService.getAuditLog(paramId(req.params.id));
  if (!log) throw ApiError.notFound('Audit log entry not found');
  sendSuccess(res, 200, 'Audit log entry retrieved', log);
});
