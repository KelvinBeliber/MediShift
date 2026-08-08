import { z } from 'zod';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');

export const createCertificationSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  description: z.string().trim().optional(),
  issuingBody: z.string().trim().optional(),
  validityPeriodMonths: z.coerce.number().min(0).optional(),
});

export const updateCertificationSchema = createCertificationSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const certificationIdParamSchema = z.object({ id: objectId });
