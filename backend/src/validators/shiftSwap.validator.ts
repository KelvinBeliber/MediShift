import { z } from 'zod';
import { SHIFT_SWAP_STATUS } from '@constants/enums';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');

export const createShiftSwapSchema = z.object({
  requestingEmployeeId: objectId.optional(),
  requestingShift: objectId,
  targetEmployee: objectId.optional(),
  targetShift: objectId.optional(),
  reason: z.string().trim().optional(),
});

export const rejectSwapSchema = z.object({
  rejectionReason: z.string().trim().min(1),
});

export const shiftSwapIdParamSchema = z.object({ id: objectId });

export const shiftSwapQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  employee: objectId.optional(),
  status: z.enum(SHIFT_SWAP_STATUS).optional(),
});
