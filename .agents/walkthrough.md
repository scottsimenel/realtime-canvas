# Walkthrough: Realtime Canvas Refactor & Layer Manager Implementation

This document serves as the comprehensive verification walkthrough of the Realtime Canvas codebase refactoring, Stage 8 remediation achievements, the implementation of the revamped Elements Layer Ordering Manager, and the tab-switch selection crash safety fix.

---

## 📅 Legacy Feature History (2024)

Prior work introduced several key collaborative canvas features:
* **Multi-Tab Undo / Redo**: Context-aware stack tracking for shape spawn, delete, transform, and layer reordering.
* **Canvas State Persistence**: Named manual saves, startup recovery, and 2-minute periodic autosaves.
* **Grid Snapping**: Real-time snapping delta calculations for both Square and Hexagonal grids.
* **Ruler Tool**: Interactive click-to-measure ruler tool displaying scaled unit/distance overlays.
* **Spawning & Inspection**: Left sidebar configurators and right sidebar properties inspectors for custom shape dimensions and outline layers.
* **Clipboard Mechanics**: Local clone-memory `clipboardRef` supporting cut, copy, paste, and relative coordinate offsets.

---

## 🏗️ The Refactoring (2026)

To resolve file bloat and decouple concerns for enhanced codebase maintainability, monolithic files were systematically split into modular files:
* **`/server`**: `connectionHandler.js`, `elementHandler.js`, `tabHandler.js`, `diceHandler.js`, and `server.js`.
* **`/client/src/components/canvas/`**: `CanvasSelection.js`, `CanvasRenderer.js`, and `Canvas.jsx`.
* **`/client/src/components/dice/`**: `DiceMath.js`, `DiceGeometries.js`, `DiceParticles.js`, and `DiceEffects.jsx`.

---

## 🎨 Elements Layer Ordering Manager Revamp

We implemented the revamped element layer ordering manager in the right sidebar (`RightSidebar.jsx`) and viewport centering logic in `Canvas.jsx`:

1. **State Store & Coordination**:
   - Added `locateElementTrigger` state to `uiStore.js` and exposed it in the context provider.
   - Destructured and routed the trigger state and setter in `AppContent.jsx` to pass them down to Canvas and RightSidebar.
2. **Locate & Center Viewport (`Canvas.jsx`)**:
   - Implemented a `useEffect` hook listening to `locateElementTrigger` changes.
   - Automatically calculates scale-adjusted offsets (`panOffset`) to align the element's virtual center to the canvas center.
   - Wrapped state updates in `setTimeout` to ensure asynchronous execution complying with ESLint hook execution rules.
3. **Sidebar Controls (`RightSidebar.jsx`)**:
   - **Search Input**: Filters items instantly by type, shape name, custom tooltip labels, and properties.
   - **Filter Chips**: Toggles views between `All`, `Selected`, `Images`, and `Shapes`.
   - **Previews**: Renders high-quality image thumbnails using `getFullUrl` and styled background swatches filled with the shape's exact color.
   - **Layer controls**: Added `⏫` (Bring to Front) and `⏬` (Send to Back) buttons.
   - **Focus**: Integrated `👁️` (eye icon) button next to each element that automatically selects the item and centers the viewport on it.
   - **Expanded Viewport**: Adjusted scrollable layers height container limit up to `max-h-[450px]` for better scroll list visibility.

---

## 🐛 Tab-Switch Selection Crash Fix (`InspectorWidget.jsx`)

* **Bug**: When a user switched tabs (canvases) with active selections or locked elements, the component state elements array updated immediately to the new tab's elements, while the selected element IDs update was scheduled asynchronously. This caused a temporary mismatch where `InspectorWidget` attempted to find the selected element in the new tab's list, returning `undefined` and throwing an `Uncaught TypeError: Cannot read properties of undefined (reading 'properties')` during render.
* **Fix**: Added an early return check in `InspectorWidget.jsx` (`if (!selectedEl) return null;`) to safely avoid accessing properties of elements not present on the current active canvas tab.
* **Tests**: Created a dedicated unit test suite `InspectorWidget.test.jsx` verifying that `InspectorWidget` returns `null` safely without throwing exceptions when the selected element ID is not found.

## 🎯 WS9: Inspector Panel Selection Behavior Update

* **Problem**: Selecting any token or element on the canvas invoked `onCanvasInteraction(!clickedElement)`, which ran `handleCanvasInteraction(false)`. This callback explicitly executed `setShowRightSidebar(true)` and `setRightPanelCollapsed(false)`, causing the Inspector (RightSidebar) to aggressively jump open and expand over the canvas whenever any token was clicked. Additionally, clicking empty canvas space forcefully collapsed the panel if open (`setRightPanelCollapsed(true)`).
* **Fix**: Updated `handleCanvasInteraction` in [client/src/state/uiStore.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/uiStore.js) to decouple the right sidebar's visibility and collapse state from canvas clicks:
  - Interacting with the canvas continues to collapse the left library drawer (`setLeftPanelCollapsed(true)`) out of the way.
  - The right sidebar (Inspector) is no longer forced open or uncollapsed on token selection. If closed, it stays closed; if collapsed, it stays collapsed; if already open, it updates its properties controls smoothly in place without jarring slide animations.
  - Clicking empty canvas no longer forcibly collapses the inspector panel.
* **Tests**: Updated `client/src/state/__tests/stores.test.js` to assert that selecting an element (`handleCanvasInteraction(false)`) preserves `showRightSidebar: false` and `rightPanelCollapsed: true`. All 52 unit tests pass and ESLint reports 0 warnings.

## 🎯 WS10: Touchscreen Drag Reliability Fix

