import { get, put } from '@/lib/api/client'
import type { Notification } from './types'

interface NotificationsResponse {
  notifications: Notification[]
  unreadCount: number
}

export const notificationsApi = {
  list: (isRead?: boolean) =>
    get<NotificationsResponse>('/notifications', { params: { isRead } }),
  markRead: (id: string) => put<Notification>(`/notifications/${id}/read`),
  markAllRead: () => put<{ modifiedCount: number }>('/notifications/read-all'),
}
