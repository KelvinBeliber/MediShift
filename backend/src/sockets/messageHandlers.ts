import { Server as SocketIOServer, Socket } from 'socket.io';
import { getPresenceSnapshot } from './presence';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function departmentRoom(departmentId: string): string {
  return `department:${departmentId}`;
}

interface TypingPayload {
  conversationType: 'direct' | 'department';
  recipient?: string;
  department?: string;
}

function isTypingPayload(value: unknown): value is TypingPayload {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return p.conversationType === 'direct' || p.conversationType === 'department';
}

export function registerMessageHandlers(io: SocketIOServer, socket: Socket): void {
  const authSocket = socket as AuthenticatedSocket;

  function relay(event: 'typing:start' | 'typing:stop', payload: unknown): void {
    if (!authSocket.userId || !isTypingPayload(payload)) return;

    if (payload.conversationType === 'direct' && payload.recipient) {
      io.to(userRoom(payload.recipient)).emit(event, {
        userId: authSocket.userId,
        conversationType: 'direct' as const,
      });
    } else if (payload.conversationType === 'department' && payload.department) {
      socket.to(departmentRoom(payload.department)).emit(event, {
        userId: authSocket.userId,
        conversationType: 'department' as const,
        department: payload.department,
      });
    }
  }

  socket.on('typing:start', (payload: unknown) => relay('typing:start', payload));
  socket.on('typing:stop', (payload: unknown) => relay('typing:stop', payload));

  socket.on('presence:request', () => {
    socket.emit('presence:sync', getPresenceSnapshot());
  });
}
