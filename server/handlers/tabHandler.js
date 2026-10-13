import { EVENTS } from '../../shared/protocol.js';
import { clearLockTimeout } from './elementHandler.js';

export function registerTabHandlers(io, socket, roomManager) {
  const getRoomContext = () => {
    const room = socket.roomId || socket.room || 'canvas-default';
    const registry = roomManager.getOrCreateRoom(room);
    return { room, registry };
  };

  /**
   * Handle tab creation.
   */
  socket.on(EVENTS.TAB_CREATE, (data, callback) => {
    const { tabId, name } = data || {};
    if (!tabId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Tab ID is required' });
      return;
    }
    const { room, registry } = getRoomContext();
    const newTab = registry.createTab(tabId, name);
    // Broadcast tab creation to other clients
    socket.to(room).emit(EVENTS.TAB_CREATED, { tab: newTab });
    if (typeof callback === 'function') {
      callback({ success: true, tab: newTab });
    }
  });

  /**
   * Handle tab deletion.
   */
  socket.on(EVENTS.TAB_DELETE, (data, callback) => {
    const { tabId } = data || {};
    if (!tabId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Tab ID is required' });
      return;
    }
    const { room, registry } = getRoomContext();
    const result = registry.deleteTab(tabId);
    if (result.success) {
      // Broadcast deletion to all other clients, including new user assignments and fallback tab
      socket.to(room).emit(EVENTS.TAB_DELETED, {
        tabId,
        fallbackTabId: result.fallbackTabId,
        users: result.users
      });
      if (typeof callback === 'function') {
        callback({
          success: true,
          fallbackTabId: result.fallbackTabId,
          users: result.users
        });
      }
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'Cannot delete tab' });
    }
  });

  /**
   * Handle tab renaming.
   */
  socket.on(EVENTS.TAB_RENAME, (data, callback) => {
    const { tabId, name } = data || {};
    if (!tabId || !name) {
      if (typeof callback === 'function') callback({ success: false, error: 'Tab ID and Name are required' });
      return;
    }
    const { room, registry } = getRoomContext();
    const success = registry.renameTab(tabId, name);
    if (success) {
      socket.to(room).emit(EVENTS.TAB_RENAMED, { tabId, name });
      if (typeof callback === 'function') callback({ success: true });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'Tab not found' });
    }
  });

  /**
   * Handle user tab switching.
   */
  socket.on(EVENTS.TAB_SWITCH, (data, callback) => {
    const { tabId } = data || {};
    if (!tabId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Tab ID is required' });
      return;
    }
    const { room, registry } = getRoomContext();
    // Release locks held by this user before switching tabs
    const releasedLocks = registry.releaseUserLocks(socket.id);
    if (releasedLocks && releasedLocks.length > 0) {
      releasedLocks.forEach(({ elementId, tabId: tId }) => {
        clearLockTimeout(tId, elementId);
        io.to(room).emit(EVENTS.ELEMENT_UNLOCKED, { elementId, userId: socket.id, tabId: tId });
      });
    }

    const user = registry.switchUserTab(socket.id, tabId);
    if (user) {
      // Broadcast that user switched tab
      socket.to(room).emit(EVENTS.TAB_SWITCHED, { userId: socket.id, tabId });
      if (typeof callback === 'function') callback({ success: true, user });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'User or tab not found' });
    }
  });
}