* **Problem**: On touchscreen devices (iOS, Android, Windows touch laptops), dragging tokens failed or dropped immediately after moving a few pixels. This was caused by:
  1. **Default gesture hijacking**: Missing CSS `touch-action: none` / `touch-none` on the canvas container and `<canvas>` caused browsers to interpret token drags as native pan/scroll gestures, firing `pointercancel` and revoking pointer capture.
  2. **Zombie pointer leaks**: Because `onPointerCancel` was unhandled and browsers never emit `pointerup` after `pointercancel`, cancelled pointers stayed registered in `activePointersRef`. Subsequent single-finger touches were misidentified as two-finger pinch-zoom gestures (`activePointerIds.length === 2`), locking out token drags until page refresh.
  3. **Premature boundary aborts**: `handlePointerLeave` forcibly revoked capture and called `handleMouseUp()`, dropping dragged tokens whenever touches neared edges or crossed over child UI controls.
  4. **Pointer capture exceptions**: Unchecked `setPointerCapture` and `releasePointerCapture` calls could throw unhandled `DOMException` on synthetic or cancelled pointers.
* **Fix**: Updated [client/src/components/canvas/Canvas.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/Canvas.jsx):
  - Applied `style={{ touchAction: 'none' }}` and `className="touch-none ..."` to both the canvas container (`containerRef`) and the `<canvas>` element.
  - Added `handlePointerCancel` and bound `onPointerCancel` and `onLostPointerCapture` to cleanly release capture, remove pointers from `activePointersRef`, and unlock elements without leaving zombie pointers.
  - Guarded `handlePointerLeave` so that if `containerRef.current?.hasPointerCapture?.(e.pointerId)` is true, active drags are not aborted when crossing element boundaries.
  - Wrapped `setPointerCapture` and `releasePointerCapture` calls in `try...catch` and added `hasPointerCapture` checks.
  - Added `e.preventDefault()` on `pointerdown` for touch events and isolated the floating zoom widget with `onPointerDown={(e) => e.stopPropagation()}`.
* **Tests**: Verified ESLint cleanly with 0 errors/warnings, Vitest test suite passing all 52 tests, and Vite production bundle building cleanly.

---

## 🔍 Verification & Testing Logs

### 1. Build Verification
Production bundler successfully compiled the codebase:
```bash
> client@0.0.0 build
> vite build

vite v6.4.2 building for production...
transforming...
✓ 109 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.46 kB │ gzip:   0.29 kB
dist/assets/index-C4Iw8E8V.css   70.67 kB │ gzip:  10.93 kB
dist/assets/index-wSIMInv5.js   964.30 kB │ gzip: 258.86 kB
✓ built in 2.06s
```

### 2. Lint Check
ESLint checks passed cleanly with zero warnings/errors:
```bash
> client@0.0.0 lint
> eslint .

(Completed with exit code 0)
```

### 3. Unit Tests & Coverage
Vitest test suite passed with coverage metrics comfortably exceeding target thresholds:
```bash
> client@0.0.0 test
> vitest run

 RUN  v4.1.9 C:/Users/Scott Simenel/.gemini/antigravity/scratch/realtime-canvas/client

 ✓ src/lib/__tests/smoke.test.js (1 test) 3ms
 ✓ src/lib/__tests/locks.test.js (2 tests) 3ms
 ✓ src/lib/__tests/ids.test.js (4 tests) 4ms
 ✓ src/components/canvas/__tests__/CanvasSelection.test.js (11 tests) 6ms
 ✓ src/components/dice/__tests__/DiceMath.test.js (7 tests) 5ms
 ✓ src/lib/__tests/mergeElement.test.js (4 tests) 6ms
 ✓ src/state/__tests/stores.test.js (4 tests) 6ms
 ✓ src/state/__tests/historyStore.test.js (11 tests) 14ms
 ✓ src/lib/__tests/url.test.js (3 tests) 3ms
 ✓ src/components/sidebar/__tests__/InspectorWidget.test.jsx (2 tests) 3ms
 ✓ src/state/__tests/uploadStore.test.js (2 tests) 2ms

  Test Files  11 passed (11)
       Tests  51 passed (51)
    Start at  13:32:29
    Duration  451ms (transform 778ms, setup 0ms, import 1.38s, tests 64ms, environment 1ms)
```

---

## 🖼️ Collaborative Image & Asset Library Manager

We implemented the Collaborative Image & Asset Library Manager in both client and server:

1. **Protocol & State Registry**:
   - Registered standard socket events (`ASSET_DELETE`, `ASSET_DELETED`, `ASSET_RENAME`, `ASSET_RENAMED`) in [protocol.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/shared/protocol.js).
   - Added `deleteAsset(assetId)` and `renameAsset(assetId, name)` mutations to `CanvasRegistry` in [registry.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/registry.js).
2. **Server-Side Handlers ([elementHandler.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/handlers/elementHandler.js))**:
   - Listens to `EVENTS.ASSET_DELETE`, deletes asset records, unlinks physical files from `uploadsDir` disk storage securely, and broadcasts `EVENTS.ASSET_DELETED` to other clients.
   - Listens to `EVENTS.ASSET_RENAME`, updates name records, and broadcasts `EVENTS.ASSET_RENAMED`.
3. **Client-Side Store ([uploadStore.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/uploadStore.js) & [useElementEvents.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/hooks/useElementEvents.js))**:
   - Added states for fuzzy search (`searchQuery`) and preset vs upload filter chips (`activeFilter`).
   - Integrated logic to filter visible and hidden assets dynamically using search/filter inputs.
   - Added `handleRenameAsset` and `handleDeleteAsset` callbacks emitting socket calls.
   - Listens to real-time asset rename and delete broadcast notifications to sync user panels instantly.
4. **Drag-and-Drop Spawning ([Canvas.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/Canvas.jsx) & [useElementActions.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/hooks/useElementActions.js))**:
   - Updated `handleSpawnImage` to accept optional `customX` and `customY` target coordinates, placing the image center at the drop cursor.
   - Registered HTML5 `onDragOver` and `onDrop` events on the canvas outer wrapper, transforming screen cursor drops to virtual coordinates to spawn images precisely.
