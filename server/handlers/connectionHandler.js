import { EVENTS } from '../../shared/protocol.js';
export function registerConnectionHandlers(io, socket, registry, DEFAULT_ROOM) {
  /**
   * Handle user joining a room.
   * Registers user, returns current canvas state, and notifies other users.
   */
  socket.on(EVENTS.JOIN_ROOM, (data, callback) => {
    const { name, color, roomId } = data || {};
    const room = roomId || DEFAULT_ROOM;

    // Join the specified room
    socket.join(room);
    socket.room = room; // Store room reference on the socket

    // Register user in our state registry
    const state = registry.joinRoom(socket.id, name, color);
    const currentUser = state.users.find(u => u.id === socket.id);

    if (currentUser) {
      console.log(`User ${currentUser.name} (${socket.id}) joined room: ${room}`);
    }

    // Reply with initial room snapshot to the joining user
    if (typeof callback === 'function') {
      callback({
        success: true,
        users: state.users,
        assets: state.assets || [],
        tabs: state.tabs,
        activeTabId: state.activeTabId
      });
    }

    // Broadcast user joined notification to everyone else in the room
    socket.to(room).emit(EVENTS.USER_JOINED, currentUser);
  });

  /**
   * Handle real-time cursor movements.
   * Updates user position and broadcasts it to other users in the room.
   */
  socket.on(EVENTS.CURSOR_MOVE, (data) => {
    const { x, y } = data || {};
    if (typeof x !== 'number' || typeof y !== 'number') return;

    const user = registry.updateCursor(socket.id, x, y);
    if (user) {
      const room = socket.room || DEFAULT_ROOM;
      // Broadcast cursor updates efficiently (excluding the sender)
      socket.to(room).emit(EVENTS.CURSOR_UPDATE, {
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

    const updatedUser = registry.renameUser(socket.id, name.trim());
    if (updatedUser) {
      const room = socket.room || DEFAULT_ROOM;
      io.to(room).emit(EVENTS.USER_RENAMED, { userId: socket.id, name: updatedUser.name });
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
      console.warn(`[recolor] Invalid color received from socket ${socket.id}:`, color);
      if (typeof callback === 'function') callback({ success: false, error: 'Color is required' });
      return;
    }

    console.log(`[recolor] Socket ${socket.id} requesting recolor to: ${color.trim()}`);
    const updatedUser = registry.recolorUser(socket.id, color.trim());
    if (updatedUser) {
      console.log(`[recolor] Successfully updated registry user ${updatedUser.name} (${socket.id}) color to: ${updatedUser.color}`);
      const room = socket.room || DEFAULT_ROOM;
      io.to(room).emit(EVENTS.USER_RECOLORED, { userId: socket.id, color: updatedUser.color });
      if (typeof callback === 'function') callback({ success: true, user: updatedUser });
    } else {
      console.error(`[recolor] User not found in registry for socket ${socket.id}`);
      if (typeof callback === 'function') callback({ success: false, error: 'User not found' });
    }
  });

  /**
   * Handle user disconnection.
   * Clean up registry entries (user cursor and held locks) and notify other clients.
   */
  socket.on(EVENTS.DISCONNECT, () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const room = socket.room || DEFAULT_ROOM;

    // Remove user and release locks held by this user
    const { releasedLocks } = registry.disconnectUser(socket.id);

    // Broadcast user departure
    socket.to(room).emit(EVENTS.USER_LEFT, { userId: socket.id });

    // Notify other clients about any locks that were released due to disconnect
    if (releasedLocks && releasedLocks.length > 0) {
      releasedLocks.forEach(({ elementId, tabId }) => {
        io.to(room).emit(EVENTS.ELEMENT_UNLOCKED, { elementId, tabId });
      });
    }
  });
}
