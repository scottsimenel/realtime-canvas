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

## 📦 WS12 — Responsive Scrollable Containers & Viewport Optimization
- `[x]` 12.1 Fix `SavesModal.jsx`: Expand modal card with `max-h-[85vh]` and saves list to `max-h-[55vh] flex-1 overflow-y-auto`.
- `[x]` 12.2 Fix `LeftSidebar.jsx`: Remove redundant outer `<aside>` `overflow-y-auto`, eliminate nested `max-h-72` in Images/Folders tab, and remove nested `max-h-48` in Preset Backgrounds grid.
- `[x]` 12.3 Fix `RightSidebar.jsx`: Remove redundant outer `<aside>` `overflow-y-auto`, expand layers list to `max-h-[calc(100vh-320px)]`.
- `[x]` 12.4 Fix `ActiveUsersWidget.jsx`: Support customizable `maxHeightClass` (defaulting to `max-h-96` / `max-h-[50vh]` for Header popover and natural flow for RightSidebar).
- `[x]` 12.5 Fix `DiceRollerWidget.jsx`: Expand widget container to `max-h-[82vh] w-[360px] sm:w-[400px]` and roll history to `max-h-72 sm:max-h-80`.
- `[x]` 12.6 Fix `ActiveRollsIndicator.jsx`: Remove unscrollable `max-h-60` cutoff in `pointer-events-none` hover popover and set popover to `max-h-[75vh]`.
- `[x]` 12.7 Fix `Lobby.jsx`: Expand Available Canvases browser to `max-h-[540px] lg:max-h-[620px]` to show 6-8 rooms at once.
- `[x]` 12.8 Run ESLint, client unit tests, and production build checks.
- `[x]` 12.9 Sync artifacts (`task.md`, `walkthrough.md`), commit, and push.

## 📦 WS13 — Image Folder Functionality & Interaction Overhaul
- `[x]` 13.1 Add `newFolderId()` to `client/src/lib/ids.js`.
- `[x]` 13.2 Update `client/src/state/uploadStore.js`: use `newFolderId()`, add duplicate name prevention, support `targetFolderId` in `handleImageUpload`, and enhance `visibleAssets` search matching for folders.
- `[x]` 13.3 Overhaul `client/src/components/sidebar/LeftSidebar.jsx`:
  - Self-contained drag payload (`assetId`, `isPreset`, `sourceFolderId`).
  - React state-driven drag hover (`dragOverFolderId`, `isOverRootDropzone`), eliminating DOM class flickering.
  - OS desktop file drop directly onto folders & root to upload.
  - Guard self-drops & reject presets.
  - Expand root dropzone to entire root section.
  - Fix Enter/Blur double-emit bug on folder and asset rename.
  - Persist `collapsedFolderIds` in `localStorage`.
  - Auto-expand folders on search matches, hide empty folders during search, and hide folder UI on "Presets" filter tab.
  - Add character limits (`maxLength={40}`) and context-aware delete confirmation.
- `[x]` 13.4 Add unit tests for folder enhancements in `uploadStore.test.js`.
- `[x]` 13.5 Run ESLint, client unit tests, server tests, and production build checks.
- `[x]` 13.6 Sync artifacts (`task.md`, `walkthrough.md`), commit, and push.

## 📦 WS14 — Theme Tokens, Responsive Viewport, Dock & Sidebars
- `[x]` 14.1 Add missing Tailwind v4 palette tokens (`slate-850`, `slate-750`, `slate-650`, `slate-550`, `slate-455`, `slate-450`, `slate-405`, `slate-355`, `slate-350`, `slate-205`, `slate-905`, `indigo-650`, `indigo-205`, `rose-455`, `rose-350`, `sky-350`) in `client/src/index.css` `@theme` and fix `duration-205` to `duration-200`.
- `[x]` 14.2 Set `#root` and `AppContent` viewport height to `100dvh` (`100vh` fallback), add `viewport-fit=cover` and `<title>Antigravity Canvas</title>` in `client/index.html`, and use responsive padding (`p-1.5 sm:p-5`) in `AppContent.jsx`.
- `[x]` 14.3 Make `CanvasDock.jsx` responsive on mobile (`max-w-[calc(100vw-1rem)] overflow-x-auto no-scrollbar`), tighten button padding on mobile, and elevate Canvas Zoom pill (`bottom-20 sm:bottom-4`) to eliminate overlap.
- `[x]` 14.4 Responsive sidebars (`LeftSidebar.jsx`, `RightSidebar.jsx`): responsive margins/widths (`left-3 right-3 sm:left-6 sm:right-auto sm:w-80`), mutual exclusion on mobile (`<1024px`), fix `uiStore.js` `handleCanvasInteraction` to cleanly close sidebars on mobile canvas tap, and fix `handleToggleZenMode` to avoid forcing both open on mobile.
- `[x]` 14.5 Lobby mobile polish: `overflow-x-hidden` on outer wrapper to prevent 450px glow orb horizontal scroll, and add `autoCapitalize="none" autoCorrect="off" spellCheck="false"` to Room ID input.
- `[x]` 14.6 Run verification loop (lint, tests, build), commit, and push WS14.

