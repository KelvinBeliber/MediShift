import { z } from 'zod';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');

export const sendMessageSchema = z
  .object({
    conversationType: z.enum(['direct', 'department']),
    recipient: objectId.optional(),
    department: objectId.optional(),
    content: z.string().trim().min(1),
    attachments: z.array(objectId).optional(),
  })
  .refine((data) => data.conversationType !== 'direct' || Boolean(data.recipient), {
    message: 'recipient is required for direct messages',
    path: ['recipient'],
  })
  .refine((data) => data.conversationType !== 'department' || Boolean(data.department), {
    message: 'department is required for department messages',
    path: ['department'],
  });

export const messageIdParamSchema = z.object({ id: objectId });
export const userIdParamSchema = z.object({ userId: objectId });
export const departmentIdParamSchema = z.object({ departmentId: objectId });

export const messageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
});
