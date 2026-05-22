/**
 * @typedef {Object} User
 * @property {string} id - The unique socket ID of the user.
 * @property {string} name - The user's display name.
 * @property {string} color - The user's assigned cursor/active color.
 * @property {number} x - The user's current cursor X coordinate.
 * @property {number} y - The user's current cursor Y coordinate.
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
 * Manages users, canvas elements, and element locks to ensure consistent state.
 */
export class CanvasRegistry {
  constructor() {
    /**
     * Map of active users, keyed by their socket ID.
     * @type {Map<string, User>}
     */
    this.users = new Map();

    /**
     * Map of canvas elements, keyed by element ID.
     * @type {Map<string, CanvasElement>}
     */
    this.elements = new Map();

    /**
     * Map of element locks, mapping element ID to the holding user's socket ID.
     * @type {Map<string, string>}
     */
    this.locks = new Map();

    /**
     * Map of custom uploaded assets, keyed by asset ID.
     * @type {Map<string, Object>}
     */
    this.assets = new Map();
  }

  /**
   * Registers a user joining the room.
   * 
   * @param {string} userId - The socket ID of the user.
   * @param {string} name - The display name of the user.
   * @param {string} color - The color assigned to the user's cursor.
   * @returns {{ users: User[], elements: CanvasElement[], locks: [string, string][], assets: Object[] }} The current state of the room.
   */
  joinRoom(userId, name, color) {
    const user = {
      id: userId,
      name: name || `User_${userId.substring(0, 4)}`,
      color: color || '#000000',
      x: 0,
      y: 0
    };
    this.users.set(userId, user);

    return {
      users: Array.from(this.users.values()),
      elements: Array.from(this.elements.values()),
      locks: Array.from(this.locks.entries()),
      assets: Array.from(this.assets.values())
    };
  }

