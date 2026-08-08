import { z } from 'zod';
import { PAYROLL_STATUS } from '@constants/enums';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');

export const generatePayrollSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  department: objectId.optional(),
});

export const payrollIdParamSchema = z.object({ id: objectId });

export const payrollQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  employee: objectId.optional(),
  status: z.enum(PAYROLL_STATUS).optional(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
});

export const payrollExportQuerySchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});
