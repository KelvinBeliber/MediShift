export interface MessageSender {
  id: string
  email: string
}

export interface Message {
  id: string
  sender: MessageSender | string
  conversationType: 'direct' | 'department'
  recipient?: string
  department?: string
  content: string
  readBy: { user: string; readAt: string }[]
  createdAt: string
}

export interface SendMessageInput {
  conversationType: 'direct' | 'department'
  recipient?: string
  department?: string
  content: string
}

export interface DirectInboxItem {
  user: MessageSender
  lastMessage: Message
  unreadCount: number
}
