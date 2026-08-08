import { getPaginated, post, put } from '@/lib/api/client'
import type { Message, SendMessageInput } from './types'

export const messagesApi = {
  send: (data: SendMessageInput) => post<Message>('/messages', data),
  direct: (userId: string) => getPaginated<Message>(`/messages/direct/${userId}`, { params: { limit: 100 } }),
  department: (departmentId: string) =>
    getPaginated<Message>(`/messages/department/${departmentId}`, { params: { limit: 100 } }),
  markRead: (id: string) => put<Message>(`/messages/${id}/read`),
}