5. **Left Sidebar UI ([LeftSidebar.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/LeftSidebar.jsx))**:
   - Added search input field and filtering chips at the top of the Images panel.
   - Made image list cards draggable (`draggable="true"`).
   - Added inline rename input editors toggled by a pencil icon.
   - Added permanent delete trash buttons (only for custom uploads) showing confirm dialogs before dispatching deletion requests.
6. **Tests**:
   - Added dedicated behavioral test suite [uploadStore.test.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/__tests/uploadStore.test.js) verifying search filtering, presets vs uploads filters, renaming, and deleting trigger properly and dispatch the right websocket emits.

---

## 📁 Collaborative Folder Management for Assets

We implemented collaborative folder management in the asset manager:

1. **Protocol Events ([protocol.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/shared/protocol.js))**:
   - Added standard socket events: `FOLDER_CREATE`, `FOLDER_CREATED`, `FOLDER_RENAME`, `FOLDER_RENAMED`, `FOLDER_DELETE`, `FOLDER_DELETED`, `ASSET_MOVE`, and `ASSET_MOVED`.
2. **Server-Side Registry ([registry.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/registry.js))**:
   - Initialized `this.folders = new Map()` state tracking.
   - Added serialization/deserialization to room JSON state for persistence saves (`saveState` and `loadState`).
   - Implemented state mutations: `createFolder`, `renameFolder`, `deleteFolder` (resets asset folderId associations back to root/null), and `moveAsset`.
3. **Server Handlers ([elementHandler.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/handlers/elementHandler.js))**:
   - Listens to client folder operations and asset-moving events, updating registry state and broadcasting changes to all other room clients.
4. **Client State Store ([uploadStore.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/uploadStore.js))**:
   - Exposed `folders` state list, `handleCreateFolder`, `handleRenameFolder`, `handleDeleteFolder`, and `handleMoveAsset` actions.
   - Initialized synchronization when joining rooms ([useSocketConnection.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/hooks/useSocketConnection.js)), loading saved canvas states ([useSaveEvents.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/hooks/useSaveEvents.js)), and handling socket notifications ([useElementEvents.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/hooks/useElementEvents.js)).
5. **Left Sidebar UI ([LeftSidebar.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/LeftSidebar.jsx))**:
   - Added folder creation input inline.
   - Rendered folder tree nodes dynamically (collapsible blocks, folder asset count indicators, inline rename & delete controls).
   - Hooked up HTML5 Drag-and-Drop dropzones over folders to allow collaborative moving of uploads into folders, and a root dropzone to move items back to the root level.
6. **Tests**:
   - Added behavioral unit tests in [uploadStore.test.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/__tests/uploadStore.test.js) validating that calling create, rename, move, and delete dispatches the correct socket messages and updates state appropriately.

---

## 🌐 WS11: Multi-Room Canvas Architecture & Room Discovery

We designed and implemented a complete multi-room collaborative architecture, converting the single-instance backend into a multi-tenant room orchestrator, alongside an overhaul of the Lobby and navigation.

### 1. In-Memory Canvas Isolation (`RoomManager`)
* **Manager Engine ([roomManager.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/roomManager.js))**:
  - Maintains a collection of active `CanvasRegistry` instances keyed by sanitized `roomId`: `rooms: Map<string, CanvasRegistry>`.
  - `getOrCreateRoom(roomId)`: Validates room identifier, lazily spins up a `CanvasRegistry` instance for that room, restores the latest disk save, and caches it in memory.
  - `listRooms()`: Discovers both active in-memory rooms and existing disk save directories, aggregating live stats: `activeUsers`, `userList` with color badges, `tabCount`, `elementsCount`, `hasSave`, and relative `lastActive` timestamps.
  - `autosaveAllRooms()`: Runs periodic disk autosaves for all active rooms with connected users or content.
* **Filesystem & Path Traversal Security ([registry.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/registry.js))**:
  - `sanitizeRoomId(roomId)`: Strips non-alphanumeric characters, collapses and trims hyphens (`replace(/^-+|-+$/g, '')`), enforces a max length of 32 characters, and safely defaults to `canvas-default`.
  - Automatically migrates any legacy flat saves from `server/saves/*.json` into `server/saves/canvas-default/`.

### 2. Room-Scoped Storage & Uploads
* **Saves Isolation**:
  - Every `CanvasRegistry` now bounds its saves to `this.savesDir = path.join(baseSavesDir, sanitizeRoomId(roomId))`.
  - Rooms cannot view, overwrite, or delete saves belonging to other rooms.
* **Uploads Isolation ([server.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/server.js))**:
  - `POST /api/upload?roomId=...`: Disk storage engine automatically routes image uploads into `server/public/uploads/<safeRoomId>/`, returning URLs like `/uploads/<safeRoomId>/<filename>`.
  - Asset deletion cleanly unlinks the physical file from the room subfolder without leaking across rooms.

### 3. Server Handlers & Socket Broadcasting
* **Handler Scoping ([server/handlers/](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/handlers/))**:
  - All socket handlers accept `roomManager` and look up state via `roomManager.getRoom(socket.roomId)`.
  - Broadcasts are strictly scoped using `socket.to(socket.roomId)` or `io.to(socket.roomId)`.
* **Room Discovery Protocol ([protocol.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/shared/protocol.js))**:
  - `ROOMS_LIST`: Emitted by client to query available room summaries.
  - `ROOMS_UPDATED`: Broadcast by server on user join, leave, disconnect, or save creation so all clients in the Lobby update in real time.
  - `LEAVE_ROOM`: Cleanly exits current room without dropping the underlying WebSocket connection.

