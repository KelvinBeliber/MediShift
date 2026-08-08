import { z } from 'zod';
import { LEAVE_TYPE, LEAVE_STATUS } from '@constants/enums';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');

export const createLeaveRequestSchema = z
  .object({
    employeeId: objectId.optional(),
    leaveType: z.enum(LEAVE_TYPE),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().trim().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });

export const approvalSchema = z.object({
  comment: z.string().trim().optional(),
});

export const rejectionSchema = z.object({
  rejectionReason: z.string().trim().min(1),
});

export const leaveIdParamSchema = z.object({ id: objectId });

export const leaveQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  employee: objectId.optional(),
  status: z.enum(LEAVE_STATUS).optional(),
  leaveType: z.enum(LEAVE_TYPE).optional(),
});
