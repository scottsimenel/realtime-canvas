import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  MAX_FOLDER_DEPTH,
  getFolderDepth,
  isDescendantFolder,
  canMoveFolder,
  resolveUniqueSiblingName
} from '../shared/folderTree.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseSavesDir = path.join(__dirname, 'saves');

/**
 * Sanitizes a room ID to ensure filesystem safety and prevent path traversal.
 * 
 * @param {string} roomId 
 * @returns {string} Sanitized room identifier.
 */
export function sanitizeRoomId(roomId) {
  if (!roomId || typeof roomId !== 'string') return 'canvas-default';
  const clean = roomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
  return clean || 'canvas-default';
}

/**
 * Migrates legacy root save files to server/saves/canvas-default/ if present.
 */
export function migrateLegacyRootSaves() {
  try {
    if (!fs.existsSync(baseSavesDir)) {
      fs.mkdirSync(baseSavesDir, { recursive: true });
    }
    const defaultRoomDir = path.join(baseSavesDir, 'canvas-default');
    if (!fs.existsSync(defaultRoomDir)) {
      fs.mkdirSync(defaultRoomDir, { recursive: true });
    }

    const files = fs.readdirSync(baseSavesDir, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.json')) {
        const sourcePath = path.join(baseSavesDir, file.name);
        const destPath = path.join(defaultRoomDir, file.name);
        if (!fs.existsSync(destPath)) {
          fs.renameSync(sourcePath, destPath);
          console.log(`Migrated legacy save ${file.name} to canvas-default/`);
        }
      }
    }
  } catch (err) {
    console.error('Failed to migrate legacy root saves:', err);
  }
}

/**
 * @typedef {Object} User
 * @property {string} id - The unique socket ID of the user.
 * @property {string} name - The user's display name.
 * @property {string} color - The user's assigned cursor/active color.
 * @property {number} x - The user's current cursor X coordinate.
 * @property {number} y - The user's current cursor Y coordinate.
 * @property {string} activeTabId - The ID of the tab the user is currently viewing.
 */

/**
 * @typedef {Object} CanvasElement
 * @property {string} id - The unique ID of the element.
 * @property {string} type - The type of element (e.g., 'rectangle', 'circle', 'text', 'path', 'image').
 * @property {number} x - X coordinate of the element.
 * @property {number} y - Y coordinate of the element.
 * @property {number} width - Width of the element.
 * @property {number} height - Height of the element.
 * @property {Object} [properties] - Styling or content properties (e.g., fill, stroke, strokeWidth, text, url).
 */

/**
 * In-memory transactional registry for the real-time collaborative canvas.
 * Manages users, canvas tabs, elements, locks, and settings to ensure consistent state.
 */
export class CanvasRegistry {
  constructor(roomId = 'canvas-default', customSavesDir = null) {
    this.roomId = sanitizeRoomId(roomId);
    this.savesDir = customSavesDir || path.join(baseSavesDir, this.roomId);

    // Ensure saves directory exists
    if (!fs.existsSync(this.savesDir)) {
      fs.mkdirSync(this.savesDir, { recursive: true });
    }

    /**
     * Map of active users, keyed by their socket ID.
     * @type {Map<string, User>}
     */
    this.users = new Map();

    /**
     * Map of custom uploaded assets, keyed by asset ID.
     * @type {Map<string, Object>}
     */
    this.assets = new Map();

    /**
     * Map of custom folders, keyed by folder ID.
     * @type {Map<string, Object>}
     */
    this.folders = new Map();

    /**
     * Map of active canvas tabs, keyed by tab ID.
     * Each tab contains elements, locks, and roomSettings specific to that tab.
     * @type {Map<string, Object>}
     */
    this.tabs = new Map();

    // Initialize with a default canvas tab
    this.tabs.set('tab-default', {
      id: 'tab-default',
      name: 'Canvas 1',
      elements: new Map(),
      locks: new Map(),
      roomSettings: {
        backgroundImageUrl: null,
        showBackground: true,
        showGrid: true,
        gridSnapping: false,
        gridType: 'square', // 'square', 'hexagon'
        gridSize: 40, // spacing/radius range 15 to 150
        customBackgroundWidth: null,
        customBackgroundHeight: null,
        gridScaleNumber: 5,
        gridScaleUnit: 'ft',
        gridColor: null,
        gridLineWidth: 1
      }
    });
  }

