import { z } from 'zod';

export const upsertSettingSchema = z.object({
  value: z.unknown(),
  description: z.string().trim().optional(),
});

export const settingKeyParamSchema = z.object({
  key: z.string().trim().min(1),
});
