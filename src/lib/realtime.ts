import { io, type Socket } from 'socket.io-client';
import type { Message, Notification } from '../types/models';
import { API_ORIGIN } from './config';
import { getAccessToken } from './api';

/**
 * Realtime updates.
 *
 * The server has emitted socket events all along; nothing on the client ever
 * listened, so the "omnichannel realtime sync" was one-ended. Connections are
 * authenticated with the same access token as REST, and the server places each
 * socket in its own organisation's room.
 */

type Handlers = {
  onMessage?: (message: Message) => void;
  onNotification?: (notification: Notification) => void;
};

let socket: Socket | null = null;

export function connectRealtime(handlers: Handlers): void {
  const token = getAccessToken();
  if (!token || socket) return;

  socket = io(API_ORIGIN, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  if (handlers.onMessage) socket.on('message:created', handlers.onMessage);
  if (handlers.onNotification) socket.on('notification:created', handlers.onNotification);
}

export function disconnectRealtime(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

export function isRealtimeConnected(): boolean {
  return socket?.connected ?? false;
}
