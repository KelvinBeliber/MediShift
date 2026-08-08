export interface SystemSetting {
  key: string
  value: unknown
  description?: string
  updatedBy?: string
  updatedAt?: string
}

export interface UpsertSettingInput {
  value: unknown
  description?: string
}
