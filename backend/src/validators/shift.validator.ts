import { z } from 'zod';
import { SHIFT_TYPE } from '@constants/enums';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected 24h time in HH:mm format');

export const createShiftSchema = z.object({
  schedule: objectId,
  department: objectId.optional(),
  date: z.coerce.date(),
  shiftType: z.enum(SHIFT_TYPE),
  startTime: timeString,
  endTime: timeString,
  requiredStaff: z.coerce.number().int().min(0),
  requiredCertifications: z.array(objectId).optional(),
  notes: z.string().trim().optional(),
});

export const updateShiftSchema = createShiftSchema.partial().omit({ schedule: true });

export const shiftIdParamSchema = z.object({ id: objectId });

export const shiftQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sort: z.string().optional(),
  schedule: objectId.optional(),
  department: objectId.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  shiftType: z.enum(SHIFT_TYPE).optional(),
});
