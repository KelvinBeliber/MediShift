import { del, getPaginated, post, put } from '@/lib/api/client'
import type { Announcement, AnnouncementFilters, AnnouncementInput } from './types'

export const announcementsApi = {
  list: (filters: AnnouncementFilters) => getPaginated<Announcement>('/announcements', { params: filters }),
  create: (data: AnnouncementInput) => post<Announcement>('/announcements', data),
  update: (id: string, data: Partial<AnnouncementInput> & { isActive?: boolean }) =>
    put<Announcement>(`/announcements/${id}`, data),
  deactivate: (id: string) => del<Announcement>(`/announcements/${id}`),
}
