import { EVENTS } from '../../shared/protocol.js';
export function registerElementHandlers(io, socket, registry, DEFAULT_ROOM) {
  /**
   * Handle element lock request when a user selects/drags an element.
   * Prevents multiple users from moving the same element simultaneously.
   */
  socket.on(EVENTS.ELEMENT_LOCK, (data, callback) => {
    const { elementId, elementIds, tabId } = data || {};
    const room = socket.room || DEFAULT_ROOM;
    const targetTabId = tabId || 'tab-default';

    if (elementIds && Array.isArray(elementIds)) {
      const lockedIds = registry.lockElements(targetTabId, elementIds, socket.id);
      console.log(`Elements locked: [${lockedIds.join(', ')}] by ${socket.id} in tab ${targetTabId}`);
      lockedIds.forEach((id) => {
        socket.to(room).emit(EVENTS.ELEMENT_LOCKED, { elementId: id, userId: socket.id, tabId: targetTabId });
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
      socket.to(room).emit(EVENTS.ELEMENT_LOCKED, { elementId, userId: socket.id, tabId: targetTabId });
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
  socket.on(EVENTS.ELEMENT_UNLOCK, (data, callback) => {
    const { elementId, elementIds, tabId } = data || {};
    const room = socket.room || DEFAULT_ROOM;
    const targetTabId = tabId || 'tab-default';

    if (elementIds && Array.isArray(elementIds)) {
      const unlockedIds = registry.unlockElements(targetTabId, elementIds, socket.id);
      console.log(`Elements unlocked: [${unlockedIds.join(', ')}] by ${socket.id} in tab ${targetTabId}`);
      unlockedIds.forEach((id) => {
        socket.to(room).emit(EVENTS.ELEMENT_UNLOCKED, { elementId: id, userId: socket.id, tabId: targetTabId });
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
      socket.to(room).emit(EVENTS.ELEMENT_UNLOCKED, { elementId, userId: socket.id, tabId: targetTabId });
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
  socket.on(EVENTS.ELEMENT_UPDATE, (data, callback) => {
    const { elementId, updates, batch, tabId } = data || {};
    const room = socket.room || DEFAULT_ROOM;
    const targetTabId = tabId || 'tab-default';

    if (batch && Array.isArray(batch)) {
      const updatedElements = registry.updateElements(targetTabId, batch, socket.id);
      if (updatedElements.length > 0) {
        // Broadcast batch updates to other clients
        socket.to(room).emit(EVENTS.ELEMENT_UPDATED_BATCH, {
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
      socket.to(room).emit(EVENTS.ELEMENT_UPDATED, {
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
  socket.on(EVENTS.ELEMENT_CREATE, (data, callback) => {
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

    socket.to(room).emit(EVENTS.ELEMENT_CREATED, {
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
  socket.on(EVENTS.ASSET_CREATE, (data, callback) => {
    const { asset } = data || {};
    if (!asset || !asset.id || !asset.url) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid asset schema' });
      return;
    }

    const createdAsset = registry.createAsset(asset);
    const room = socket.room || DEFAULT_ROOM;

    // Broadcast newly created asset to other clients in the room
    socket.to(room).emit(EVENTS.ASSET_CREATED, {
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
  socket.on(EVENTS.ELEMENT_DELETE, (data, callback) => {
    const { elementId, elementIds, tabId } = data || {};
    const room = socket.room || DEFAULT_ROOM;
    const targetTabId = tabId || 'tab-default';

    if (elementIds && Array.isArray(elementIds)) {
      const deletedIds = registry.deleteElements(targetTabId, elementIds, socket.id);
      console.log(`Elements deleted: [${deletedIds.join(', ')}] by ${socket.id} in tab ${targetTabId}`);
      deletedIds.forEach((id) => {
        socket.to(room).emit(EVENTS.ELEMENT_DELETED, { elementId: id, userId: socket.id, tabId: targetTabId });
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
      socket.to(room).emit(EVENTS.ELEMENT_DELETED, { elementId, userId: socket.id, tabId: targetTabId });
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
  socket.on(EVENTS.ELEMENTS_REORDER, (data, callback) => {
    const { orderedIds, tabId } = data || {};
    const targetTabId = tabId || 'tab-default';
    if (!orderedIds || !Array.isArray(orderedIds)) {
      if (typeof callback === 'function') callback({ success: false, error: 'orderedIds array is required' });
      return;
    }

    const room = socket.room || DEFAULT_ROOM;
    const finalOrderedIds = registry.reorderElements(targetTabId, orderedIds);

    // Broadcast the new order to all other clients in the room
    socket.to(room).emit(EVENTS.ELEMENTS_REORDERED, { orderedIds: finalOrderedIds, tabId: targetTabId });

    if (typeof callback === 'function') {
      callback({ success: true, orderedIds: finalOrderedIds });
    }
  });

  /**
   * Handle room settings update request (background and grid).
   */
  socket.on(EVENTS.ROOM_SETTINGS_UPDATE, (data, callback) => {
    const { updates, tabId } = data || {};
    const targetTabId = tabId || 'tab-default';
    const room = socket.room || DEFAULT_ROOM;
    const updatedSettings = registry.updateRoomSettings(targetTabId, updates || {});

    if (!updatedSettings) {
      if (typeof callback === 'function') callback({ success: false, error: 'Tab not found' });
      return;
    }

    // Broadcast updated settings to everyone else in the room
    socket.to(room).emit(EVENTS.ROOM_SETTINGS_UPDATED, { roomSettings: updatedSettings, tabId: targetTabId });

    if (typeof callback === 'function') {
      callback({ success: true, roomSettings: updatedSettings });
    }
  });
}