  /**
   * Creates a new custom asset.
   * 
   * @param {Object} asset - The asset details.
   * @returns {Object} The saved asset.
   */
  createAsset(asset) {
    const newAsset = {
      id: asset.id,
      name: asset.name,
      url: asset.url
    };
    this.assets.set(asset.id, newAsset);
    return newAsset;
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
   * Attempts to acquire a lock on a canvas element for a specific user.
   * Prevent collisions by allowing only one user to edit/move an element at a time.
   * 
   * @param {string} elementId - The ID of the canvas element.
   * @param {string} userId - The socket ID of the user trying to acquire the lock.
   * @returns {boolean} True if lock was successfully acquired or is already held by the user; false otherwise.
   */
  lockElement(elementId, userId) {
    // If element doesn't exist, we can't lock it
    if (!this.elements.has(elementId)) {
      return false;
    }

    const currentLockHolder = this.locks.get(elementId);
    if (!currentLockHolder) {
      this.locks.set(elementId, userId);
      return true;
    }

    return currentLockHolder === userId;
  }

  /**
   * Releases a lock on a canvas element.
   * 
   * @param {string} elementId - The ID of the canvas element.
   * @param {string} userId - The socket ID of the user trying to release the lock.
   * @returns {boolean} True if lock was released; false if user doesn't hold the lock or lock didn't exist.
   */
  unlockElement(elementId, userId) {
    const currentLockHolder = this.locks.get(elementId);
    if (currentLockHolder === userId) {
      this.locks.delete(elementId);
      return true;
    }
    return false;
  }

  /**
   * Updates a canvas element with new properties.
   * Checks locks to ensure only the lock owner (or if unlocked) can update the element.
   * 
   * @param {string} elementId - The ID of the element to update.
   * @param {Partial<CanvasElement>} updates - The properties to update.
   * @param {string} userId - The socket ID of the user requesting the update.
   * @returns {CanvasElement|null} The updated element, or null if update is denied or element not found.
   */
  updateElement(elementId, updates, userId) {
    const element = this.elements.get(elementId);
    if (!element) return null;

    const lockHolder = this.locks.get(elementId);
    // Deny update if locked by someone else
    if (lockHolder && lockHolder !== userId) {
      return null;
    }

    // Apply updates
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
   * Creates a new canvas element.
   * 
   * @param {CanvasElement} element - The full element details.
   * @returns {CanvasElement} The saved canvas element.
   */
  createElement(element) {
    const newElement = {
      id: element.id,
      type: element.type,
      x: element.x ?? 0,
      y: element.y ?? 0,
      width: element.width ?? 100,
      height: element.height ?? 100,
      properties: element.properties || {}
    };
    this.elements.set(element.id, newElement);
    return newElement;
  }

  /**
   * Deletes a canvas element.
   * Checks locks to ensure only the lock owner (or if unlocked) can delete.
   * 
   * @param {string} elementId - The ID of the element to delete.
   * @param {string} userId - The socket ID of the user requesting deletion.
   * @returns {boolean} True if deletion was successful; false if denied or not found.
   */
  deleteElement(elementId, userId) {
    if (!this.elements.has(elementId)) {
      return false;
    }

    const lockHolder = this.locks.get(elementId);
    if (lockHolder && lockHolder !== userId) {
      return false; // Denied: Locked by someone else
    }

    // Perform deletion
    this.elements.delete(elementId);
    this.locks.delete(elementId); // Release any lock
    return true;
  }

  /**
   * Attempts to lock a list of elements for a user.
   * 
   * @param {string[]} elementIds - List of element IDs.
   * @param {string} userId - Socket ID.
   * @returns {string[]} List of successfully locked element IDs.
   */
  lockElements(elementIds, userId) {
    const locked = [];
    for (const id of elementIds) {
      if (this.lockElement(id, userId)) {
        locked.push(id);
      }
    }
    return locked;
  }

  /**
   * Unlocks a list of elements.
   * 
   * @param {string[]} elementIds - List of element IDs.
   * @param {string} userId - Socket ID.
   * @returns {string[]} List of successfully unlocked element IDs.
   */
  unlockElements(elementIds, userId) {
    const unlocked = [];
    for (const id of elementIds) {
      if (this.unlockElement(id, userId)) {
        unlocked.push(id);
      }
    }
    return unlocked;
  }

  /**
   * Deletes a list of elements.
   * 
   * @param {string[]} elementIds - List of element IDs.
   * @param {string} userId - Socket ID.
   * @returns {string[]} List of successfully deleted element IDs.
   */
  deleteElements(elementIds, userId) {
    const deleted = [];
    for (const id of elementIds) {
      if (this.deleteElement(id, userId)) {
        deleted.push(id);
      }
    }
    return deleted;
  }

  /**
   * Updates multiple elements in a batch.
   * 
   * @param {Array<{ elementId: string, updates: Partial<CanvasElement> }>} batchUpdates - Array of updates.
   * @param {string} userId - Socket ID.
   * @returns {CanvasElement[]} List of successfully updated elements.
   */
  updateElements(batchUpdates, userId) {
    const updated = [];
    for (const item of batchUpdates) {
      const el = this.updateElement(item.elementId, item.updates, userId);
      if (el) {
        updated.push(el);
      }
    }
    return updated;
  }

  /**
   * Cleans up state when a user disconnects:
   * Removes them from the users list and releases any locks they held.
   * 
   * @param {string} userId - The socket ID of the disconnecting user.
   * @returns {{ releasedLocks: string[] }} List of element IDs that were unlocked.
   */
  disconnectUser(userId) {
    this.users.delete(userId);

    const releasedLocks = [];
    for (const [elementId, holderId] of this.locks.entries()) {
      if (holderId === userId) {
        this.locks.delete(elementId);
        releasedLocks.push(elementId);
      }
    }

    return { releasedLocks };
  }

  /**
   * Reorders the canvas elements based on a list of ordered element IDs.
   * 
   * @param {string[]} orderedIds - The new order of element IDs.
   * @returns {string[]} The resulting ordered element IDs.
   */
  reorderElements(orderedIds) {
    const newElements = new Map();
    orderedIds.forEach((id) => {
      if (this.elements.has(id)) {
        newElements.set(id, this.elements.get(id));
      }
    });

    // Add any remaining elements that weren't in orderedIds to prevent data loss
    for (const [id, el] of this.elements.entries()) {
      if (!newElements.has(id)) {
        newElements.set(id, el);
      }
    }

    this.elements = newElements;
    return Array.from(this.elements.keys());
  }
}