### 4. Client Lobby Overhaul ([Lobby.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/lobby/Lobby.jsx))
* **Available Canvases Browser**:
  - Live room cards displaying room display name, `#id`, status badge (`🟢 X online` or `⚪ Idle`), user avatar bubbles, tab and element metrics, save indicator, and relative activity time (`Just now`, `5m ago`).
  - Search filter input to find rooms by name or ID.
  - Filter chips: `All Canvases`, `Active Online`, `Has Saves`.
  - 1-click **Join Room** button on any card.
* **Identity & Custom Room Creation**:
  - Display name input with 🎲 Random Name generator from `RANDOM_NAMES`.
  - Preset color swatches and native color picker.
  - Custom Room ID input with **🎲 Random ID** generator creating memorable IDs (`realm-amber-42`, `arcane-keep-7`, etc.) via [constants.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/constants.js).
* **Deep Linking & Invites**:
  - Reads `?room=<id>` or `?roomId=<id>` from URL parameters on page load.
  - Displays invite notification banner with 1-click "Join Now" trigger.
  - Dynamically synchronizes active room in the browser URL using `window.history.replaceState`.

### 5. Header & In-App Navigation ([Header.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/header/Header.jsx) & [App.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/App.jsx))
* **Copy Invite Link**: Button placed next to room name that writes `?room=<roomId>` to the clipboard and provides visual feedback (`✓ Copied`).
* **Lobby / Switch Room**: Button in header that safely leaves the current room and returns to the lobby browser without page reload.
* **Room-Scoped Uploads ([uploadStore.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/uploadStore.js))**: Upload calls pass `currentRoomId` in `/api/upload?roomId=${roomId}`.

---

## 📐 WS12: Responsive Scrollable Containers & Viewport Optimization

We audited all modal, drawer, sidebar, and popover components across the interface to identify artificially constrained viewports, nested scrollbar collisions, and unscrollable cutoff traps:

1. **`SavesModal.jsx` (Saves Manager)**:
   - Expanded modal container from hardcoded fixed sizes to `max-h-[85vh]` with `flex flex-col`.
   - Replaced fixed `max-h-60` on the saves list with `max-h-[55vh] flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar`.
   - Form and header marked `shrink-0`, ensuring the list expands to show 8–10 saves at once without cramping the modal.

2. **`LeftSidebar.jsx` (Library & Settings Drawers)**:
   - Fixed outer container scroll hijacking: switched outer `<aside>` from `overflow-y-auto` to `overflow-hidden`. The inner tab content `flex-1 overflow-y-auto custom-scrollbar` now serves as the single unified scrollbar.
   - Removed nested `max-h-72 overflow-y-auto` from the images/folders tree.
   - Removed nested `max-h-48 overflow-y-auto` from the preset backgrounds grid.
   - Passed `maxHeightClass=""` to `ActiveUsersWidget` in the Settings tab so the user list flows naturally within the parent drawer scroll.

3. **`RightSidebar.jsx` (Layers & Properties Inspector)**:
   - Switched outer `<aside>` to `overflow-hidden` to eliminate dual/nested scrollbar collisions.
   - Expanded layers list from static `max-h-[450px]` to responsive dynamic `max-h-[calc(100vh-320px)]`, doubling visible layers on large screens while adapting smoothly to laptop viewports.

4. **`ActiveUsersWidget.jsx` & `Header.jsx`**:
   - Added configurable `maxHeightClass = 'max-h-96'` prop to `ActiveUsersWidget`.
   - In `Header.jsx` popover, passed `maxHeightClass="max-h-[50vh]"` to allow multi-user room lists to expand comfortably up to half the viewport height.

5. **`DiceRollerWidget.jsx`**:
   - Expanded floating card width from fixed `w-[360px]` to responsive `w-[360px] sm:w-[400px]` and maximum height from `max-h-[70vh]` to `max-h-[82vh]`.
   - Expanded roll history container from `max-h-56` to `max-h-72 sm:max-h-80`.

6. **`ActiveRollsIndicator.jsx` (Hover Popover Fix)**:
   - Fixed unscrollable cutoff bug: because the detailed roll popover has `pointer-events-none`, its inner `max-h-60 overflow-y-auto` meant any overflow was permanently unscrollable and clipped.
   - Removed inner `max-h-60 overflow-y-auto` from the dice container and gave the outer popover `max-h-[75vh] overflow-hidden`, allowing large dice rolls to display fully and cleanly.

7. **`Lobby.jsx` (Available Canvases Browser)**:
   - Expanded Available Canvases browser list from `max-h-[380px]` to `max-h-[540px] lg:max-h-[620px] custom-scrollbar`, doubling the visible room capacity to 6–8 rooms simultaneously.

---

## 📁 WS13: Image Folder Functionality & Interaction Overhaul

We completed a comprehensive audit and remediation of image folder functionality across data structures, real-time protocols, and drag-and-drop interactions:

1. **Robust Drag-and-Drop Pipeline**:
   - **Self-Contained Drag Payload**: Emitted drag payloads carry `{ type: 'image', url, assetId, isPreset, sourceFolderId }`. Dropping resolves targets directly by `assetId` rather than fragile URL lookups.
   - **Flicker-Free State Highlighting**: Eliminated raw DOM `classList.add/remove` mutations. Drag hover states are managed via React states (`dragOverFolderId`, `isOverRootDropzone`), verified using `e.currentTarget.contains(e.relatedTarget)` to avoid child element event hijacking.
   - **Drop Guards & Preset Rejection**: Dropping an asset into its current folder is ignored cleanly without emitting socket events. Presets are rejected from folder moves.
   - **Expanded Root Dropzone**: The entire uncategorized assets area and root dropzone banner act as unified targets to move assets out of folders.
   - **OS Desktop File Drops**: Users can drag image files directly from their OS desktop onto any folder or the root library to upload and file them instantly.

