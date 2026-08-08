import { z } from 'zod';
import { SHIFT_ASSIGNMENT_STATUS } from '@constants/enums';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');

export const assignEmployeeSchema = z.object({
  employeeId: objectId,
  notes: z.string().trim().optional(),
});

export const updateAssignmentStatusSchema = z.object({
  status: z.enum(SHIFT_ASSIGNMENT_STATUS),
  notes: z.string().trim().optional(),
});

export const assignmentIdParamSchema = z.object({ assignmentId: objectId });
