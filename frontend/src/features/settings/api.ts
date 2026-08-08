import { del, get, put } from '@/lib/api/client'
import type { SystemSetting, UpsertSettingInput } from './types'

export const settingsApi = {
  list: () => get<SystemSetting[]>('/settings'),
  upsert: (key: string, data: UpsertSettingInput) => put<SystemSetting>(`/settings/${encodeURIComponent(key)}`, data),
  remove: (key: string) => del<null>(`/settings/${encodeURIComponent(key)}`),
}