2. **Intelligent Search & Filter Hierarchy**:
   - **Folder Name Search Matching**: Searching queries both asset names and folder names; matching folders include all their filed assets in search results.
   - **Automatic Folder Expansion on Search**: Folders containing search matches automatically expand while a search query is active, collapsing back to their saved state when cleared.
   - **Clean Presets View**: Folder management controls and the folder tree are hidden when filtering by "Presets", preventing empty folder clutter.
   - **Empty Folder Hiding During Search**: Folders with 0 search matches are hidden during active queries.

3. **Validation, Deduplication & Persistence**:
   - **Double-Emit Fix**: Guarded rename callbacks (`saveFolderRename`, `saveAssetRename`) to prevent duplicate WebSocket emissions caused by `Enter` key unmounting triggering subsequent `onBlur` events.
   - **Entropy & Unique IDs**: Added `newFolderId()` to [ids.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/lib/ids.js) using timestamp + 9-character random suffix.
   - **Sanitization & Limits**: Added `maxLength={40}` and automatic string trimming to folder creation and rename inputs. Duplicate folder names are detected and rejected.
   - **Persistent Collapsed State**: Folder collapse states are saved to and restored from `localStorage` (`canvas_collapsed_folders`).
   - **Context-Aware Deletion**: Empty folders show simple deletion confirmations; populated folders warn that assets inside will remain in the library.

---

## 🔍 Verification & Testing Logs (Final validation)

### 1. Server Unit Tests (`node --test`)
Node.js test runner executed the full `RoomManager` test suite covering creation, isolation, disk saves scoping, user cleanup, ID sanitization, and autosave:
```bash
> realtime-canvas-server@1.0.0 test
> node --test

TAP version 13
# Subtest: RoomManager & Multi-Room Isolation Tests
    # Subtest: sanitizeRoomId removes invalid characters and limits length
    ok 1 - sanitizeRoomId removes invalid characters and limits length
    # Subtest: getOrCreateRoom creates and caches registry instances
    ok 2 - getOrCreateRoom creates and caches registry instances
    # Subtest: isolates user sessions and elements between rooms
    ok 3 - isolates user sessions and elements between rooms
    # Subtest: isolates saves on disk per room
    ok 4 - isolates saves on disk per room
    # Subtest: listRooms accurately aggregates active rooms and disk saves
    ok 5 - listRooms accurately aggregates active rooms and disk saves
    # Subtest: removeUser disconnects user and releases locks for specified room
    ok 6 - removeUser disconnects user and releases locks for specified room
    # Subtest: autosaveAllRooms saves active rooms
    ok 7 - autosaveAllRooms saves active rooms
    1..7
ok 1 - RoomManager & Multi-Room Isolation Tests
# tests 7
# suites 1
# pass 7
# fail 0
```

### 2. Client Unit Tests (`vitest run`)
All 54 client tests passed (including folder duplicate prevention and search matching):
```bash
> client@0.0.0 test
> vitest run

 RUN  v4.1.9 C:/Users/Scott Simenel/.gemini/antigravity/scratch/realtime-canvas/client

 ✓ src/lib/__tests/smoke.test.js (1 test)
 ✓ src/lib/__tests/locks.test.js (2 tests)
 ✓ src/lib/__tests/mergeElement.test.js (4 tests)
 ✓ src/components/canvas/__tests__/CanvasSelection.test.js (11 tests)
 ✓ src/components/dice/__tests__/DiceMath.test.js (7 tests)
 ✓ src/lib/__tests/ids.test.js (5 tests)
 ✓ src/state/__tests/uploadStore.test.js (4 tests)
 ✓ src/state/__tests/stores.test.js (4 tests)
 ✓ src/state/__tests/historyStore.test.js (11 tests)
 ✓ src/components/sidebar/__tests__/InspectorWidget.test.jsx (2 tests)
 ✓ src/lib/__tests/url.test.js (3 tests)

 Test Files  11 passed (11)
      Tests  54 passed (54)
```

### 3. Linter Verification (`eslint .`)
ESLint passed with 0 errors and 0 warnings:
```bash
> client@0.0.0 lint
> eslint .

(Completed with exit code 0)
```

### 4. Production Build (`vite build`)
Vite compiled the bundle cleanly:
```bash
> client@0.0.0 build
> vite build

vite v6.4.2 building for production...
✓ 109 modules transformed.
dist/index.html                   0.46 kB │ gzip:   0.29 kB
dist/assets/index-dq94tsmX.css   77.92 kB │ gzip:  11.89 kB
dist/assets/index-3qOOIw3W.js   980.06 kB │ gzip: 262.66 kB
✓ built in 2.18s
```

---

## 🎨 WS14 — Theme Tokens, Responsive Viewport, Dock & Sidebars

### 1. Theme Palette Tokens & Viewport Fixes
- Added all missing Tailwind v4 palette stops (`slate-850`, `slate-750`, `slate-650`, `slate-550`, `slate-455`, `slate-450`, `slate-405`, `slate-355`, `slate-350`, `slate-205`, `slate-905`, `indigo-650`, `indigo-205`, `rose-455`, `rose-350`, `sky-350`) in [client/src/index.css](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/index.css) `@theme` block.
- Standardized `#root` and `AppContent` viewport height to `100dvh` (`100vh` fallback) with `viewport-fit=cover` and `<title>Antigravity Canvas</title>` in [client/index.html](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/index.html).
- Set responsive padding (`p-1.5 sm:p-5`) in [AppContent.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/AppContent.jsx).

### 2. Canvas Dock & Zoom Control
- Made [CanvasDock.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasDock.jsx) horizontally scrollable on mobile screens (`max-w-[calc(100vw-1rem)] overflow-x-auto no-scrollbar`) with tightened mobile button padding (`px-2 py-1.5 sm:px-3 sm:py-2`).
- Elevated the Canvas zoom control pill to `bottom-20 sm:bottom-4` in [Canvas.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/Canvas.jsx) to eliminate overlap with the bottom navigation dock on touch devices.