  /**
   * Retrieves a valid fallback tab ID from the registry.
   * 
   * @returns {string} The first available tab ID, or 'tab-default' if empty.
   */
  getFallbackTabId() {
    return this.tabs.keys().next().value || 'tab-default';
  }

  /**
   * Registers a user joining the room.
   * 
   * @param {string} userId - The socket ID of the user.
   * @param {string} name - The display name of the user.
   * @param {string} color - The color assigned to the user's cursor.
   * @returns {{ users: User[], assets: Object[], tabs: Object[], activeTabId: string }} The current state of the room.
   */
  joinRoom(userId, name, color) {
    const fallbackTabId = this.getFallbackTabId();
    const user = {
      id: userId,
      name: name || `User_${userId.substring(0, 4)}`,
      color: color || '#000000',
      x: 0,
      y: 0,
      activeTabId: fallbackTabId
    };
    this.users.set(userId, user);

    // Map the tabs map to a serialized list for transfer
    const tabsList = Array.from(this.tabs.values()).map(tab => ({
      id: tab.id,
      name: tab.name,
      elements: Array.from(tab.elements.values()),
      locks: Array.from(tab.locks.entries()),
      roomSettings: tab.roomSettings
    }));

    return {
      users: Array.from(this.users.values()),
      assets: Array.from(this.assets.values()),
      folders: Array.from(this.folders.values()),
      tabs: tabsList,
      activeTabId: fallbackTabId
    };
  }

  /**
   * Creates a new tab.
   * 
   * @param {string} tabId - Unique ID of the tab.
   * @param {string} name - Display name of the tab.
   * @returns {Object} The created tab object formatted for transfer.
   */
  createTab(tabId, name) {
    const newTab = {
      id: tabId,
      name: name || `Canvas`,
      elements: new Map(),
      locks: new Map(),
      roomSettings: {
        backgroundImageUrl: null,
        showBackground: true,
        showGrid: true,
        gridSnapping: false,
        gridType: 'square',
        gridSize: 40,
        customBackgroundWidth: null,
        customBackgroundHeight: null,
        gridScaleNumber: 5,
        gridScaleUnit: 'ft',
        gridColor: null,
        gridLineWidth: 1
      }
    };
    this.tabs.set(tabId, newTab);
    return {
      id: newTab.id,
      name: newTab.name,
      elements: [],
      locks: [],
      roomSettings: newTab.roomSettings
    };
  }

  /**
   * Deletes a tab.
   * 
   * @param {string} tabId - Unique ID of the tab to delete.
   * @returns {{ success: boolean, fallbackTabId?: string, users?: User[] }} Status of deletion and updated user assignments.
   */
  deleteTab(tabId) {
    if (this.tabs.size <= 1 || !this.tabs.has(tabId)) {
      return { success: false };
    }

    this.tabs.delete(tabId);

    // Find a fallback tab (first remaining tab)
    const fallbackTabId = this.tabs.keys().next().value;

    // Update active tab for any users that were on the deleted tab
    for (const [userId, user] of this.users.entries()) {
      if (user.activeTabId === tabId) {
        user.activeTabId = fallbackTabId;
      }
    }

    return {
      success: true,
      fallbackTabId,
      users: Array.from(this.users.values())
    };
  }

