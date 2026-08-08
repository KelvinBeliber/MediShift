export const ANNOUNCEMENT_PRIORITIES = ['normal', 'important', 'emergency'] as const
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number]

export const ANNOUNCEMENT_SCOPES = ['hospital', 'department'] as const
export type AnnouncementScope = (typeof ANNOUNCEMENT_SCOPES)[number]

export interface Announcement {
  id: string
  title: string
  body: string
  scope: AnnouncementScope
  department?: { id: string; name: string; code: string } | null
  priority: AnnouncementPriority
  author: { id: string; email: string } | string
  publishedAt?: string
  expiresAt?: string
  isActive: boolean
}

export interface AnnouncementInput {
  title: string
  body: string
  scope: AnnouncementScope
  department?: string
  priority?: AnnouncementPriority
  expiresAt?: string
}

export interface AnnouncementFilters {
  priority?: string
  page?: number
  limit?: number
}
