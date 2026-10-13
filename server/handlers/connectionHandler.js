import { EVENTS } from '../../shared/protocol.js';
import { clearLockTimeout } from './elementHandler.js';
import { sanitizeRoomId } from '../registry.js';

export function registerConnectionHandlers(io, socket, roomManager) {
  /**
   * Handle user querying available rooms list.
   */
  socket.on(EVENTS.ROOMS_LIST, (callback) => {
    try {
      const rooms = roomManager.listRooms();
      if (typeof callback === 'function') {
        callback({ success: true, rooms });
      }
    } catch (err) {
      console.error('Failed to list rooms:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Handle user joining a room.
   * Registers user, returns current canvas state, and notifies other users.
   */
  socket.on(EVENTS.JOIN_ROOM, (data, callback) => {
    const { name, color, roomId } = data || {};
    const safeRoom = sanitizeRoomId(roomId);

    // If socket was already in a different room, clean up previous room first
    if (socket.roomId && socket.roomId !== safeRoom) {
      const prevRoom = socket.roomId;
      const { releasedLocks } = roomManager.removeUser(socket.id, prevRoom);
      socket.leave(prevRoom);
      socket.to(prevRoom).emit(EVENTS.USER_LEFT, { userId: socket.id });
      if (releasedLocks && releasedLocks.length > 0) {
        releasedLocks.forEach(({ elementId, tabId }) => {
          clearLockTimeout(tabId, elementId);
          io.to(prevRoom).emit(EVENTS.ELEMENT_UNLOCKED, { elementId, tabId });
        });
      }
    }

    // Join the specified room
    socket.join(safeRoom);
    socket.roomId = safeRoom; // Store room reference on the socket
    socket.room = safeRoom;

    // Register user in the room's state registry
    const registry = roomManager.getOrCreateRoom(safeRoom);
    const state = registry.joinRoom(socket.id, name, color);
    const currentUser = state.users.find(u => u.id === socket.id);

    if (currentUser) {
      console.log(`User ${currentUser.name} (${socket.id}) joined room: ${safeRoom}`);
    }

    // Reply with initial room snapshot to the joining user
    if (typeof callback === 'function') {
      callback({
        success: true,
        users: state.users,
        assets: state.assets || [],
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        folders: state.folders || []
      });
    }

    // Broadcast user joined notification to everyone else in the room
    socket.to(safeRoom).emit(EVENTS.USER_JOINED, currentUser);

    // Notify all clients in lobby of updated room statistics
    io.emit(EVENTS.ROOMS_UPDATED, roomManager.listRooms());
  });

  /**
   * Handle user leaving a room explicitly (e.g., returning to lobby).
   */
  socket.on(EVENTS.LEAVE_ROOM, (callback) => {
    const currentRoom = socket.roomId;
    if (currentRoom) {
      const { releasedLocks } = roomManager.removeUser(socket.id, currentRoom);
      socket.leave(currentRoom);
      socket.roomId = null;
      socket.room = null;

      socket.to(currentRoom).emit(EVENTS.USER_LEFT, { userId: socket.id });
      if (releasedLocks && releasedLocks.length > 0) {
        releasedLocks.forEach(({ elementId, tabId }) => {
          clearLockTimeout(tabId, elementId);
          io.to(currentRoom).emit(EVENTS.ELEMENT_UNLOCKED, { elementId, tabId });
        });
      }

      // Notify all clients in lobby of updated room statistics
      io.emit(EVENTS.ROOMS_UPDATED, roomManager.listRooms());
    }

    if (typeof callback === 'function') {
      callback({ success: true });
    }
  });

  /**
   * Handle real-time cursor movements.
   * Updates user position and broadcasts it to other users in the room.
   */
  socket.on(EVENTS.CURSOR_MOVE, (data) => {
    const { x, y } = data || {};
    if (typeof x !== 'number' || typeof y !== 'number') return;
    if (!socket.roomId) return;

    const registry = roomManager.getRoom(socket.roomId);
    if (!registry) return;

    const user = registry.updateCursor(socket.id, x, y);
    if (user) {
      socket.to(socket.roomId).emit(EVENTS.CURSOR_UPDATE, {
        userId: socket.id,
        x: user.x,
        y: user.y
      });
    }
  });

  /**
   * Handle user renaming.
   */
  socket.on(EVENTS.USER_RENAME, (data, callback) => {
    const { name } = data || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      if (typeof callback === 'function') callback({ success: false, error: 'Name is required' });
      return;
    }
    if (!socket.roomId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not in a room' });
      return;
    }

    const registry = roomManager.getRoom(socket.roomId);
    if (!registry) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }

    const updatedUser = registry.renameUser(socket.id, name.trim());
    if (updatedUser) {
      io.to(socket.roomId).emit(EVENTS.USER_RENAMED, { userId: socket.id, name: updatedUser.name });
      io.emit(EVENTS.ROOMS_UPDATED, roomManager.listRooms());
      if (typeof callback === 'function') callback({ success: true, user: updatedUser });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'User not found' });
    }
  });

  /**
   * Handle user recoloring.
   */
  socket.on(EVENTS.USER_RECOLOR, (data, callback) => {
    const { color } = data || {};
    if (!color || typeof color !== 'string' || !color.trim()) {
      if (typeof callback === 'function') callback({ success: false, error: 'Color is required' });
      return;
    }
    if (!socket.roomId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not in a room' });
      return;
    }

    const registry = roomManager.getRoom(socket.roomId);
    if (!registry) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }

    const updatedUser = registry.recolorUser(socket.id, color.trim());
    if (updatedUser) {
      io.to(socket.roomId).emit(EVENTS.USER_RECOLORED, { userId: socket.id, color: updatedUser.color });
      io.emit(EVENTS.ROOMS_UPDATED, roomManager.listRooms());
      if (typeof callback === 'function') callback({ success: true, user: updatedUser });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'User not found' });
    }
  });

  /**
   * Handle user disconnection.
   * Clean up registry entries (user cursor and held locks) and notify other clients.
   */
  socket.on(EVENTS.DISCONNECT, () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const room = socket.roomId;
    if (room) {
      const { releasedLocks } = roomManager.removeUser(socket.id, room);
      socket.to(room).emit(EVENTS.USER_LEFT, { userId: socket.id });

      if (releasedLocks && releasedLocks.length > 0) {
        releasedLocks.forEach(({ elementId, tabId }) => {
          clearLockTimeout(tabId, elementId);
          io.to(room).emit(EVENTS.ELEMENT_UNLOCKED, { elementId, tabId });
        });
      }

      // Notify all clients of updated room member counts
      io.emit(EVENTS.ROOMS_UPDATED, roomManager.listRooms());
    }
  });
}