  /**
   * Renames a tab.
   * 
   * @param {string} tabId - Unique ID of the tab.
   * @param {string} name - The new name.
   * @returns {boolean} True if successful.
   */
  renameTab(tabId, name) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;
    tab.name = name;
    return true;
  }

  /**
   * Switches a user's active tab.
   * 
   * @param {string} userId - User's socket ID.
   * @param {string} tabId - Target tab ID.
   * @returns {User|null} The updated user.
   */
  switchUserTab(userId, tabId) {
    const user = this.users.get(userId);
    if (!user || !this.tabs.has(tabId)) return null;
    user.activeTabId = tabId;
    return user;
  }

  /**
   * Updates tab-specific settings.
   * 
   * @param {string} tabId - Tab ID.
   * @param {Object} updates - Settings updates.
   * @returns {Object|null} The updated settings, or null if tab not found.
   */
  updateRoomSettings(tabId, updates) {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;

    const settings = tab.roomSettings;
    if (updates.backgroundImageUrl !== undefined) settings.backgroundImageUrl = updates.backgroundImageUrl;
    if (updates.showBackground !== undefined) settings.showBackground = updates.showBackground;
    if (updates.showGrid !== undefined) settings.showGrid = updates.showGrid;
    if (updates.gridSnapping !== undefined) settings.gridSnapping = updates.gridSnapping;
    if (updates.gridType !== undefined) settings.gridType = updates.gridType;
    if (updates.gridSize !== undefined) settings.gridSize = updates.gridSize;
    if (updates.customBackgroundWidth !== undefined) settings.customBackgroundWidth = updates.customBackgroundWidth;
    if (updates.customBackgroundHeight !== undefined) settings.customBackgroundHeight = updates.customBackgroundHeight;
    if (updates.gridScaleNumber !== undefined) settings.gridScaleNumber = updates.gridScaleNumber;
    if (updates.gridScaleUnit !== undefined) settings.gridScaleUnit = updates.gridScaleUnit;
    if (updates.gridColor !== undefined) settings.gridColor = updates.gridColor;
    if (updates.gridLineWidth !== undefined) settings.gridLineWidth = updates.gridLineWidth;
    if (updates.gridLineWeight !== undefined) settings.gridLineWidth = updates.gridLineWeight;
    return settings;
  }

  /**
   * Creates a new custom asset (shared across tabs).
   * 
   * @param {Object} asset - The asset details.
   * @returns {Object} The saved asset.
   */
  createAsset(asset) {
    const newAsset = {
      id: asset.id,
      name: asset.name,
      url: asset.url,
      folderId: asset.folderId || null
    };
    this.assets.set(asset.id, newAsset);
    return newAsset;
  }

  /**
   * Deletes a custom asset.
   * 
   * @param {string} assetId - The ID of the asset to delete.
   * @returns {Object|null} The deleted asset details, or null if not found.
   */
  deleteAsset(assetId) {
    const asset = this.assets.get(assetId);
    if (asset) {
      this.assets.delete(assetId);
      return asset;
    }
    return null;
  }

  /**
   * Renames a custom asset.
   * 
   * @param {string} assetId - The ID of the asset to rename.
   * @param {string} newName - The new name.
   * @returns {Object|null} The updated asset details, or null if not found.
   */
  renameAsset(assetId, newName) {
    const asset = this.assets.get(assetId);
    if (asset) {
      asset.name = newName;
      return asset;
    }
    return null;
  }

  /**
   * Creates a new custom folder.
   * 
   * @param {Object} folder - The folder details.
   * @returns {Object} The saved folder.
   */
  createFolder(folder) {
    const parentId = folder.parentId || null;
    let safeParentId = null;
    if (parentId && this.folders.has(parentId)) {
      const foldersArray = Array.from(this.folders.values());
      const depth = getFolderDepth(parentId, foldersArray);
      if (depth < MAX_FOLDER_DEPTH) {
        safeParentId = parentId;
      }
    }

    const newFolder = {
      id: folder.id,
      name: folder.name,
      parentId: safeParentId
    };
    this.folders.set(folder.id, newFolder);
    return newFolder;
  }

  /**
   * Renames a custom folder.
   * 
   * @param {string} folderId - The ID of the folder to rename.
   * @param {string} newName - The new name.
   * @returns {Object|null} The updated folder details, or null if not found.
   */
  renameFolder(folderId, newName) {
    const folder = this.folders.get(folderId);
    if (folder) {
      folder.name = newName;
      return folder;
    }
    return null;
  }

  /**
   * Moves a folder to a new parent folder (or root).
   * Validates cycles, depth limits, and sibling duplicate names.
   * 
   * @param {string} folderId - The ID of the folder to move.
   * @param {string|null} targetParentId - Target parent folder ID (null for root).
   * @returns {Object|null} The updated folder details, or null if rejected.
   */
  moveFolder(folderId, targetParentId) {
    const folder = this.folders.get(folderId);
    if (!folder) return null;

    const safeTargetParentId = targetParentId || null;
    const foldersArray = Array.from(this.folders.values());
    const validation = canMoveFolder(folderId, safeTargetParentId, foldersArray);
    if (!validation.valid) {
      return null;
    }

    folder.parentId = safeTargetParentId;
    return folder;
  }

  /**
   * Deletes a folder without cascading deletion of subfolders.
   * Promotes direct child folders and assets to the deleted folder's parentId,
   * resolving any duplicate sibling name collisions upon promotion.
   * 
   * @param {string} folderId - The ID of the folder to delete.
   * @returns {{ success: boolean, deletedFolderId?: string, fallbackParentId?: string|null, promotedFolders?: Array<Object> }}
   */
  deleteFolder(folderId) {
    const folder = this.folders.get(folderId);
    if (!folder) {
      return { success: false };
    }

    const targetParentId = folder.parentId || null;
    const promotedFolders = [];

    // Find all direct child folders
    const childFolders = [];
    for (const f of this.folders.values()) {
      if (f.parentId === folderId) {
        childFolders.push(f);
      }
    }

    // Delete folder from map before computing unique sibling names among remaining siblings
    this.folders.delete(folderId);

    // Promote child folders to targetParentId, resolving name collisions
    for (const child of childFolders) {
      const currentFolders = Array.from(this.folders.values());
      const uniqueName = resolveUniqueSiblingName(
        child.name,
        targetParentId,
        currentFolders,
        child.id
      );

      child.name = uniqueName;
      child.parentId = targetParentId;
      promotedFolders.push(child);
    }

    // Re-parent direct assets from folderId to targetParentId
    for (const asset of this.assets.values()) {
      if (asset.folderId === folderId) {
        asset.folderId = targetParentId;
      }
    }

    return {
      success: true,
      deletedFolderId: folderId,
      fallbackParentId: targetParentId,
      promotedFolders
    };
  }

  /**
   * Moves an asset to a folder.
   * 
   * @param {string} assetId - The ID of the asset.
   * @param {string|null} folderId - The ID of the target folder, or null for root.
   * @returns {Object|null} The updated asset, or null if not found.
   */
  moveAsset(assetId, folderId) {
    const asset = this.assets.get(assetId);
    if (asset) {
      asset.folderId = folderId || null;
      return asset;
    }
    return null;
  }

  /**
   * Updates a user's cursor coordinates.
   * 
   * @param {string} userId - The socket ID of the user.
   * @param {number} x - Current X coordinate.
   * @param {number} y - Current Y coordinate.
   * @returns {User|null} The updated user object, or null if user does not exist.
   */
  updateCursor(userId, x, y) {
    const user = this.users.get(userId);
    if (!user) return null;

    user.x = x;
    user.y = y;
    return user;
  }

  /**
   * Attempts to acquire a lock on a canvas element for a specific user in a tab.
   * 
   * @param {string} tabId - Tab ID.
   * @param {string} elementId - The ID of the canvas element.
   * @param {string} userId - The socket ID of the user trying to acquire the lock.
   * @returns {boolean} True if lock was acquired; false otherwise.
   */
  lockElement(tabId, elementId, userId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    // If element doesn't exist, we can't lock it
    if (!tab.elements.has(elementId)) {
      return false;
    }

    const currentLockHolder = tab.locks.get(elementId);
    if (!currentLockHolder) {
      tab.locks.set(elementId, userId);
      return true;
    }

    return currentLockHolder === userId;
  }

  /**
   * Releases a lock on a canvas element in a tab.
   * 
   * @param {string} tabId - Tab ID.
   * @param {string} elementId - The ID of the canvas element.
   * @param {string} userId - The socket ID of the user trying to release the lock.
   * @returns {boolean} True if lock was released; false otherwise.
   */
  unlockElement(tabId, elementId, userId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    const currentLockHolder = tab.locks.get(elementId);
    if (currentLockHolder === userId) {
      tab.locks.delete(elementId);
      return true;
    }
    return false;
  }

  /**
   * Updates a canvas element with new properties inside a tab.
   * 
   * @param {string} tabId - Tab ID.
   * @param {string} elementId - The ID of the element to update.
   * @param {Partial<CanvasElement>} updates - The properties to update.
   * @param {string} userId - The socket ID of the user requesting the update.
   * @returns {CanvasElement|null} The updated element, or null if update is denied.
   */
  updateElement(tabId, elementId, updates, userId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;

    const element = tab.elements.get(elementId);
    if (!element) return null;

    const lockHolder = tab.locks.get(elementId);
    if (lockHolder && lockHolder !== userId) {
      return null; // Locked by someone else
    }

    // Apply updates
    if (updates.type !== undefined) element.type = updates.type;
    if (updates.x !== undefined) element.x = updates.x;
    if (updates.y !== undefined) element.y = updates.y;
    if (updates.width !== undefined) element.width = updates.width;
    if (updates.height !== undefined) element.height = updates.height;
    if (updates.properties !== undefined) {
      element.properties = {
        ...(element.properties || {}),
        ...updates.properties
      };
    }

    return element;
  }

  /**
   * Creates a new canvas element in a tab.
   * 
   * @param {string} tabId - Tab ID.
   * @param {CanvasElement} element - The full element details.
   * @returns {CanvasElement|null} The saved canvas element.
   */
  createElement(tabId, element) {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;

    const newElement = {
      id: element.id,
      type: element.type,
      x: element.x ?? 0,
      y: element.y ?? 0,
      width: element.width ?? 100,
      height: element.height ?? 100,
      properties: element.properties || {}
    };
    tab.elements.set(element.id, newElement);
    return newElement;
  }

  /**
   * Deletes a canvas element inside a tab.
   * 
   * @param {string} tabId - Tab ID.
   * @param {string} elementId - The ID of the element to delete.
   * @param {string} userId - User socket ID.
   * @returns {boolean} True if deleted successfully.
   */
  deleteElement(tabId, elementId, userId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    if (!tab.elements.has(elementId)) {
      return false;
    }

    const lockHolder = tab.locks.get(elementId);
    if (lockHolder && lockHolder !== userId) {
      return false; // Denied: Locked by someone else
    }

    tab.elements.delete(elementId);
    tab.locks.delete(elementId); // Release any lock
    return true;
  }

  /**
   * Attempts to lock a list of elements for a user in a tab.
   * 
   * @param {string} tabId - Tab ID.
   * @param {string[]} elementIds - List of element IDs.
   * @param {string} userId - Socket ID.
   * @returns {string[]} List of successfully locked element IDs.
   */
  lockElements(tabId, elementIds, userId) {
    const locked = [];
    for (const id of elementIds) {
      if (this.lockElement(tabId, id, userId)) {
        locked.push(id);
      }
    }
    return locked;
  }

  /**
   * Unlocks a list of elements in a tab.
   * 
   * @param {string} tabId - Tab ID.
   * @param {string[]} elementIds - List of element IDs.
   * @param {string} userId - Socket ID.
   * @returns {string[]} List of successfully unlocked element IDs.
   */
  unlockElements(tabId, elementIds, userId) {
    const unlocked = [];
    for (const id of elementIds) {
      if (this.unlockElement(tabId, id, userId)) {
        unlocked.push(id);
      }
    }
    return unlocked;
  }

  /**
   * Deletes a list of elements in a tab.
   * 
   * @param {string} tabId - Tab ID.
   * @param {string[]} elementIds - List of element IDs.
   * @param {string} userId - Socket ID.
   * @returns {string[]} List of successfully deleted element IDs.
   */
  deleteElements(tabId, elementIds, userId) {
    const deleted = [];
    for (const id of elementIds) {
      if (this.deleteElement(tabId, id, userId)) {
        deleted.push(id);
      }
    }
    return deleted;
  }

  /**
   * Updates multiple elements in a batch in a tab.
   * 
   * @param {string} tabId - Tab ID.
   * @param {Array<{ elementId: string, updates: Partial<CanvasElement> }>} batchUpdates - Array of updates.
   * @param {string} userId - Socket ID.
   * @returns {CanvasElement[]} List of successfully updated elements.
   */
  updateElements(tabId, batchUpdates, userId) {
    const updated = [];
    for (const item of batchUpdates) {
      const el = this.updateElement(tabId, item.elementId, item.updates, userId);
      if (el) {
        updated.push(el);
      }
    }
    return updated;
  }

  /**
   * Renames a user in the registry.
   * 
   * @param {string} userId - User's socket ID.
   * @param {string} newName - The new name.
   * @returns {Object|null} The updated user object, or null if not found.
   */
  renameUser(userId, newName) {
    const user = this.users.get(userId);
    if (!user) return null;
    user.name = newName;
    return user;
  }

  /**
   * Recolors a user in the registry.
   * 
   * @param {string} userId - User's socket ID.
   * @param {string} newColor - The new color hex code.
   * @returns {Object|null} The updated user object, or null if not found.
   */
  recolorUser(userId, newColor) {
    const user = this.users.get(userId);
    if (!user) return null;
    user.color = newColor;
    return user;
  }

  /**
   * Releases any locks held by a user across ALL tabs.
   * 
   * @param {string} userId - The user's socket ID.
   * @returns {Array<{ tabId: string, elementId: string }>} List of element locks that were unlocked.
   */
  releaseUserLocks(userId) {
    const releasedLocks = [];
    for (const [tabId, tab] of this.tabs.entries()) {
      for (const [elementId, holderId] of tab.locks.entries()) {
        if (holderId === userId) {
          tab.locks.delete(elementId);
          releasedLocks.push({ tabId, elementId });
        }
      }
    }
    return releasedLocks;
  }

  /**
   * Cleans up state when a user disconnects:
   * Removes them from the users list and releases any locks they held across ALL tabs.
   * 
   * @param {string} userId - The socket ID of the disconnecting user.
   * @returns {{ releasedLocks: Array<{ tabId: string, elementId: string }> }} List of element locks that were unlocked.
   */
  disconnectUser(userId) {
    this.users.delete(userId);
    const releasedLocks = this.releaseUserLocks(userId);
    return { releasedLocks };
  }

  /**
   * Reorders the canvas elements based on a list of ordered element IDs.
   * 
   * @param {string} tabId - Tab ID.
   * @param {string[]} orderedIds - The new order of element IDs.
   * @returns {string[]} The resulting ordered element IDs.
   */
  reorderElements(tabId, orderedIds) {
    const tab = this.tabs.get(tabId);
    if (!tab) return [];

    const newElements = new Map();
    orderedIds.forEach((id) => {
      if (tab.elements.has(id)) {
        newElements.set(id, tab.elements.get(id));
      }
    });

    for (const [id, el] of tab.elements.entries()) {
      if (!newElements.has(id)) {
        newElements.set(id, el);
      }
    }

    tab.elements = newElements;
    return Array.from(tab.elements.keys());
  }

  /**
   * Saves the current canvas state to a JSON file.
   * 
   * @param {string} name - Name of the save.
   * @param {string} [customId] - Optional custom ID (e.g. 'autosave').
   * @returns {Object} The save metadata.
   */
  saveState(name, customId) {
    const timestamp = new Date().toISOString();
    const saveId = customId || `save_${Date.now()}`;
    
    // Map tabs to serializable structures
    const serializedTabs = Array.from(this.tabs.values()).map(tab => ({
      id: tab.id,
      name: tab.name,
      elements: Array.from(tab.elements.values()),
      roomSettings: tab.roomSettings
    }));
    
    const saveContent = {
      id: saveId,
      name: name || `Save - ${new Date().toLocaleString()}`,
      timestamp,
      tabs: serializedTabs,
      assets: Array.from(this.assets.values()),
      folders: Array.from(this.folders.values())
    };
    
    const filePath = path.join(this.savesDir, `${saveId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(saveContent, null, 2), 'utf-8');
    
    return {
      id: saveId,
      name: saveContent.name,
      timestamp
    };
  }

  /**
   * Lists all available saves sorted by timestamp descending.
   * 
   * @returns {Array<{ id: string, name: string, timestamp: string }>} List of save metadata.
   */
  listSaves() {
    if (!fs.existsSync(this.savesDir)) return [];
    
    try {
      const files = fs.readdirSync(this.savesDir);
      const saves = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = fs.readFileSync(path.join(this.savesDir, file), 'utf-8');
            const data = JSON.parse(content);
            saves.push({
              id: data.id,
              name: data.name,
              timestamp: data.timestamp
            });
          } catch (err) {
            console.error(`Error reading save file ${file}:`, err);
          }
        }
      }
      
      // Sort newest first
      return saves.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (err) {
      console.error('Error listing saves:', err);
      return [];
    }
  }

  /**
   * Loads a specific save by its ID.
   * 
   * @param {string} saveId - The ID of the save.
   * @returns {boolean} True if successful.
   */
  loadState(saveId) {
    const filePath = path.join(this.savesDir, `${saveId}.json`);
    if (!fs.existsSync(filePath)) return false;
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      // Reconstruct tabs Map
      this.tabs.clear();
      data.tabs.forEach(tabData => {
        const elementsMap = new Map();
        (tabData.elements || []).forEach(el => {
          elementsMap.set(el.id, el);
        });
        
        this.tabs.set(tabData.id, {
          id: tabData.id,
          name: tabData.name,
          elements: elementsMap,
          locks: new Map(),
          roomSettings: {
            backgroundImageUrl: null,
            showBackground: true,
            showGrid: true,
            gridSnapping: false,
            gridType: 'square',
            gridSize: 40,
            customBackgroundWidth: null,
            customBackgroundHeight: null,
            gridScaleNumber: 5,
            gridScaleUnit: 'ft',
            gridColor: null,
            gridLineWidth: 1,
            ...(tabData.roomSettings || {})
          }
        });
      });
      
      // Reconstruct assets Map
      this.assets.clear();
      (data.assets || []).forEach(asset => {
        this.assets.set(asset.id, {
          ...asset,
          folderId: asset.folderId || null
        });
      });
      
      // Reconstruct folders Map
      this.folders.clear();
      (data.folders || []).forEach(folder => {
        this.folders.set(folder.id, {
          id: folder.id,
          name: folder.name,
          parentId: folder.parentId || null
        });
      });

      // Sanitize any circular or dangling parent references from loaded save
      const loadedFolders = Array.from(this.folders.values());
      for (const f of this.folders.values()) {
        if (f.parentId) {
          if (!this.folders.has(f.parentId) || isDescendantFolder(f.parentId, f.id, loadedFolders)) {
            f.parentId = null;
          }
        }
      }
      
      return true;
    } catch (err) {
      console.error(`Error loading save ${saveId}:`, err);
      return false;
    }
  }

  /**
   * Deletes a specific save file.
   * 
   * @param {string} saveId - Save ID.
   * @returns {boolean} True if deleted successfully.
   */
  deleteSave(saveId) {
    const filePath = path.join(this.savesDir, `${saveId}.json`);
    if (!fs.existsSync(filePath)) return false;
    
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (err) {
      console.error(`Error deleting save ${saveId}:`, err);
      return false;
    }
  }

  /**
   * Automatically loads the latest save from disk.
   * Runs on server startup.
   */
  loadLatestSave() {
    const list = this.listSaves();
    if (list.length > 0) {
      const latest = list[0];
      console.log(`Auto-restoring latest save: "${latest.name}" from ${latest.timestamp}`);
      this.loadState(latest.id);
    } else {
      console.log('No existing saves found. Starting with default canvas state.');
    }
  }
}
