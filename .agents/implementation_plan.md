# Collaborative Image Library Folder Management Implementation Plan

Add collaborative folder organization for custom uploaded images and presets in the Left Sidebar asset manager, including socket sync events, database storage, drag-and-drop folder moves, and collapsible UI widgets.

## User Review Required

> [!IMPORTANT]
> - We will modify `shared/protocol.js` to add folder events. Both backend and frontend will be updated in the same change to prevent protocol drift.
> - Deleting a folder will automatically move all of its assets back to the root folder (no files will be deleted).

## Proposed Changes

### Protocol Definition

#### [MODIFY] [protocol.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/shared/protocol.js)
- Add events:
  - `FOLDER_CREATE`, `FOLDER_CREATED`
  - `FOLDER_RENAME`, `FOLDER_RENAMED`
  - `FOLDER_DELETE`, `FOLDER_DELETED`
  - `ASSET_MOVE`, `ASSET_MOVED`

### Backend Registry & State

#### [MODIFY] [registry.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/registry.js)
- Maintain `this.folders = new Map()` in `CanvasRegistry`.
- Update `joinRoom` to return `folders: Array.from(this.folders.values())`.
- Add registry mutations:
  - `createFolder(folder)`
  - `renameFolder(folderId, name)`
  - `deleteFolder(folderId)` (deletes folder and updates any referencing assets' `folderId` to `null`).
  - `moveAsset(assetId, folderId)` (updates `folderId` on the asset).
- Update `saveState` and `loadState` to serialize/deserialize the `folders` registry.

### Backend Handlers

#### [MODIFY] [elementHandler.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/handlers/elementHandler.js)
- Register socket event listeners:
  - `EVENTS.FOLDER_CREATE` -> calls `createFolder` and broadcasts `EVENTS.FOLDER_CREATED`.
  - `EVENTS.FOLDER_RENAME` -> calls `renameFolder` and broadcasts `EVENTS.FOLDER_RENAMED`.
  - `EVENTS.FOLDER_DELETE` -> calls `deleteFolder` and broadcasts `EVENTS.FOLDER_DELETED`.
  - `EVENTS.ASSET_MOVE` -> calls `moveAsset` and broadcasts `EVENTS.ASSET_MOVED`.

### Client State Store

#### [MODIFY] [uploadStore.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/uploadStore.js)
- Add local state `folders` array.
- Expose methods:
  - `handleCreateFolder(name)`
  - `handleRenameFolder(folderId, name)`
  - `handleDeleteFolder(folderId)`
  - `handleMoveAsset(assetId, folderId)`
- Update room loading sequence to initialize the local `folders` state when `join-room` response is received.

#### [MODIFY] [useElementEvents.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/hooks/useElementEvents.js)
- Add broadcast event listeners:
  - `EVENTS.FOLDER_CREATED` -> appends the folder.
  - `EVENTS.FOLDER_RENAMED` -> updates the folder name.
  - `EVENTS.FOLDER_DELETED` -> removes the folder and resets asset references to `null`.
  - `EVENTS.ASSET_MOVED` -> updates the asset's `folderId`.

### Client Sidebar View

#### [MODIFY] [LeftSidebar.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/LeftSidebar.jsx)
- Render a new "Create Folder" button/form at the top of the images panel.
- Implement collapsible folder drawer items:
  - Show a folder icon, name, rename edit button, and delete folder button.
  - Act as a dropzone: `onDragOver` prevents default and `onDrop` dispatches `handleMoveAsset(draggedAssetId, folder.id)`.
  - Render nested assets that match the active filters, search, and belong to the folder.
- Render a "Root Library" dropzone to allow dragging items back to the root folder.
- Add local UI states to manage collapsed folder state (`collapsedFolderIds` array).

## Verification Plan

### Automated Tests
- Run `npm --prefix client run lint` to ensure zero errors.
- Run `npm --prefix client run test -- --coverage --run` to verify tests pass.
- Run `npm --prefix client run build` to verify compiling is clean.
- Update `uploadStore.test.js` to assert folder creation, renaming, deletion, and asset movement.

### Manual Verification
- Create a folder, rename it, and verify it updates for other clients in real time.
- Drag an image card and drop it onto a folder header, verifying it moves inside.
- Drag it back out to the "Root Library" dropzone.
- Save the room state, restart the server, reload the save, and verify folder structures are fully restored.
