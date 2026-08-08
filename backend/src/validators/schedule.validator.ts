import { z } from 'zod';
import { SCHEDULE_STATUS } from '@constants/enums';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');

export const createScheduleSchema = z.object({
  department: objectId,
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  notes: z.string().trim().optional(),
});

export const updateScheduleSchema = z.object({
  notes: z.string().trim().optional(),
});

export const scheduleIdParamSchema = z.object({ id: objectId });

export const scheduleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  department: objectId.optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().optional(),
  status: z.enum(SCHEDULE_STATUS).optional(),
});
