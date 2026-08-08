import { Request } from 'express';
import { AuditLog, IAuditLog } from '@models/AuditLog.model';
import { logger } from '@utils/logger';
import { PaginationParams, buildPaginationMeta } from '@utils/pagination';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'PUBLISH' | 'FINALIZE';

interface RecordAuditInput {
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  after?: unknown;
  before?: unknown;
  req?: Request;
}

/**
 * Fire-and-forget audit trail write. Deliberately swallows its own errors —
 * a broken audit log must never take down the operation it's recording.
 * Scoped to `after` state (and `before` where cheaply available) rather than
 * full before/after diffing on every field, which would require threading
 * a pre-fetch through every mutating service.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await AuditLog.create({
      user: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before,
      after: input.after,
      ipAddress: input.req?.ip,
      userAgent: input.req?.headers['user-agent'],
    });
  } catch (error) {
    logger.error('Failed to record audit log entry', error);
  }
}

interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  user?: string;
  action?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export async function listAuditLogs(filters: AuditLogFilters, pagination: PaginationParams) {
  const filter: Record<string, unknown> = {};
  if (filters.entityType) filter.entityType = filters.entityType;
  if (filters.entityId) filter.entityId = filters.entityId;
  if (filters.user) filter.user = filters.user;
  if (filters.action) filter.action = filters.action;
  if (filters.dateFrom || filters.dateTo) {
    filter.createdAt = {
      ...(filters.dateFrom ? { $gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { $lte: filters.dateTo } : {}),
    };
  }

  const [docs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('user', 'email')
      .sort(pagination.sort)
      .skip(pagination.skip)
      .limit(pagination.limit),
    AuditLog.countDocuments(filter),
  ]);

  return { docs, meta: buildPaginationMeta(pagination.page, pagination.limit, total) };
}

export async function getAuditLog(id: string): Promise<IAuditLog | null> {
  return AuditLog.findById(id).populate('user', 'email');
}
