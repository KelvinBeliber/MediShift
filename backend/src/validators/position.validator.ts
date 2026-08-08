import { z } from 'zod';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');

export const createPositionSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  salaryRange: z
    .object({
      min: z.coerce.number().min(0),
      max: z.coerce.number().min(0),
    })
    .optional(),
  requiredCertifications: z.array(objectId).optional(),
  requiredSkills: z.array(z.string()).optional(),
  defaultWorkingHoursPerWeek: z.coerce.number().min(0).optional(),
});

export const updatePositionSchema = createPositionSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const positionIdParamSchema = z.object({ id: objectId });
