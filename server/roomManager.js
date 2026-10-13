import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CanvasRegistry, sanitizeRoomId, migrateLegacyRootSaves } from './registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseSavesDir = path.join(__dirname, 'saves');

/**
 * Formats a room ID into a user-friendly display name.
 * e.g. "canvas-default" -> "Canvas Default", "dungeon-1" -> "Dungeon 1"
 * 
 * @param {string} id 
 * @returns {string}
 */
function formatRoomName(id) {
  if (!id) return 'Canvas Default';
  return id
    .split(/[-_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Manages multiple collaborative canvas rooms, isolating their in-memory
 * states, tabs, users, elements, assets, and saves.
 */
export class RoomManager {
  constructor() {
    /**
     * Map of active in-memory rooms keyed by sanitized roomId.
     * @type {Map<string, CanvasRegistry>}
     */
    this.rooms = new Map();

    // Migrate any legacy flat saves from server/saves/ into server/saves/canvas-default/
    migrateLegacyRootSaves();
  }

  /**
   * Retrieves an existing room or creates and initializes a new one.
   * If a saved state exists on disk for this room, it is automatically restored.
   * 
   * @param {string} roomId - Raw room identifier.
   * @returns {CanvasRegistry} The room's CanvasRegistry instance.
   */
  getOrCreateRoom(roomId) {
    const safeId = sanitizeRoomId(roomId);
    if (this.rooms.has(safeId)) {
      return this.rooms.get(safeId);
    }

    const registry = new CanvasRegistry(safeId);
    try {
      registry.loadLatestSave();
    } catch (err) {
      console.error(`Failed to load latest save for room ${safeId}:`, err);
    }

    this.rooms.set(safeId, registry);
    return registry;
  }

  /**
   * Retrieves an in-memory room by ID if it exists.
   * 
   * @param {string} roomId 
   * @returns {CanvasRegistry | null}
   */
  getRoom(roomId) {
    const safeId = sanitizeRoomId(roomId);
    return this.rooms.get(safeId) || null;
  }

  /**
   * Checks whether a room is currently active in memory.
   * 
   * @param {string} roomId 
   * @returns {boolean}
   */
  hasRoom(roomId) {
    const safeId = sanitizeRoomId(roomId);
    return this.rooms.has(safeId);
  }

  /**
   * Disconnects a user from a specific room.
   * 
   * @param {string} socketId - The socket ID.
   * @param {string} roomId - The room ID.
   * @returns {{ releasedLocks: Array<{ elementId: string, tabId: string }> }}
   */
  removeUser(socketId, roomId) {
    const safeId = sanitizeRoomId(roomId);
    const registry = this.rooms.get(safeId);
    if (!registry) {
      return { releasedLocks: [] };
    }

    return registry.disconnectUser(socketId);
  }

  /**
   * Lists all available rooms (both active in-memory rooms and rooms saved on disk).
   * 
   * @returns {Array<Object>} List of room summaries.
   */
  listRooms() {
    const knownRoomIds = new Set(this.rooms.keys());

    // Also discover rooms that have save directories on disk
    if (fs.existsSync(baseSavesDir)) {
      try {
        const entries = fs.readdirSync(baseSavesDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            knownRoomIds.add(sanitizeRoomId(entry.name));
          }
        }
      } catch (err) {
        console.error('Failed to read saves directories for room listing:', err);
      }
    }

    // Always ensure canvas-default is listed
    knownRoomIds.add('canvas-default');

    const result = [];
    for (const id of knownRoomIds) {
      const activeRegistry = this.rooms.get(id);

      let activeUsers = 0;
      let userList = [];
      let tabCount = 1;
      let elementsCount = 0;
      let hasSave = false;
      let lastActive = null;

      if (activeRegistry) {
        activeUsers = activeRegistry.users.size;
        userList = Array.from(activeRegistry.users.values()).map(u => ({
          id: u.id,
          name: u.name,
          color: u.color
        }));
        tabCount = activeRegistry.tabs.size;
        for (const tab of activeRegistry.tabs.values()) {
          elementsCount += tab.elements.size;
        }
      }

      // Check saves on disk for this room
      const roomSavesDir = path.join(baseSavesDir, id);
      if (fs.existsSync(roomSavesDir)) {
        try {
          const files = fs.readdirSync(roomSavesDir).filter(f => f.endsWith('.json'));
          hasSave = files.length > 0;
          if (files.length > 0) {
            // Find newest file timestamp
            let newestMtime = 0;
            for (const file of files) {
              const stat = fs.statSync(path.join(roomSavesDir, file));
              if (stat.mtimeMs > newestMtime) {
                newestMtime = stat.mtimeMs;
              }
            }
            if (newestMtime > 0) {
              lastActive = new Date(newestMtime).toISOString();
            }
          }
        } catch {
          // Ignore filesystem errors
        }
      }

      result.push({
        id,
        name: formatRoomName(id),
        activeUsers,
        users: userList,
        tabCount,
        elementsCount,
        hasSave,
        lastActive: lastActive || new Date().toISOString()
      });
    }

    // Sort: Rooms with active users first, then by lastActive descending
    return result.sort((a, b) => {
      if (b.activeUsers !== a.activeUsers) {
        return b.activeUsers - a.activeUsers;
      }
      return new Date(b.lastActive) - new Date(a.lastActive);
    });
  }

  /**
   * Triggers an autosave for all active in-memory rooms.
   */
  autosaveAllRooms() {
    let savedCount = 0;
    for (const [id, registry] of this.rooms.entries()) {
      try {
        // Only autosave rooms that have elements, tabs, or users
        if (registry.users.size > 0 || registry.tabs.size > 0) {
          registry.saveState('Autosave (Auto)', 'autosave');
          savedCount++;
        }
      } catch (err) {
        console.error(`Failed to autosave room ${id}:`, err);
      }
    }
    return savedCount;
  }
}
