import { z } from 'zod';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');

export const auditLogIdParamSchema = z.object({ id: objectId });

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  entityType: z.string().optional(),
  entityId: objectId.optional(),
  user: objectId.optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'PUBLISH', 'FINALIZE']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
