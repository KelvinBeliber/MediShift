import { z } from 'zod';
import { ATTENDANCE_STATUS } from '@constants/enums';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');

const locationSchema = z.object({ lat: z.number(), lng: z.number() }).optional();

export const clockEventSchema = z.object({
  employeeId: objectId.optional(),
  method: z.enum(['manual', 'gps', 'qr']).default('manual'),
  location: locationSchema,
});

export const breakEventSchema = z.object({
  employeeId: objectId.optional(),
});

export const attendanceIdParamSchema = z.object({ id: objectId });

export const attendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  employee: objectId.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  status: z.enum(ATTENDANCE_STATUS).optional(),
});

export const attendanceSummaryQuerySchema = z.object({
  employee: objectId.optional(),
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
});

/** No `employee` field — `/attendance/mine` always scopes to the caller, so there is nothing to filter by. */
export const attendanceMineQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
