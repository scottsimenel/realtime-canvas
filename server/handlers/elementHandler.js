export function registerElementHandlers(io, socket, registry, DEFAULT_ROOM) {
  /**
   * Handle element lock request when a user selects/drags an element.
   * Prevents multiple users from moving the same element simultaneously.
   */
  socket.on('element-lock', (data, callback) => {
    const { elementId, elementIds, tabId } = data || {};
    const room = socket.room || DEFAULT_ROOM;
    const targetTabId = tabId || 'tab-default';

    if (elementIds && Array.isArray(elementIds)) {
      const lockedIds = registry.lockElements(targetTabId, elementIds, socket.id);
      console.log(`Elements locked: [${lockedIds.join(', ')}] by ${socket.id} in tab ${targetTabId}`);
      lockedIds.forEach((id) => {
        socket.to(room).emit('element-locked', { elementId: id, userId: socket.id, tabId: targetTabId });
      });
      if (typeof callback === 'function') {
        callback({ success: lockedIds.length > 0, lockedIds });
      }
      return;
    }

    if (!elementId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Element ID is required' });
      return;
    }

    const success = registry.lockElement(targetTabId, elementId, socket.id);
    if (success) {
      console.log(`Element locked: ${elementId} by ${socket.id} in tab ${targetTabId}`);
      socket.to(room).emit('element-locked', { elementId, userId: socket.id, tabId: targetTabId });
      if (typeof callback === 'function') callback({ success: true });
    } else {
      const tab = registry.tabs.get(targetTabId);
      const currentHolder = tab ? tab.locks.get(elementId) : null;
      console.log(`Element lock failed: ${elementId} is held by ${currentHolder} in tab ${targetTabId}`);
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: 'Element is locked by another user',
          lockedBy: currentHolder
        });
      }
    }
  });

  /**
   * Handle element unlock request when a user deselects or stops dragging an element.
   */
  socket.on('element-unlock', (data, callback) => {
    const { elementId, elementIds, tabId } = data || {};
    const room = socket.room || DEFAULT_ROOM;
    const targetTabId = tabId || 'tab-default';

    if (elementIds && Array.isArray(elementIds)) {
      const unlockedIds = registry.unlockElements(targetTabId, elementIds, socket.id);
      console.log(`Elements unlocked: [${unlockedIds.join(', ')}] by ${socket.id} in tab ${targetTabId}`);
      unlockedIds.forEach((id) => {
        socket.to(room).emit('element-unlocked', { elementId: id, userId: socket.id, tabId: targetTabId });
      });
      if (typeof callback === 'function') {
        callback({ success: unlockedIds.length > 0, unlockedIds });
      }
      return;
    }

    if (!elementId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Element ID is required' });
      return;
    }

    const success = registry.unlockElement(targetTabId, elementId, socket.id);
    if (success) {
      console.log(`Element unlocked: ${elementId} by ${socket.id} in tab ${targetTabId}`);
      socket.to(room).emit('element-unlocked', { elementId, userId: socket.id, tabId: targetTabId });
      if (typeof callback === 'function') callback({ success: true });
    } else {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'You do not hold the lock for this element' });
      }
    }
  });

  /**
   * Handle updating properties of a canvas element (position, size, styling).
   * Verifies locks before applying updates and broadcasts changes.
   */
  socket.on('element-update', (data, callback) => {
    const { elementId, updates, batch, tabId } = data || {};
    const room = socket.room || DEFAULT_ROOM;
    const targetTabId = tabId || 'tab-default';

    if (batch && Array.isArray(batch)) {
      const updatedElements = registry.updateElements(targetTabId, batch, socket.id);
      if (updatedElements.length > 0) {
        // Broadcast batch updates to other clients
        socket.to(room).emit('element-updated-batch', {
          batch: batch.filter(item => updatedElements.some(el => el.id === item.elementId)),
          userId: socket.id,
          tabId: targetTabId
        });
      }
      if (typeof callback === 'function') {
        callback({ success: updatedElements.length > 0, elements: updatedElements });
      }
      return;
    }

    if (!elementId || !updates) {
      if (typeof callback === 'function') callback({ success: false, error: 'Missing parameters' });
      return;
    }

    const updatedElement = registry.updateElement(targetTabId, elementId, updates, socket.id);
    if (updatedElement) {
      socket.to(room).emit('element-updated', {
        elementId,
        updates,
        userId: socket.id,
        tabId: targetTabId
      });

      if (typeof callback === 'function') {
        callback({ success: true, element: updatedElement });
      }
    } else {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Update denied: Element locked by another user or not found' });
      }
    }
  });

  /**
   * Handle creation of a new canvas element.
   * Saves it to the registry and broadcasts creation to all room members.
   */
  socket.on('element-create', (data, callback) => {
    const { element, tabId } = data || {};
    const targetTabId = tabId || 'tab-default';
    if (!element || !element.id || !element.type) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid element schema' });
      return;
    }

    const createdElement = registry.createElement(targetTabId, element);
    if (!createdElement) {
      if (typeof callback === 'function') callback({ success: false, error: 'Failed to create element' });
      return;
    }
    const room = socket.room || DEFAULT_ROOM;

    socket.to(room).emit('element-created', {
      element: createdElement,
      userId: socket.id,
      tabId: targetTabId
    });

    if (typeof callback === 'function') {
      callback({ success: true, element: createdElement });
    }
  });

  /**
   * Handle registration of a new custom image asset.
   * Saves it to the registry and broadcasts it to all room members.
   */
  socket.on('asset-create', (data, callback) => {
    const { asset } = data || {};
    if (!asset || !asset.id || !asset.url) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid asset schema' });
      return;
    }

    const createdAsset = registry.createAsset(asset);
    const room = socket.room || DEFAULT_ROOM;

    // Broadcast newly created asset to other clients in the room
    socket.to(room).emit('asset-created', {
      asset: createdAsset,
      userId: socket.id
    });

    if (typeof callback === 'function') {
      callback({ success: true, asset: createdAsset });
    }
  });

  /**
   * Handle deletion of an element.
   */
  socket.on('element-delete', (data, callback) => {
    const { elementId, elementIds, tabId } = data || {};
    const room = socket.room || DEFAULT_ROOM;
    const targetTabId = tabId || 'tab-default';

    if (elementIds && Array.isArray(elementIds)) {
      const deletedIds = registry.deleteElements(targetTabId, elementIds, socket.id);
      console.log(`Elements deleted: [${deletedIds.join(', ')}] by ${socket.id} in tab ${targetTabId}`);
      deletedIds.forEach((id) => {
        socket.to(room).emit('element-deleted', { elementId: id, userId: socket.id, tabId: targetTabId });
      });
      if (typeof callback === 'function') {
        callback({ success: deletedIds.length > 0, deletedIds });
      }
      return;
    }

    if (!elementId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Element ID is required' });
      return;
    }

    const success = registry.deleteElement(targetTabId, elementId, socket.id);
    if (success) {
      console.log(`Element deleted: ${elementId} by ${socket.id} in tab ${targetTabId}`);
      socket.to(room).emit('element-deleted', { elementId, userId: socket.id, tabId: targetTabId });
      if (typeof callback === 'function') callback({ success: true });
    } else {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Delete denied: Element locked by another user or not found' });
      }
    }
  });

  /**
   * Handle reordering of elements.
   */
  socket.on('elements-reorder', (data, callback) => {
    const { orderedIds, tabId } = data || {};
    const targetTabId = tabId || 'tab-default';
    if (!orderedIds || !Array.isArray(orderedIds)) {
      if (typeof callback === 'function') callback({ success: false, error: 'orderedIds array is required' });
      return;
    }

    const room = socket.room || DEFAULT_ROOM;
    const finalOrderedIds = registry.reorderElements(targetTabId, orderedIds);

    // Broadcast the new order to all other clients in the room
    socket.to(room).emit('elements-reordered', { orderedIds: finalOrderedIds, tabId: targetTabId });

    if (typeof callback === 'function') {
      callback({ success: true, orderedIds: finalOrderedIds });
    }
  });

  /**
   * Handle room settings update request (background and grid).
   */
  socket.on('room-settings-update', (data, callback) => {
    const { updates, tabId } = data || {};
    const targetTabId = tabId || 'tab-default';
    const room = socket.room || DEFAULT_ROOM;
    const updatedSettings = registry.updateRoomSettings(targetTabId, updates || {});

    if (!updatedSettings) {
      if (typeof callback === 'function') callback({ success: false, error: 'Tab not found' });
      return;
    }

    // Broadcast updated settings to everyone else in the room
    socket.to(room).emit('room-settings-updated', { roomSettings: updatedSettings, tabId: targetTabId });

    if (typeof callback === 'function') {
      callback({ success: true, roomSettings: updatedSettings });
    }
  });
}
