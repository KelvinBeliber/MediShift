import { Server as SocketIOServer } from 'socket.io';

/**
 * In-memory presence tracking, keyed by connection count rather than a
 * simple boolean — a user open in two tabs must stay "online" until both
 * disconnect, not just the first one to close.
 */
const onlineCounts = new Map<string, number>();
const lastSeenAt = new Map<string, string>();

export function markOnline(io: SocketIOServer, userId: string): void {
  const count = onlineCounts.get(userId) ?? 0;
  onlineCounts.set(userId, count + 1);
  if (count === 0) {
    lastSeenAt.delete(userId);
    io.emit('presence:online', { userId });
  }
}

export function markOffline(io: SocketIOServer, userId: string): void {
  const count = onlineCounts.get(userId) ?? 0;
  if (count <= 1) {
    onlineCounts.delete(userId);
    const seenAt = new Date().toISOString();
    lastSeenAt.set(userId, seenAt);
    io.emit('presence:offline', { userId, lastSeenAt: seenAt });
  } else {
    onlineCounts.set(userId, count - 1);
  }
}

export function getPresenceSnapshot(): { onlineUserIds: string[]; lastSeenAt: Record<string, string> } {
  return {
    onlineUserIds: Array.from(onlineCounts.keys()),
    lastSeenAt: Object.fromEntries(lastSeenAt),
  };
}