## 📦 WS15 — Header, Tabs, Asset Folder Mobile Fallback & Popovers
- `[ ]` 15.1 Fix `Header.jsx` mobile overflow: hide Undo/Redo/Saves text labels below `md:`, make mobile profile name and rename trigger visible and tap-editable, and enlarge color picker.
- `[ ]` 15.2 Fix Header Online Users popover hover gap, add `onClick` toggle and outside-click dismissal for touch, and anchor within screen bounds.
- `[ ]` 15.3 Update `TabButton.jsx` so active tabs expose rename (`✏️`) and delete (`✕`) safely on touch without invisible `opacity-0` click traps, and fix tab delete confirmation + duplicate tab naming in `useTabs.js`.
- `[ ]` 15.4 In `LeftSidebar.jsx`, add a touch-friendly "Move to Folder" selector on uploaded asset cards, fix invisible `opacity-0` overlay button touch traps, and spawn click/tap shapes & images at the center of the user's current viewport in `useElementActions.js`.
- `[ ]` 15.5 Fix `ActiveRollsIndicator.jsx` popover positioning (`right: 336px` bug) & orphaned `hoveredRoll` state, process all queued rolls in `DiceEffects.jsx`, and add `Escape`/backdrop/load-close to `SavesModal.jsx`.
- `[ ]` 15.6 Run verification loop (lint, tests, build), commit, and push WS15.

## 📦 WS16 — Core Canvas Touch Gestures, Lock Race, Ruler, Cursors & Pen/Eraser Fixes
- `[ ]` 16.1 Extract focal-point-preserving pinch-to-zoom math and zoom-button pan scaling into `CanvasSelection.js` (with unit tests) and wire into `Canvas.jsx`.
- `[ ]` 16.2 Prevent Finger-1 `pointerdown` from triggering immediate Eraser deletions before a 2-finger pinch is recognized.
- `[ ]` 16.3 Fix the async `ELEMENT_LOCK` fast-flick race condition in `Canvas.jsx` so locks are never orphaned and final coordinates are always emitted.
- `[ ]` 16.4 Update Ruler (`measure`) tool to support both click-and-drag (touch & desktop) and click-move-click.
- `[ ]` 16.5 Enlarge resize/rotate handle hit targets in `CanvasSelection.js`, show element tooltips on touch selection, clamp horizontal tooltip coordinates, and counter-rotate `'i'` badge in `CanvasRenderer.js`.
- `[ ]` 16.6 Respect `el.properties?.locked` in Eraser tool and "Clear All Drawings" (plus confirmation), support single-tap Pen dots, add contextual canvas cursors, and reset Spacebar pan on window `blur`.
- `[ ]` 16.7 Run verification loop (lint, tests, build), commit, and push WS16.

## 📦 WS17 — Inspector, Layer Manager, RightSidebar Delete & Undo/Redo Fixes
- `[ ]` 17.1 Fix `RightSidebar.jsx` layer delete to pass `tabId: activeTabId` and `elementIds: [el.id]`, remove nested scrollbar, and support `Ctrl/Cmd+Click` multi-selection.
- `[ ]` 17.2 Fix multi-select "Bring Forward" / "Send Backward" boundary swapping and no-op emissions in `useElementActions.js`.
- `[ ]` 17.3 Clamp live Width/Height broadcasts in `InspectorWidget.jsx`, fix inspector lock cleanup on selection change/slider release in `useSelectionActions.js`, and fix `TooltipInspector.jsx` empty-string concatenation & `Enter` key commit.
- `[ ]` 17.4 Expand `historyStore.js` and `useSelectionActions.js` so inspector property/type/tooltip changes are tracked by Undo/Redo and deleted/erased elements restore their original layer index.
- `[ ]` 17.5 Run verification loop (lint, tests, build), commit, and push WS17.

## 📦 WS18 — Automated Tests, Verification & Documentation Sync
- `[ ]` 18.1 Add unit tests in `CanvasSelection.test.js`, `historyStore.test.js`, and `stores.test.js` covering focal-point zoom math, property/type undo-redo, and mobile sidebar state transitions.
- `[ ]` 18.2 Run ESLint, Vitest coverage suite, server tests, and Vite production build.
- `[ ]` 18.3 Update `STRUCTURE.md` if any helpers were added, and document full achievements in `walkthrough.md`.
- `[ ]` 18.4 Final git commit and push.
