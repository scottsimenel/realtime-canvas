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
