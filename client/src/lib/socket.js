import { io } from 'socket.io-client';

export const SOCKET_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000')
  : window.location.origin;

let socket = null;

/**
 * Returns the lazily initialized Socket.io instance singleton.
 * @returns {import('socket.io-client').Socket} The socket instance.
 */
export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
  }
  return socket;
};
