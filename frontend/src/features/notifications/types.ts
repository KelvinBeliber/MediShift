export interface Notification {
  id: string
  recipient: string
  type: string
  title: string
  message: string
  isRead: boolean
  readAt?: string
  relatedEntityType?: string
  relatedEntityId?: string
  actionUrl?: string
  createdAt: string
}
