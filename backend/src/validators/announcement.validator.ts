import { z } from 'zod';
import { ANNOUNCEMENT_PRIORITY, ANNOUNCEMENT_SCOPE } from '@constants/enums';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');

export const createAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1),
    body: z.string().trim().min(1),
    scope: z.enum(ANNOUNCEMENT_SCOPE),
    department: objectId.optional(),
    priority: z.enum(ANNOUNCEMENT_PRIORITY).optional(),
    expiresAt: z.coerce.date().optional(),
  })
  .refine((data) => data.scope !== 'department' || Boolean(data.department), {
    message: 'department is required when scope is "department"',
    path: ['department'],
  });

export const updateAnnouncementSchema = z.object({
  title: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1).optional(),
  priority: z.enum(ANNOUNCEMENT_PRIORITY).optional(),
  expiresAt: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export const announcementIdParamSchema = z.object({ id: objectId });

export const announcementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  priority: z.enum(ANNOUNCEMENT_PRIORITY).optional(),
});
