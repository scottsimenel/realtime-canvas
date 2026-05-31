export function registerSaveHandlers(io, socket, registry, DEFAULT_ROOM) {
  /**
   * Handle save creation.
   */
  socket.on('save-create', (data, callback) => {
    const { name } = data || {};
    try {
      const save = registry.saveState(name);
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
   * Handle save listing.
   */
  socket.on('save-list', (callback) => {
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
   * Handle loading a save.
   */
  socket.on('save-load', (data, callback) => {
    const { saveId } = data || {};
    if (!saveId) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Save ID is required' });
      }
      return;
    }

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
        
        const room = socket.room || DEFAULT_ROOM;
        
        // Broadcast newly loaded state to all users in the room
        io.to(room).emit('room-state-loaded', {
          tabs: tabsList,
          assets: assetsList
        });
        
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
   * Handle deleting a save.
   */
  socket.on('save-delete', (data, callback) => {
    const { saveId } = data || {};
    if (!saveId) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Save ID is required' });
      }
      return;
    }

    try {
      const success = registry.deleteSave(saveId);
      if (success) {
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
