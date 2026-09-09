import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { prisma } from './config/db';
import { env } from './config/env';
import { logger } from './utils/logger';
import { verifyAccessToken } from './utils/tokens';

/**
 * Realtime events are delivered into per-organisation rooms. Previously the
 * socket server accepted any connection from any origin and emitted every new
 * message to every client, which leaked one tenant's conversations to all the
 * others.
 */
export const orgRoom = (orgId: string) => `org:${orgId}`;

interface SocketAuth {
  userId: string;
  orgId: string;
}

type AuthedSocket = Socket & { data: SocketAuth };

export function createRealtimeServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // Handshake auth: the client passes its access token, same as REST.
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        socket.handshake.headers.authorization?.replace(/^Bearer /, '');

      if (!token) return next(new Error('Authentication required'));

      const claims = verifyAccessToken(token);

      const user = await prisma.user.findUnique({
        where: { id: claims.sub },
        select: { id: true, orgId: true, isActive: true },
      });

      if (!user || !user.isActive) return next(new Error('Account unavailable'));

      (socket as AuthedSocket).data = { userId: user.id, orgId: user.orgId };
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, orgId } = (socket as AuthedSocket).data;

    // Server-side join. Clients cannot ask to join an arbitrary room.
    socket.join(orgRoom(orgId));
    logger.debug(`Socket connected: user=${userId} org=${orgId}`);

    socket.on('disconnect', (reason) => {
      logger.debug(`Socket disconnected: user=${userId} (${reason})`);
    });
  });

  return io;
}
