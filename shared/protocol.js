/**
 * Shared Socket.io event protocols and constants.
 * This serves as a tool-agnostic contract between client and server.
 */

export const EVENTS = {
  // Connection Events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',

  // Client to Server Events
  JOIN_ROOM: 'join-room',
  CURSOR_MOVE: 'cursor-move',
  USER_RENAME: 'user-rename',
  USER_RECOLOR: 'user-recolor',
  DICE_ROLL: 'dice-roll',
  ELEMENT_LOCK: 'element-lock',
  ELEMENT_UNLOCK: 'element-unlock',
  ELEMENT_UPDATE: 'element-update',
  ELEMENT_CREATE: 'element-create',
  ASSET_CREATE: 'asset-create',
  ASSET_DELETE: 'asset-delete',
  ASSET_RENAME: 'asset-rename',
  ELEMENT_DELETE: 'element-delete',
  ELEMENTS_REORDER: 'elements-reorder',
  ROOM_SETTINGS_UPDATE: 'room-settings-update',
  SAVE_CREATE: 'save-create',
  SAVE_LIST: 'save-list',
  SAVE_LOAD: 'save-load',
  SAVE_DELETE: 'save-delete',
  TAB_CREATE: 'tab-create',
  TAB_DELETE: 'tab-delete',
  TAB_RENAME: 'tab-rename',
  TAB_SWITCH: 'tab-switch',

  // Server to Client Broadcast Events
  USER_JOINED: 'user-joined',
  USER_RENAMED: 'user-renamed',
  USER_RECOLORED: 'user-recolored',
  USER_LEFT: 'user-left',
  CURSOR_UPDATE: 'cursor-update',
  ELEMENT_LOCKED: 'element-locked',
  ELEMENT_UNLOCKED: 'element-unlocked',
  ELEMENT_UPDATED: 'element-updated',
  ELEMENT_UPDATED_BATCH: 'element-updated-batch',
  ELEMENT_CREATED: 'element-created',
  ELEMENT_DELETED: 'element-deleted',
  ASSET_CREATED: 'asset-created',
  ASSET_DELETED: 'asset-deleted',
  ASSET_RENAMED: 'asset-renamed',
  ELEMENTS_REORDERED: 'elements-reordered',
  ROOM_SETTINGS_UPDATED: 'room-settings-updated',
  TAB_CREATED: 'tab-created',
  TAB_DELETED: 'tab-deleted',
  TAB_RENAMED: 'tab-renamed',
  DICE_ROLLED: 'dice-rolled',
  TAB_SWITCHED: 'tab-switched',
  ROOM_STATE_LOADED: 'room-state-loaded',
};
