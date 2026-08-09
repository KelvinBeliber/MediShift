import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { env } from '@config/env';
import { logger } from '@utils/logger';
import { verifyAccessToken } from '@utils/jwt';
import { User } from '@models/User.model';
import { registerMessageHandlers } from './messageHandlers';
import { markOnline, markOffline } from './presence';

let io: SocketIOServer | undefined;

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function departmentRoom(departmentId: string): string {
  return `department:${departmentId}`;
}

export function initializeSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.clientUrl,
      credentials: true,
    },
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication token missing'));
    }
    try {
      const payload = verifyAccessToken(token);
      // A socket outlives the token that opened it, so check the account is
      // still live here rather than trusting the signature alone — otherwise a
      // deactivated user keeps receiving real-time data until they disconnect.
      const user = await User.findById(payload.sub).select('_id isActive');
      if (!user || !user.isActive) {
        return next(new Error('Account is inactive or no longer exists'));
      }
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.debug(`Socket connected: ${socket.id} (user ${socket.userId})`);
    if (socket.userId) {
      socket.join(userRoom(socket.userId));
      markOnline(io as SocketIOServer, socket.userId);
    }

    socket.on('department:join', (departmentId: string) => {
      if (typeof departmentId === 'string') socket.join(departmentRoom(departmentId));
    });

    socket.on('department:leave', (departmentId: string) => {
      if (typeof departmentId === 'string') socket.leave(departmentRoom(departmentId));
    });

    registerMessageHandlers(io as SocketIOServer, socket);

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
      if (socket.userId) markOffline(io as SocketIOServer, socket.userId);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocket() first.');
  }
  return io;
}
