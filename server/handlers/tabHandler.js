import { EVENTS } from '../../shared/protocol.js';
export function registerTabHandlers(io, socket, registry, DEFAULT_ROOM) {
  /**
   * Handle tab creation.
   */
  socket.on(EVENTS.TAB_CREATE, (data, callback) => {
    const { tabId, name } = data || {};
    if (!tabId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Tab ID is required' });
      return;
    }
    const newTab = registry.createTab(tabId, name);
    const room = socket.room || DEFAULT_ROOM;
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
    const result = registry.deleteTab(tabId);
    if (result.success) {
      const room = socket.room || DEFAULT_ROOM;
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
    const success = registry.renameTab(tabId, name);
    if (success) {
      const room = socket.room || DEFAULT_ROOM;
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
    const user = registry.switchUserTab(socket.id, tabId);
    if (user) {
      const room = socket.room || DEFAULT_ROOM;
      // Broadcast that user switched tab
      socket.to(room).emit(EVENTS.TAB_SWITCHED, { userId: socket.id, tabId });
      if (typeof callback === 'function') callback({ success: true, user });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'User or tab not found' });
    }
  });
}
