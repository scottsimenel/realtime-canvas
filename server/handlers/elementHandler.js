import { EVENTS } from '../../shared/protocol.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '..', 'public', 'uploads');

export const lockTimeouts = new Map(); // key: "${tabId}:${elementId}" -> timeout

export function clearLockTimeout(tabId, elementId) {
  const key = `${tabId}:${elementId}`;
  if (lockTimeouts.has(key)) {
    clearTimeout(lockTimeouts.get(key));
    lockTimeouts.delete(key);
  }
}

function resetLockTimeout(io, room, tabId, elementId, userId, registry) {
  const key = `${tabId}:${elementId}`;
  if (lockTimeouts.has(key)) {
    clearTimeout(lockTimeouts.get(key));
  }

  const timeout = setTimeout(() => {
    const success = registry.unlockElement(tabId, elementId, userId);
    if (success) {
      console.log(`[Auto-Unlock] Element ${elementId} unlocked due to inactivity in tab ${tabId}`);
      io.to(room).emit(EVENTS.ELEMENT_UNLOCKED, { elementId, userId, tabId });
    }
    lockTimeouts.delete(key);
  }, 30000); // 30 seconds

  lockTimeouts.set(key, timeout);
}

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
        resetLockTimeout(io, room, targetTabId, id, socket.id, registry);
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
      resetLockTimeout(io, room, targetTabId, elementId, socket.id, registry);
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
        clearLockTimeout(targetTabId, id);
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
      clearLockTimeout(targetTabId, elementId);
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
        updatedElements.forEach((el) => {
          resetLockTimeout(io, room, targetTabId, el.id, socket.id, registry);
        });
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
      resetLockTimeout(io, room, targetTabId, elementId, socket.id, registry);
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
   * Handle deletion of an image asset permanently from disk and database registry.
   */
  socket.on(EVENTS.ASSET_DELETE, (data, callback) => {
    const { assetId } = data || {};
    if (!assetId) {
      if (typeof callback === 'function') callback({ success: false, error: 'No assetId provided' });
      return;
    }

    const deletedAsset = registry.deleteAsset(assetId);
    if (!deletedAsset) {
      if (typeof callback === 'function') callback({ success: false, error: 'Asset not found in registry' });
      return;
    }

    // Attempt to delete physical file from disk
    if (deletedAsset.url && deletedAsset.url.startsWith('/uploads/')) {
      try {
        const filename = path.basename(deletedAsset.url);
        const filePath = path.join(uploadsDir, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error('Error deleting asset file from server:', err);
      }
    }

    const room = socket.room || DEFAULT_ROOM;
    // Broadcast asset deletion to all other clients in the room
    socket.to(room).emit(EVENTS.ASSET_DELETED, {
      assetId,
      userId: socket.id
    });

    if (typeof callback === 'function') {
      callback({ success: true, assetId });
    }
  });

  /**
   * Handle asset renaming.
   */
  socket.on(EVENTS.ASSET_RENAME, (data, callback) => {
    const { assetId, name } = data || {};
    if (!assetId || !name) {
      if (typeof callback === 'function') callback({ success: false, error: 'assetId and name are required' });
      return;
    }

    const updatedAsset = registry.renameAsset(assetId, name);
    if (!updatedAsset) {
      if (typeof callback === 'function') callback({ success: false, error: 'Asset not found in registry' });
      return;
    }

    const room = socket.room || DEFAULT_ROOM;
    // Broadcast renamed asset to all other clients in the room
    socket.to(room).emit(EVENTS.ASSET_RENAMED, {
      asset: updatedAsset,
      userId: socket.id
    });

    if (typeof callback === 'function') {
      callback({ success: true, asset: updatedAsset });
    }
  });

  /**
   * Handle folder creation.
   */
  socket.on(EVENTS.FOLDER_CREATE, (data, callback) => {
    const { folder } = data || {};
    if (!folder || !folder.id || !folder.name) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid folder schema' });
      return;
    }

    const createdFolder = registry.createFolder(folder);
    const room = socket.room || DEFAULT_ROOM;

    socket.to(room).emit(EVENTS.FOLDER_CREATED, {
      folder: createdFolder,
      userId: socket.id
    });

    if (typeof callback === 'function') {
      callback({ success: true, folder: createdFolder });
    }
  });

  /**
   * Handle folder renaming.
   */
  socket.on(EVENTS.FOLDER_RENAME, (data, callback) => {
    const { folderId, name } = data || {};
    if (!folderId || !name) {
      if (typeof callback === 'function') callback({ success: false, error: 'folderId and name are required' });
      return;
    }

    const updatedFolder = registry.renameFolder(folderId, name);
    if (!updatedFolder) {
      if (typeof callback === 'function') callback({ success: false, error: 'Folder not found' });
      return;
    }

    const room = socket.room || DEFAULT_ROOM;
    socket.to(room).emit(EVENTS.FOLDER_RENAMED, {
      folder: updatedFolder,
      userId: socket.id
    });

    if (typeof callback === 'function') {
      callback({ success: true, folder: updatedFolder });
    }
  });

  /**
   * Handle folder deletion.
   */
  socket.on(EVENTS.FOLDER_DELETE, (data, callback) => {
    const { folderId } = data || {};
    if (!folderId) {
      if (typeof callback === 'function') callback({ success: false, error: 'folderId is required' });
      return;
    }

    const success = registry.deleteFolder(folderId);
    if (!success) {
      if (typeof callback === 'function') callback({ success: false, error: 'Folder not found' });
      return;
    }

    const room = socket.room || DEFAULT_ROOM;
    socket.to(room).emit(EVENTS.FOLDER_DELETED, {
      folderId,
      userId: socket.id
    });

    if (typeof callback === 'function') {
      callback({ success: true, folderId });
    }
  });

  /**
   * Handle moving an asset to a folder.
   */
  socket.on(EVENTS.ASSET_MOVE, (data, callback) => {
    const { assetId, folderId } = data || {};
    if (!assetId) {
      if (typeof callback === 'function') callback({ success: false, error: 'assetId is required' });
      return;
    }

    const updatedAsset = registry.moveAsset(assetId, folderId);
    if (!updatedAsset) {
      if (typeof callback === 'function') callback({ success: false, error: 'Asset not found' });
      return;
    }

    const room = socket.room || DEFAULT_ROOM;
    socket.to(room).emit(EVENTS.ASSET_MOVED, {
      assetId,
      folderId: updatedAsset.folderId,
      userId: socket.id
    });

    if (typeof callback === 'function') {
      callback({ success: true, asset: updatedAsset });
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
        clearLockTimeout(targetTabId, id);
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
      clearLockTimeout(targetTabId, elementId);
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
