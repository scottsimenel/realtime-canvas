# Tasks

## 📦 Stage 0 — Preparation
- `[x]` 0.1 Create target folders (`app/`, `app/hooks/`, `state/`, `lib/`)
- `[x]` 0.2 Create `client/src/lib/socket.js` lazy socket resolver
- `[x]` 0.3 Create `shared/protocol.js` event protocols
- `[x]` 0.4 Update `STRUCTURE.md` documentation
- `[x]` 0.5 Add `vitest` dependency and smoke test

## 📦 Stage 1 — Extract Pure Helpers
- `[x]` 1.1 Extract url helper `client/src/lib/url.js`
- `[x]` 1.2 Extract lock formatting `client/src/lib/locks.js`
- `[x]` 1.3 Extract ID generators `client/src/lib/ids.js`
- `[x]` 1.4 Extract element update merger `client/src/lib/mergeElement.js`
- `[x]` 1.5 Integrate helpers into `App.jsx`

## 📦 Stage 2 — Extract `uiStore` and `diceStore` (self-contained state)
- `[x]` 2.1 Extract UI/Layout state: `state/uiStore.js` & `app/hooks/useZenModeShortcut.js`
- `[x]` 2.2 Extract Dice configuration: `state/diceStore.js` & `app/hooks/useDiceTick.js`
- `[x]` 2.3 Integrate `uiStore` and `diceStore` into `App.jsx`

## 📦 Stage 3 — Extract `historyStore`, `selectionStore`, `clipboardStore`
- `[x]` 3.1 Extract undo/redo state: `state/historyStore.js`
- `[x]` 3.2 Extract selection state: `state/selectionStore.js`
- `[x]` 3.3 Extract clipboard state: `state/clipboardStore.js`
- `[x]` 3.4 Extract keyboard shortcuts hook: `app/hooks/useKeyboardShortcuts.js`
- [x] 3.5 Integrate Stage 3 stores and shortcuts into App.jsx

## 📦 Stage 4 — Extract `canvasStore` (the central state graph)
- `[x]` 4.1 Create `state/canvasStore.js` with elements/locks/roomSettings
- `[x]` 4.2 Rewire stores and components to consume `canvasStore`
- `[x]` 4.3 Extract tab CRUD handlers into `app/hooks/useTabs.js`

## 📦 Stage 5 — Extract `uploadStore` and `asset` handling
- `[x]` 5.1 Extract asset and hidden asset states into `state/uploadStore.js`
- `[x]` 5.2 Extract upload handlers (`handleImageUpload`, `isUploading`, `uploadError`) into `state/uploadStore.js`
- `[x]` 5.3 Extract spawn and layer actions into `app/hooks/useElementActions.js`

