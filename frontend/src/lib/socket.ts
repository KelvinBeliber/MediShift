import { io, type Socket } from 'socket.io-client'
import { getAccessToken } from '@/features/auth/store'

const SOCKET_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '')

let socket: Socket | null = null

/**
 * Lazily creates a single shared connection, authenticated with the current
 * access token in the handshake (the server rejects connections without one).
 * Reused across every screen that needs real-time updates rather than opening
 * one socket per component.
 */
export function getSocket(): Socket {
  const token = getAccessToken()

  if (!socket) {
    socket = io(SOCKET_URL, { auth: { token }, autoConnect: true })
    return socket
  }

  // The access token rotates (15-minute expiry + refresh) — keep the
  // handshake payload current so a reconnect after a refresh still succeeds.
  socket.auth = { token }
  if (!socket.connected) socket.connect()
  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}