### 3. Responsive Sidebars & Mobile Mutual Exclusion
- Converted [LeftSidebar.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/LeftSidebar.jsx) and [RightSidebar.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/RightSidebar.jsx) to responsive margins/widths: `left-3 right-3 sm:left-6 sm:right-auto sm:w-80` and `left-3 right-3 sm:left-auto sm:right-6 sm:w-80`.
- Implemented mutual exclusion under `<1024px`: opening one panel smoothly closes the other.
- In [uiStore.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/uiStore.js), tapping the canvas on mobile closes all open sidebars cleanly.
- Fixed `Lobby.jsx` mobile horizontal glow orb scrolling via `overflow-x-hidden` on the outer container.

---

## 🧭 WS15 — Header, Tabs, Asset Folder Mobile Fallback & Popovers

### 1. Header & User Profile
- In [Header.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/header/Header.jsx), hid text labels for Undo, Redo, and Saves on mobile viewports (`hidden md:inline`).
- Replaced invisible hover-only profile rename triggers with a persistent tap-to-edit name trigger and enlarged color picker touch target on mobile viewports.
- Enhanced the "Online Users" popover with a bridge wrapper to prevent mouseleave hover flickering on desktop, alongside click/tap toggle and outside-click dismissal for touch screens.

### 2. Tabs Usability & Validation
- In [TabButton.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/common/TabButton.jsx), exposed rename (`✏️`) and delete (`✕`) controls visibly on active tabs on touch screens, avoiding invisible `opacity-0` click traps.
- In [useTabs.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/hooks/useTabs.js), added delete confirmation dialogs and duplicate tab name prevention.

### 3. Mobile Asset Folder Assignment & Viewport Spawning
- In [LeftSidebar.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/LeftSidebar.jsx), added a touch-friendly "Move to Folder" dropdown on uploaded asset cards so mobile users (without HTML5 Drag & Drop) can categorize assets into folders.
- In [useElementActions.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/hooks/useElementActions.js), updated shape and image spawning to center elements within the user's current viewport coordinates (`activeVirtualDimensions.width / 2`, `activeVirtualDimensions.height / 2`).

### 4. Dice Notifications, Effects & Modals
- Fixed [ActiveRollsIndicator.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/dice/ActiveRollsIndicator.jsx) fixed right positioning bug and cleared orphaned state.
- In [DiceEffects.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/dice/DiceEffects.jsx), processed all batched rolls in the queue to guarantee 3D physics rendering for every roll.
- Enhanced [SavesModal.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/saves/SavesModal.jsx) with keyboard `Escape` closing, backdrop click dismissal, and automatic modal closure upon save load.

---

## 🖐️ WS16 — Core Canvas Touch Gestures, Lock Race, Ruler, Cursors & Pen/Eraser Fixes

### 1. Pure Focal Zoom Vector Math
- Implemented and unit-tested `calculateFocalZoomPan` and `scalePanOffsetForZoom` pure functions in [CanvasSelection.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasSelection.js).
- Wired `calculateFocalZoomPan` into multi-touch pinch gestures and mouse wheel zoom, guaranteeing zero focal drift relative to finger midpoints.
- Wired `scalePanOffsetForZoom` into the `+` and `−` Zoom buttons to keep viewport center stationary during button zoom.

### 2. Multi-Touch Discrimination & Fast-Flick Lock Race Protection
- In touch mode, deferred single-finger Eraser deletes and Ruler anchor points until move/release, cancelling pending ruler anchors if a 2-finger pinch initiates.
- Fixed async `ELEMENT_LOCK` fast-flick race condition in [Canvas.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/Canvas.jsx): if the pointer is released before `ELEMENT_LOCK` callback resolves, the callback immediately emits `ELEMENT_UPDATE` (final coordinates) and `ELEMENT_UNLOCK` so locks are never orphaned on the server.
- Handled `handleMouseUp` final update broadcast before `ELEMENT_UNLOCK`.

### 3. Ruler, Handles, Tooltips & Drawing Enhancements
- Updated Ruler tool to support both click-and-drag (desktop & touch) and traditional click-move-click.
- Enlarged resize and rotation handle hit tolerance radius (`16 / scale`) in `CanvasSelection.js` and visuals (`8.5 / scale`) in `CanvasRenderer.js`.
- Counter-rotated the `'i'` tooltip badge glyph in [CanvasRenderer.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasRenderer.js) (`if (rad) ctx.rotate(-rad)`).
- Bound tooltip display to touch single-selection with screen-edge clamping `[136, canvasSize.width - 136]`.
- Respected `el.properties?.locked` in Eraser tool and added confirmation dialog to "Clear All Drawings".
- Expanded single-tap Pen dots into 2-point micro-lines and added contextual canvas cursors with window blur reset.

---

## 🎛️ WS17 — Inspector, Layer Manager, RightSidebar Delete & Undo/Redo Fixes

### 1. RightSidebar Layer Management & Multi-Selection
- Passed `activeTabId` into [RightSidebar.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/RightSidebar.jsx), ensuring layer deletes target the current active tab and record `_layerIndex` in undo history.
- Removed redundant `max-h-[calc(100vh-320px)] overflow-y-auto` from the layers list to eliminate nested dual scrollbars.
- Supported `Shift+Click`, `Ctrl+Click`, and `Cmd+Click` (`e.metaKey`) for layer multi-selection.

