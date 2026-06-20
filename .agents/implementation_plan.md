# Collaborative Image & Asset Library Manager Implementation Plan

Implement collaborative image management enhancements (search, filtering, renaming, permanent disk deletion, and drag-and-drop spawning onto precise coordinates) in the client and server.

## User Review Required

We will modify `shared/protocol.js` to add new socket events. This is a three-file change committed together, complying with protocol drift rules.

## Proposed Changes

### Protocol definition

#### [MODIFY] [protocol.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/shared/protocol.js)
- Add events `ASSET_DELETE`, `ASSET_DELETED`, `ASSET_RENAME`, `ASSET_RENAMED`.

### Backend registry

#### [MODIFY] [registry.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/registry.js)
- Add `deleteAsset(assetId)` and `renameAsset(assetId, name)` methods to the `StateRegistry` class.

### Backend Handlers

#### [MODIFY] [elementHandler.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/handlers/elementHandler.js)
- Register `EVENTS.ASSET_DELETE` socket event. It deletes the asset from registry, deletes the physical upload file from disk, and broadcasts `EVENTS.ASSET_DELETED`.
- Register `EVENTS.ASSET_RENAME` socket event. It renames the asset in registry and broadcasts `EVENTS.ASSET_RENAMED`.

### Client State Store

#### [MODIFY] [uploadStore.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/uploadStore.js)
- Add local states `searchQuery` (string) and `activeFilter` (`'all' | 'presets' | 'uploads'`).
- Update `visibleAssets` and `hiddenAssets` selectors to support `searchQuery` and `activeFilter`.
- Implement client callbacks `handleRenameAsset(assetId, name)` and `handleDeleteAsset(assetId)` which emit corresponding socket events.

#### [MODIFY] [useElementEvents.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/hooks/useElementEvents.js)
- Listen to `EVENTS.ASSET_DELETED` and remove the asset from `assets` state.
- Listen to `EVENTS.ASSET_RENAMED` and update the asset name in `assets` state.

### Client Viewport Interaction

#### [MODIFY] [Canvas.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/Canvas.jsx)
- Add HTML5 `onDragOver` and `onDrop` event listeners to the canvas layout container.
- When an asset is dropped, calculate the drop coordinate `(vx, vy)` based on zoom/pan viewport transform, and spawn the image at that location.

### Client Sidebar View

#### [MODIFY] [LeftSidebar.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/LeftSidebar.jsx)
- Add search input and quick category filter chips (`All`, `Presets`, `Uploads`) above the images list.
- Allow dragging image cards by setting `draggable="true"` and defining `onDragStart`.
- Add inline edit/rename rename input and a permanent deletion trash button (only visible for user-uploaded assets).

## Verification Plan

### Automated Tests
- Run `npm --prefix client run lint` to ensure zero warnings or errors.
- Run `npm --prefix client run test -- --coverage --run` to verify all tests pass.
- Run `npm --prefix client run build` to verify production build.
- Add unit tests for `uploadStore` assets filtering, renaming, and deletion.

### Manual Verification
- Upload files, verify search and filter chips update list in real-time.
- Rename an asset and verify it updates for other users in the room.
- Permanently delete an asset and verify the file is removed from server disk and other users' lists.
- Drag an image from the sidebar and drop it onto the canvas, verifying it spawns at the correct cursor position.
