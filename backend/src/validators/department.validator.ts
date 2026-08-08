import { z } from 'zod';
import { SHIFT_TYPE } from '@constants/enums';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');

const staffingRequirementSchema = z.object({
  shiftType: z.enum(SHIFT_TYPE),
  minStaff: z.coerce.number().int().min(0),
  requiredCertifications: z.array(objectId).optional(),
});

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  description: z.string().trim().optional(),
  manager: objectId.optional(),
  staffingRequirements: z.array(staffingRequirementSchema).optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const assignManagerSchema = z.object({
  employeeId: objectId,
});

export const assignEmployeesSchema = z.object({
  employeeIds: z.array(objectId).min(1),
});

export const departmentIdParamSchema = z.object({ id: objectId });
