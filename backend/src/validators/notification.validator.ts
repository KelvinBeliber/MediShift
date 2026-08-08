import { z } from 'zod';

const objectIdRegex = /^[a-f\d]{24}$/i;

export const notificationIdParamSchema = z.object({ id: z.string().regex(objectIdRegex, 'Invalid ID format') });

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  isRead: z.enum(['true', 'false']).optional(),
});
