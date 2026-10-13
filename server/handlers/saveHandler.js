import { EVENTS } from '../../shared/protocol.js';

export function registerSaveHandlers(io, socket, roomManager) {
  const getRoomContext = () => {
    const room = socket.roomId || socket.room || 'canvas-default';
    const registry = roomManager.getOrCreateRoom(room);
    return { room, registry };
  };

  /**
   * Handle save creation.
   */
  socket.on(EVENTS.SAVE_CREATE, (data, callback) => {
    const { name } = data || {};
    const { registry } = getRoomContext();
    try {
      const save = registry.saveState(name);
      io.emit(EVENTS.ROOMS_UPDATED, roomManager.listRooms());
      if (typeof callback === 'function') {
        callback({ success: true, save });
      }
    } catch (err) {
      console.error('Failed to create save:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Handle save listing for the active room.
   */
  socket.on(EVENTS.SAVE_LIST, (callback) => {
    const { registry } = getRoomContext();
    try {
      const saves = registry.listSaves();
      if (typeof callback === 'function') {
        callback({ success: true, saves });
      }
    } catch (err) {
      console.error('Failed to list saves:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Handle loading a save in the active room.
   */
  socket.on(EVENTS.SAVE_LOAD, (data, callback) => {
    const { saveId } = data || {};
    if (!saveId) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Save ID is required' });
      }
      return;
    }

    const { room, registry } = getRoomContext();
    try {
      const success = registry.loadState(saveId);
      if (success) {
        // Map the tabs map to a serialized list for transfer
        const tabsList = Array.from(registry.tabs.values()).map(tab => ({
          id: tab.id,
          name: tab.name,
          elements: Array.from(tab.elements.values()),
          locks: [], // Locks are cleared on new save load
          roomSettings: tab.roomSettings
        }));
        const assetsList = Array.from(registry.assets.values());
        
        // Broadcast newly loaded state to all users in the room
        io.to(room).emit(EVENTS.ROOM_STATE_LOADED, {
          tabs: tabsList,
          assets: assetsList,
          folders: Array.from(registry.folders.values())
        });
        
        io.emit(EVENTS.ROOMS_UPDATED, roomManager.listRooms());

        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } else {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Save file not found' });
        }
      }
    } catch (err) {
      console.error('Failed to load save:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Handle deleting a save in the active room.
   */
  socket.on(EVENTS.SAVE_DELETE, (data, callback) => {
    const { saveId } = data || {};
    if (!saveId) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Save ID is required' });
      }
      return;
    }

    const { registry } = getRoomContext();
    try {
      const success = registry.deleteSave(saveId);
      if (success) {
        io.emit(EVENTS.ROOMS_UPDATED, roomManager.listRooms());
        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } else {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Save file not found or failed to delete' });
        }
      }
    } catch (err) {
      console.error('Failed to delete save:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });
}
