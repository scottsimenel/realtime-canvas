# Tasks

## 📦 WS5 — Housekeeping
- `[x]` 5.1 Delete the untracked `nul` file from the workspace root (Skipped deletion on Windows; added to ignore).
- `[x]` 5.2 Add `/nul` to `.gitignore`.
- `[x]` 5.3 Add the changelog note at the top of the Workflows section in `agent.md`.
- `[x]` 5.4 Cross-check and verify that `STRUCTURE.md` documents every file added by the refactor.

## 📦 WS1 — Finish Stage 7: Protocol Rewiring
- `[ ]` 1.1 Import `EVENTS` from protocol in `client/src/components/canvas/Canvas.jsx` and `client/src/components/sidebar/RightSidebar.jsx`.
- `[ ]` 1.2 Systematic rewire of the 18 hardcoded socket event emits in `Canvas.jsx` (17) and `RightSidebar.jsx` (1).
- `[ ]` 1.3 Verify zero hardcoded emits remain via `git grep` count test.

## 📦 WS4 — Slim AppContent.jsx (Stage 8)
- `[ ]` 4.1 Move active tool states (`activeTool`, `penColor`, `penSize`, `eraserSize`) to `uiStore.js`.
- `[ ]` 4.2 Move canvas configurations (`showCursorNames`, `activeVirtualDimensions`, `showSavesModal`) to `uiStore.js`.
- `[ ]` 4.3 Move selection transform references (`inspectorLockRef`, `originalInspectorElementsRef`) to `selectionStore.js`.
- `[ ]` 4.4 Verify and resolve `activeTabIdRef` mapping.
- `[ ]` 4.5 Ensure `AppContent.jsx` is under 500 lines.

## 📦 WS2 — Replace Existence-Only Tests with Behavioral Tests
- `[ ]` 2.1 Delete the 20 definition check assertions.
- `[ ]` 2.2 Add math behavioral tests for hit-testing math (`CanvasSelection.test.js`) and rotations (`DiceMath.test.js`).
- `[ ]` 2.3 Add store reducer behavioral tests (`historyStore.test.js`, `clipboardStore.test.js`, `canvasStore.test.js`).
- `[ ]` 2.4 Verify test coverage meets target thresholds (≥70% statements / ≥60% branches).

## 📦 WS3 — Rewrite walkthrough.md
- `[ ]` 3.1 Restructure walkthrough to separate legacy 2024 work from the current refactor.
- `[ ]` 3.2 Update exact line count metrics and document remediation achievements.
- `[ ]` 3.3 Paste final verification logs and checks.
