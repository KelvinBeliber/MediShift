import { get, getPaginated, post, put } from '@/lib/api/client'
import type { DirectInboxItem, Message, SendMessageInput } from './types'

export const messagesApi = {
  send: (data: SendMessageInput) => post<Message>('/messages', data),
  inbox: () => get<DirectInboxItem[]>('/messages/conversations'),
  direct: (userId: string) => getPaginated<Message>(`/messages/direct/${userId}`, { params: { limit: 100 } }),
  department: (departmentId: string) =>
    getPaginated<Message>(`/messages/department/${departmentId}`, { params: { limit: 100 } }),
  markRead: (id: string) => put<Message>(`/messages/${id}/read`),
}