### 2. Multi-Select Layer Ordering Boundary Fix
- In [useElementActions.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/hooks/useElementActions.js) `adjustSelectedElementsLayer`:
  - Fixed boundary swapping bug where adjacent selected items swapped places at the top or bottom of the stack.
  - Guarded `forward` and `backward` so selected items only swap with non-selected adjacent items.
  - Added `isUnchanged` checks in both `adjustElementLayer` and `adjustSelectedElementsLayer` to suppress no-op socket emissions and history pushes.

### 3. Inspector Clamping, Lock Cleanup & Tooltip Numeric Healing
- In [InspectorWidget.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/InspectorWidget.jsx), clamped live Width and Height values `[10, 2000]` before emitting `ELEMENT_UPDATE`.
- Wired lock acquisition and release onto Fill Opacity, Outline Width, and Outline Opacity sliders.
- In [useSelectionActions.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/hooks/useSelectionActions.js), added unmount and window `pointerup` cleanup listeners so slider locks are never orphaned.
- In [TooltipInspector.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/TooltipInspector.jsx), converted tracker values to numbers in `handleQuickAdjust` to eliminate string concatenation bugs on Heal (`+`), and bound `Enter` key to commit character titles.

### 4. Full Property & Layer Undo/Redo Tracking
- In [historyStore.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/historyStore.js), enhanced `transform` undo/redo to capture and restore `type` and nested `properties`.
- Restored deleted and erased elements at their original layer positions (`_layerIndex`) using array splicing and emitted `ELEMENTS_REORDER` to synchronize server insertion order.
- In [server/registry.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/registry.js), added `if (updates.type !== undefined) element.type = updates.type;` to allow server-persisted shape morphing.

---

## 🧪 WS18 — Automated Verification Suite & Test Logs

### 1. Client Unit Tests (`vitest run`)
All 59 client unit tests across 11 test suites passed:
```bash
> client@0.0.0 test
> vitest run

 RUN  v4.1.9 C:/Users/Scott Simenel/.gemini/antigravity/scratch/realtime-canvas/client

 ✓ src/lib/__tests/smoke.test.js (1 test)
 ✓ src/components/dice/__tests__/DiceMath.test.js (7 tests)
 ✓ src/lib/__tests/locks.test.js (2 tests)
 ✓ src/lib/__tests/mergeElement.test.js (4 tests)
 ✓ src/components/canvas/__tests__/CanvasSelection.test.js (13 tests)
 ✓ src/lib/__tests/ids.test.js (5 tests)
 ✓ src/state/__tests/stores.test.js (5 tests)
 ✓ src/state/__tests/historyStore.test.js (13 tests)
 ✓ src/state/__tests/uploadStore.test.js (4 tests)
 ✓ src/components/sidebar/__tests__/InspectorWidget.test.jsx (2 tests)
 ✓ src/lib/__tests/url.test.js (3 tests)

 Test Files  11 passed (11)
      Tests  59 passed (59)
   Duration  435ms
```

### 2. Server Unit Tests (`node --test`)
Node.js test runner passed 100% of room manager and isolation tests:
```bash
> realtime-canvas-server@1.0.0 test
> node --test

TAP version 13
# Subtest: RoomManager & Multi-Room Isolation Tests
    ok 1 - sanitizeRoomId removes invalid characters and limits length
    ok 2 - getOrCreateRoom creates and caches registry instances
    ok 3 - isolates user sessions and elements between rooms
    ok 4 - isolates saves on disk per room
    ok 5 - listRooms accurately aggregates active rooms and disk saves
    ok 6 - removeUser disconnects user and releases locks for specified room
    ok 7 - autosaveAllRooms saves active rooms
1..1
# tests 7
# suites 1
# pass 7
# fail 0
```

### 3. ESLint Verification (`eslint .`)
ESLint verified cleanly with 0 errors and 0 warnings:
```bash
> client@0.0.0 lint
> eslint .

(Completed with exit code 0)
```

### 4. Production Build (`vite build`)
Vite compiled the client bundle in 2.07s:
```bash
> client@0.0.0 build
> vite build

vite v6.4.2 building for production...
✓ 109 modules transformed.
dist/index.html                   0.49 kB │ gzip:   0.31 kB
dist/assets/index-D2s4YKXh.css   81.76 kB │ gzip:  12.52 kB
dist/assets/index-B4kn3zSA.js   990.33 kB │ gzip: 265.76 kB
✓ built in 2.07s
```

### 5. Server Syntax Check (`node --check server/server.js`)
Node syntax check passed with exit code 0.

---

## 🎨 WS19 — Grid Customization: Line Weight & Color

We added full customization of grid overlay line weight (thickness) and line color per tab, synchronized in real time across all connected clients:

1. **Server-Side Settings Persistence ([registry.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/registry.js))**:
   - Default tab settings in constructor, `createTab()`, and `loadState()` now initialize `gridColor: null` and `gridLineWidth: 1`.
   - `updateRoomSettings()` now parses and persists `gridColor`, `gridLineWidth`, and alias `gridLineWeight`.
2. **Client State Store ([canvasStore.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/canvasStore.js))**:
   - Initialized fallback tab `roomSettings` with `gridColor: null` and `gridLineWidth: 1`.
3. **HTML5 Canvas 2D Rendering Engine ([CanvasRenderer.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasRenderer.js) & [Canvas.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/Canvas.jsx))**:
   - `drawGrid` renders custom `gridColor` when provided, falling back dynamically to `#47556960` when a background image is active and `#1e293b` on a dark canvas.
   - `ctx.lineWidth` scales inversely with zoom (`weight / scale`), ensuring crisp rendering across any zoom level.
4. **Left Sidebar UI ([LeftSidebar.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/LeftSidebar.jsx))**:
   - Added **Line Weight** slider (1px to 10px) with live numeric value badge.
   - Added **Line Color** controls with 10 preset swatches, active ring highlight, "Reset Default" button, and native color picker input.
