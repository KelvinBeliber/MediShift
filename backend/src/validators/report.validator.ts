import { z } from 'zod';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');

export const reportRangeQuerySchema = z.object({
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
  department: objectId.optional(),
});

export const dashboardQuerySchema = z.object({
  department: objectId.optional(),
});
