# Tasks

## 📦 WS5 — Housekeeping
- `[x]` 5.1 Add the changelog note at the top of the Workflows section in `agent.md`.
- `[x]` 5.2 Cross-check and verify that `STRUCTURE.md` documents every file added by the refactor.

## 📦 WS1 — Finish Stage 7: Protocol Rewiring
- `[x]` 1.1 Import `EVENTS` from protocol in `client/src/components/canvas/Canvas.jsx` and `client/src/components/sidebar/RightSidebar.jsx`.
- `[x]` 1.2 Systematic rewire of the 18 hardcoded socket event emits in `Canvas.jsx` (17) and `RightSidebar.jsx` (1).
- `[x]` 1.3 Verify zero hardcoded emits remain via `git grep` count test.

## 📦 WS4 — Slim AppContent.jsx (Stage 8)
- `[x]` 4.1 Move active tool states (`activeTool`, `penColor`, `penSize`, `eraserSize`) to `uiStore.js`.
- `[x]` 4.2 Move canvas configurations (`showCursorNames`, `activeVirtualDimensions`, `showSavesModal`) to `uiStore.js`.
- `[x]` 4.3 Move selection transform references (`inspectorLockRef`, `originalInspectorElementsRef`) to `selectionStore.js`.
- `[x]` 4.4 Verify and resolve `activeTabIdRef` mapping.
- `[x]` 4.5 Ensure `AppContent.jsx` is under 500 lines.

## 📦 WS2 — Replace Existence-Only Tests with Behavioral Tests
- `[x]` 2.1 Delete the 20 definition check assertions.
- `[x]` 2.2 Add math behavioral tests for hit-testing math (`CanvasSelection.test.js`) and rotations (`DiceMath.test.js`).
- `[x]` 2.3 Add store reducer behavioral tests (`historyStore.test.js`, `clipboardStore.test.js`, `canvasStore.test.js`).
- `[x]` 2.4 Verify test coverage meets target thresholds (≥70% statements / ≥60% branches).

## 📦 WS3 — Rewrite walkthrough.md
- `[x]` 3.1 Restructure walkthrough to separate legacy 2024 work from the current refactor.
- `[x]` 3.2 Update exact line count metrics and document remediation achievements.
- `[x]` 3.3 Paste final verification logs and checks.

## 📦 WS6 — Revamped Elements Layer Ordering Manager
- `[x]` 6.1 Add `locateElementTrigger` state and context exports to `uiStore.js`.
- `[x]` 6.2 Destructure and pass `locateElementTrigger` and its setter in `AppContent.jsx`.
- `[x]` 6.3 Implement locating and viewport panning/centering in `Canvas.jsx` via `useEffect`.
- `[x]` 6.4 Add `searchQuery` and `activeFilter` states, search input, filter chips, styled swatches, quick front/back shifting, and locate button to `RightSidebar.jsx`.
- `[x]` 6.5 Verify linter, unit tests, and production build.

## 📦 WS7 — Collaborative Image & Asset Library Manager
- `[x]` 7.1 Add new events to `shared/protocol.js`.
- `[x]` 7.2 Implement `deleteAsset` and `renameAsset` in `server/registry.js`.
- `[x]` 7.3 Handle `ASSET_DELETE` and `ASSET_RENAME` in `server/handlers/elementHandler.js`.
- `[x]` 7.4 Add search, filters, rename, and delete actions to `client/src/state/uploadStore.js`.
- `[x]` 7.5 Register asset delete/rename broadcast listeners in `useElementEvents.js`.
- `[x]` 7.6 Implement `onDragOver` and `onDrop` in `Canvas.jsx` to spawn assets.
- `[x]` 7.7 Add search/filters controls, draggable items, and rename/delete buttons to `LeftSidebar.jsx`.
- `[x]` 7.8 Run ESLint, tests, and build checks.

## 📦 WS8 — Collaborative Folder Management for Assets
- `[x]` 8.1 Register folder and move events in `shared/protocol.js`.
- `[x]` 8.2 Add folder Map and mutations in `server/registry.js` (including save/load serialization).
- `[x]` 8.3 Handle folder CRUD and move events in `server/handlers/elementHandler.js`.
- `[x]` 8.4 Add folder states and actions to `client/src/state/uploadStore.js` and initialize on join.
- `[x]` 8.5 Register folder broadcast sync listeners in `useElementEvents.js`.
- `[x]` 8.6 Redesign `LeftSidebar.jsx` images tab to support folders tree rendering, Collapsible views, and CRUD controls.
- `[x]` 8.7 Implement drag-to-move-assets-to-folders logic in `LeftSidebar.jsx` dropzones.
- `[x]` 8.8 Add folder unit tests in `uploadStore.test.js` and verify builds.

## 📦 WS9 — Inspector Panel Selection Behavior Update
- `[x]` 9.1 Update `handleCanvasInteraction` in `client/src/state/uiStore.js` to prevent auto-opening or collapsing the inspector panel on token selection or canvas interaction.
- `[x]` 9.2 Update unit test in `client/src/state/__tests/stores.test.js` to assert the updated behavior.
- `[x]` 9.3 Run linter, test coverage, and build checks.
- `[x]` 9.4 Sync artifacts, commit, and push.

## 📦 WS10 — Touchscreen Drag Reliability Fix
- `[x]` 10.1 Add CSS `touch-action: none` / `touch-none` to `containerRef` and `<canvas>`.
- `[x]` 10.2 Add `handlePointerCancel` and attach `onPointerCancel` and `onLostPointerCapture` to clean up active pointers and drag states without leaving zombie pointers.
- `[x]` 10.3 Guard `handlePointerLeave` so captured drags are not prematurely terminated when crossing boundaries.
- `[x]` 10.4 Wrap `setPointerCapture` and `releasePointerCapture` calls in `try...catch` and check `hasPointerCapture`.
- `[x]` 10.5 Add `e.preventDefault()` on `pointerdown` for touch events and isolate floating zoom controls.
- `[x]` 10.6 Run ESLint, tests, and production build checks.
- `[x]` 10.7 Sync artifacts, commit, and push.

## 📦 WS11 — Multi-Room Canvas Architecture & Room Discovery
- `[x]` 11.1 Update `shared/protocol.js` with `ROOMS_LIST`, `ROOMS_UPDATED`, and `LEAVE_ROOM` events.
- `[x]` 11.2 Refactor `server/registry.js` to scope saves by `roomId` and migrate legacy root saves into `server/saves/canvas-default/`.
- `[x]` 11.3 Create `server/roomManager.js` to manage multi-room instances, sanitize room IDs, and list active/saved rooms.
- `[x]` 11.4 Update `server/server.js` with `roomManager`, `GET /api/rooms`, and room-scoped uploads `POST /api/upload?roomId=...`.
- `[x]` 11.5 Rewire `server/handlers/*` (`connectionHandler`, `elementHandler`, `tabHandler`, `diceHandler`, `saveHandler`) to look up room registry via `roomManager` and isolate broadcasts to `socket.roomId`.
- `[x]` 11.6 Redesign `client/src/components/lobby/Lobby.jsx` with an Available Rooms browser, live user count badges, 1-click join, random room generator, and deep linking via `?room=...`.
- `[x]` 11.7 Update `Header.jsx`, `App.jsx`, and `uploadStore.js` with "Copy Invite Link", "Switch Room", and room-scoped image uploads.
- `[x]` 11.8 Write tests for `roomManager`, verify ESLint, all client tests, and production build.
- `[x]` 11.9 Sync artifacts, commit, and push.



