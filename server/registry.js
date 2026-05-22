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
  }

  /**
   * Registers a user joining the room.
   * 
   * @param {string} userId - The socket ID of the user.
   * @param {string} name - The display name of the user.
   * @param {string} color - The color assigned to the user's cursor.
   * @returns {{ users: User[], elements: CanvasElement[], locks: [string, string][] }} The current state of the room.
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
      locks: Array.from(this.locks.entries())
    };
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
}