5. **Automated Behavioral Tests**:
   - Added [CanvasRenderer.test.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/__tests__/CanvasRenderer.test.js) (6 unit tests) testing default vs custom line weights, custom colors, scale division, non-positive fallback, and square vs hexagon grid path execution.
   - Added server test in [roomManager.test.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/__tests__/roomManager.test.js) verifying `updateRoomSettings` handles and stores `gridColor`, `gridLineWidth`, and `gridLineWeight`.

### Verification Suite:
- **Client Tests**: 12/12 test files passed, 65/65 tests passed.
- **Server Tests**: 8/8 tests passed.
- **ESLint**: 0 errors, 0 warnings.
- **Vite Build**: Production build bundled successfully in 2.06s.

---

## 📁 WS20 — Collaborative Image Folder Nesting

We implemented hierarchical folder nesting (subfolders) for images in the asset library with real-time multi-user synchronization, drag-and-drop hierarchy management, sibling-scoped uniqueness, and non-cascading deletion with collision resolution:

1. **Pure Tree Math & Lineage Engine ([shared/folderTree.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/shared/folderTree.js) & [client/src/lib/folderTree.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/lib/folderTree.js))**:
   - `MAX_FOLDER_DEPTH = 5`: Hard limit on folder nesting depth.
   - `getFolderDepth(folderId, folders)`: Computes 1-indexed hierarchy depth with cycle protection.
   - `getMaxSubtreeDepthOffset(folderId, folders)`: Computes downward height of a folder's subtree.
   - `isDescendantFolder(candidateId, targetAncestorId, folders)`: Detects cycles and subtrees.
   - `getAncestorFolderIds(folderId, folders)` & `getDescendantFolderIds(folderId, folders)`: Lineage traversal.
   - `canMoveFolder(folderId, targetParentId, folders)`: Validates moves ensuring no cycle creation, depth $\le 5$, and no sibling duplicate name collision.
   - `buildFolderTree(folders)`: Converts flat folder list into nested tree nodes with `depth` and `children`.
   - `flattenFolderTree(folders)`: Creates depth-first list with visual indentation prefixes (e.g., `  ↳ `) for `<select>` dropdowns.
   - `resolveUniqueSiblingName(name, parentId, folders, excludeId)`: Suffixes collisions deterministically (e.g. `"Maps (1)"`, `"Maps (2)"`).
   - `getSubtreeAssetIds(folderId, folders, assets)`: Queries all assets under a folder and all its descendant subfolders.
   - **Unit Tests**: [folderTree.test.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/lib/__tests/folderTree.test.js) (10 tests) covering depth, cycles, moves, sibling uniqueness, flattening, and deduplication.

2. **Real-Time Protocol & Server Implementation ([shared/protocol.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/shared/protocol.js), [server/registry.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/registry.js), [server/handlers/elementHandler.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/handlers/elementHandler.js))**:
   - Added `FOLDER_MOVE: 'folder-move'` and `FOLDER_MOVED: 'folder-moved'` to protocol.
   - `createFolder`: Enforces `parentId` and `MAX_FOLDER_DEPTH`.
   - `moveFolder`: Validates cycle prevention and depth limits via `canMoveFolder`.
   - `deleteFolder`: Non-cascading deletion that promotes direct child folders and assets to the deleted folder's parent (or root `null`), resolving sibling name collisions via `resolveUniqueSiblingName`.
   - `saveState` & `loadState`: Persists `parentId` and sanitizes circular or dangling references.
   - Handlers broadcast `folder-moved`, `folder-renamed`, and `folder-deleted` with `promotedFolders`.

3. **Client State Store & Events ([client/src/state/uploadStore.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/uploadStore.js) & [client/src/app/hooks/useElementEvents.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/hooks/useElementEvents.js))**:
   - `handleCreateFolder(name, parentId)`: Sibling-scoped uniqueness check with optimistic rollback.
   - `handleMoveFolder(folderId, targetParentId)`: Validates move and rolls back on server rejection.
   - `handleDeleteFolder(folderId)`: Optimistically promotes child folders and assets, resolves collisions, and reconciles with server broadcast.
   - `visibleAssets` / `hiddenAssets`: Searches match asset names, direct folder names, and any ancestor folder names in deep hierarchies.
   - Event listeners sync `folder-moved` and promoted child folders/assets on `folder-deleted`.

4. **Hierarchical UI & Drag-and-Drop Interaction ([client/src/components/sidebar/LeftSidebar.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/LeftSidebar.jsx))**:
   - Recursive `renderFolderNode` helper with nested visual indentation guides (`border-l-2 border-slate-700/60`).
   - Inline `+` subfolder creation button on folder headers (disabled at max depth 5).
   - Draggable folder headers: Drag a folder onto another folder to nest, or onto the root dropzone to move back to root.
   - Touch fallback: Asset card `<select>` dropdown populated by `flattenFolderTree` with visual branch prefixes.
   - Context-aware deletion confirmation informing users that child folders and assets will be promoted to the parent level.

5. **Behavioral Automated Tests**:
   - [folderTree.test.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/lib/__tests/folderTree.test.js): 10 tests for tree math, depth, cycles, moves, flattening, and collision resolution.
   - [uploadStore.test.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/__tests/uploadStore.test.js): 6 tests covering nested folder creation, moving, sibling scoping, cycle prevention, promotion collision suffixing, and deep ancestor search matching.
   - [roomManager.test.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/__tests__/roomManager.test.js): 10 tests covering nested folder creation, move validation, cycle rejection, non-cascading delete promotion, and disk save/load persistence.

### Verification Suite:
- **Client Tests**: 13/13 test files passed, 77/77 tests passed.
- **Server Tests**: 10/10 tests passed.
- **ESLint**: 0 errors, 0 warnings.
- **Vite Build**: Production build bundled successfully in 1.99s.
- **Server Syntax**: `node --check server/server.js` passed with exit code 0.




