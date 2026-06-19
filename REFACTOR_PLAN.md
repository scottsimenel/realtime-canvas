# App.jsx Decomposition — Staged Refactor Plan

**Status:** Implemented
**Owner:** Architecture
**Target file:** `client/src/App.jsx` (~2,750 lines → goal: < 400 lines)

---

## 🎯 Why This Refactor

`App.jsx` currently owns: socket connection lifecycle, ~20 socket event
listeners, the entire `tabs`/`users`/`elements`/`locks` state graph,
undo/redo history, clipboard, inspector transforms, image upload, dice
config, save management, and layout/zen-mode state.

This is the single largest maintainability liability in the codebase:

- **Context-window cost:** every agent edit touching app behavior must load
  the whole file, driving up latency and hallucination risk.
- **Change amplification:** unrelated concerns (dice, uploads, layout) sit
  side by side, so diffs are noisy and merge conflicts are frequent.
- **Untestable:** the socket wiring and state reducers are buried inside a
  component and cannot be unit tested in isolation.

**The `agent.md` §Architectural Rules 6 "Protect the Architecture
Boundaries" rule freezes `App.jsx` at its current size. This plan is the
controlled path to actually shrink it.**

---

## 📐 Target Architecture

```
client/src/
├── app/
│   ├── App.jsx                   # Layout composition only (providers + panels)
│   ├── AppProviders.jsx          # Socket + state providers
│   └── hooks/
│       ├── useSocketConnection.js
│       ├── useElementEvents.js
│       ├── useUserEvents.js
│       ├── useTabEvents.js
│       ├── useDiceEvents.js
│       ├── useSaveEvents.js
│       └── useKeyboardShortcuts.js
├── state/
│   ├── canvasStore.js            # tabs/elements/locks/roomSettings + setters
│   ├── selectionStore.js         # selectedElementIds + inspector inputs
│   ├── historyStore.js           # undo/redo stacks + pushHistoryAction
│   ├── clipboardStore.js         # copy/cut/paste
│   ├── uiStore.js                # layout, zen mode, panel collapse
│   ├── diceStore.js              # dice config + roll history
│   └── uploadStore.js            # assets, upload progress/errors
├── lib/
│   ├── socket.js                 # socket singleton + URL resolution
│   └── optimisticUpdate.js       # apply/rollback helper
└── components/                   # (unchanged) Canvas, dice, sidebar, ...
```

### Design principles for the refactor
1. **Hooks own effects (socket listeners, keydown), state stores own data.**
   A hook may *call* a store's setters; a store never imports a hook.
2. **No behavior change.** This is a pure move refactor. Every stage must
   leave the app functionally identical. Features are added *after* the
   stage that opens space for them, never during.
3. **One concern per PR.** Each stage below is independently reviewable
   and independently revertible.
4. **Verify per stage.** After every stage: `npm --prefix client run lint`,
   `npm --prefix client run build`, and manual smoke-test the features
   that stage touched. No stage merges on a red build.

---

## 📦 Stage 0 — Preparation (no behavior change)

**Goal:** put safe scaffolding in place so later stages are mechanical.

| Step | Action |
|------|--------|
| 0.1 | Create the empty directories: `app/`, `app/hooks/`, `state/`, `lib/`. |
| 0.2 | Add `client/src/lib/socket.js` exporting a lazy `getSocket()` that resolves `SOCKET_URL` exactly as `App.jsx` lines 15–17 do today. `App.jsx` continues to create its own socket for now; this module is unused but available. |
| 0.3 | Add `shared/protocol.js` at the repo root with the full event-name constant set and JSDoc `@typedef`s for every payload, transcribed verbatim from current usage. Do **not** rewire anything to use it yet — it is a reference artifact. |
| 0.4 | Update `STRUCTURE.md` to document the new (empty) directories and `shared/protocol.js`. |
| 0.5 | Add `vitest` as a dev dependency and a `test` script to `client/package.json`, with one trivial smoke test, to establish the harness. |

**Verification:** build + lint green; `npm --prefix client test` passes the smoke test.

---

## 📦 Stage 1 — Extract pure helpers (lowest risk, highest value)

**Goal:** move already-pure logic out of `App.jsx` into tested modules.
Each is a pure function with no React or socket dependency.

| Step | Extract from `App.jsx` | New module | Notes |
|------|------------------------|------------|-------|
| 1.1 | `getFullUrl` (lines ~19–26) | `client/src/lib/url.js` | Pure. Add unit tests. |
| 1.2 | Lock-formatting helper (`Array<[eId,uId]>` → `{[eId]:uId}`), repeated inline at ~5 sites (join, connect-rejoin, tab-create, room-state-loaded, etc.) | `client/src/lib/locks.js` `locksArrayToMap(entries)` | Dedupe ~5 inline copies. |
| 1.3 | ID generators (`el_${Date.now()}_...`, `tab_...`, `roll_...`, `asset_...`) | `client/src/lib/ids.js` (`newElementId`, `newTabId`, `newRollId`, `newAssetId`) | Dedupe scattered inline templates. |
| 1.4 | Element-update merger (`{...el, ...updates, properties: {...}}` logic repeated in `element-updated`, `element-updated-batch`, `handleInspectorChange`) | `client/src/lib/mergeElement.js` | Dedupe ~3 copies. |

**Verification:** build + lint + new unit tests green; manual smoke test of
join, tab switch, drag, inspector edit.

---

## 📦 Stage 2 — Extract `uiStore` and `diceStore` (self-contained state)

These two state clusters are leaf-like: few inbound dependencies, no socket
writes that other clusters care about.

| Step | Cluster | New module(s) |
|------|---------|---------------|
| 2.1 | Layout state: `showHeader`, `showLeftSidebar`, `showRightSidebar`, `showTabsBar`, `leftPanelTab`, `*Collapsed`, `isZenMode`, `handleToggleZenMode`, `handleCanvasInteraction`, the `\` keydown for zen | `state/uiStore.js` + `app/hooks/useZenModeShortcut.js` |
| 2.2 | Dice config: `mixedDice`, `d20Count`, `d20Mode`, `enable3dDice`, `diceSizeMultiplier` (incl. its localStorage effect), `rollHistory`, `activeRolls`, `hoveredRoll`, `rollTick`, `handleRollDice`, `handleCriticalRoll`, `shakeClass` | `state/diceStore.js` + `app/hooks/useDiceTick.js` |

**Verification:** build + lint green; manual smoke test of zen toggle,
panel collapse on selection, dice roll + crit shake + size slider.

---

## 📦 Stage 3 — Extract `historyStore`, `selectionStore`, `clipboardStore`

Undo/redo, selection, and clipboard are interlinked but self-contained
behind a small API surface.

| Step | Cluster | New module |
|------|---------|------------|
| 3.1 | `history`, `redoStack`, `pushHistoryAction`, `handleUndo`, `handleRedo` (the large switch blocks over `action.type`) | `state/historyStore.js` |
| 3.2 | `selectedElementIds`, `inputWidth/Height/Rotation`, `isInspectorFocused`, the `prevSelectedElementIds`/`prevElements` sync-during-render block | `state/selectionStore.js` |
| 3.3 | `clipboardRef`, `pasteOffsetRef`, `handleCopy`, `handleCut`, `handlePaste` | `state/clipboardStore.js` |
| 3.4 | The global Ctrl+Z/Y/C/X/V keydown handler | `app/hooks/useKeyboardShortcuts.js` (consumes the three stores above) |

**Why these stay together in one stage:** undo/redo emits socket events that
mutate elements, so `historyStore` needs `canvasStore` setters (extracted in
Stage 4). Extracting selection/clipboard first keeps the dependency
direction one-way (history → canvas), avoiding a circular wait.

**Verification:** build + lint green; manual smoke test of undo/redo across
create/delete/transform/reorder/erase, multi-select inspector, copy/cut/paste.

---

## 📦 Stage 4 — Extract `canvasStore` (the central state graph)

This is the keystone: `tabs`, `elements`, `locks`, `roomSettings`, plus the
`setElements`/`setLocks`/`setTabs`/`updateRoomSettings` setters. Most other
stores and all event hooks depend on it, so it lands after its consumers
are already modular.

| Step | Action |
|------|--------|
| 4.1 | Create `state/canvasStore.js` exposing `tabs`, `activeTabId`, `setTabs`, `setActiveTabId`, and derived accessors `activeTab`, `elements`, `locks`, `roomSettings`, plus `setElements`/`setLocks` bound to the active tab (the `activeTabIdRef` pattern at `App.jsx` ~74–127). |
| 4.2 | Rewire `historyStore`, `selectionStore`, `clipboardStore`, `uiStore` (canvas-interaction callback), and the inspector transform handlers (`handleStartInspectorTransform`, `handleEndInspectorTransform`, `handleInspectorChange`, `handleToggleSelectionLock`) to consume `canvasStore`. |
| 4.3 | Extract the tab CRUD handlers (`handleCreateTab`, `handleDeleteTab`, `handleRenameTab`, `handleSwitchTab`) into `state/canvasStore.js` or a thin `app/hooks/useTabs.js`. |

**Verification:** build + lint green; full element/tab interaction smoke
test — this stage touches the most code and is the highest-risk stage.

---

## 📦 Stage 5 — Extract `uploadStore` and `asset` handling

| Step | Cluster | New module |
|------|---------|------------|
| 5.1 | `assets`, `hiddenAssetUrls`, `showHiddenMode`, `draggedElementId`, `dragOverElementId`, `toggleHideAsset`, the `hiddenAssetUrls` localStorage effect, `allImageAssets`/`visibleAssets`/`hiddenAssets` derivations | `state/uploadStore.js` |
| 5.2 | `isUploading`, `uploadError`, `handleImageUpload` (the `fetch('/api/upload')` multipart flow) | `state/uploadStore.js` |
| 5.3 | `handleSpawnImage`, `handleSpawnShape`, layer-reorder handlers (`adjustElementLayer`, `adjustSelectedElementsLayer`, drag-drop reorder) | `app/hooks/useElementActions.js` |

**Verification:** build + lint green; manual smoke test of image upload
(single + multi), preset image spawn, shape spawn, layer reorder, hide/show asset.

---

## 📦 Stage 6 — Extract socket event hooks (the listener tangle)

With state out of `App.jsx`, the ~20 `socket.on(...)` registrations inside
the big connection `useEffect` (`App.jsx` ~356–703) can move into focused
hooks that each own one event domain. Each hook takes the stores it needs.

| Step | Events | New hook |
|------|--------|----------|
| 6.1 | connect / disconnect / rejoin-room | `useSocketConnection.js` |
| 6.2 | `user-joined`, `user-renamed`, `user-recolored`, `user-left`, `cursor-update`, `tab-switched` | `useUserEvents.js` |
| 6.3 | `element-locked`, `element-unlocked`, `element-updated`, `element-updated-batch`, `element-created`, `element-deleted`, `asset-created`, `elements-reordered`, `room-settings-updated` | `useElementEvents.js` |
| 6.4 | `tab-created`, `tab-deleted`, `tab-renamed` | `useTabEvents.js` |
| 6.5 | `dice-rolled` | `useDiceEvents.js` |
| 6.6 | `room-state-loaded` | `useSaveEvents.js` (along with `fetchSaves`, `handleCreateSave`, `handleLoadSave`, `handleDeleteSave`) |

**Verification:** build + lint green; **full multi-user smoke test** — open
two browser tabs in the same room and verify: cursor sync, element drag/
transform/delete propagation, lock outlines in the other user's color, tab
create/switch/delete sync, dice roll broadcast, save create/load.

---

## 📦 Stage 7 — Rewire to `shared/protocol.js` and slim `App.jsx`

| Step | Action |
|------|--------|
| 7.1 | Replace every hardcoded socket event string in `/server/handlers/*`, `/client/src/app/hooks/*`, and `/client/src/state/*` with imports from `shared/protocol.js`. This is the three-file-protocol rule from `agent.md` applied in bulk. |
| 7.2 | Reduce `App.jsx` to layout composition only: mount providers, render `<Lobby>` or `<Header>/<Canvas>/<Sidebars>/<DiceEffects>`, wire the few callbacks that genuinely belong at the top level (e.g. passing `currentUser` down). Target: **< 400 lines**. |
| 7.3 | Update `STRUCTURE.md` to reflect the final directory tree. |

**Verification:** build + lint green; full multi-user smoke test; confirm
`App.jsx` line count is under target.

---

## ✅ Definition of Done

- [ ] `App.jsx` is under 400 lines and contains no socket listeners, no
      business logic, and no `useState` beyond layout composition.
- [ ] Every extracted module has a JSDoc contract; pure helpers have unit tests.
- [ ] No hardcoded socket event strings remain in `server/` or `client/` —
      all flow through `shared/protocol.js`.
- [ ] `STRUCTURE.md` matches the final tree.
- [ ] Full multi-user smoke test passes in two browsers.
- [ ] `npm --prefix client run lint` and `npm --prefix client run build`
      are green at every stage boundary.

---

## ⚠️ Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The `prevSelectedElementIds`/`prevElements` "sync during render" pattern (App.jsx ~309–345) is subtle and easy to break. | Keep it intact inside `selectionStore` during Stage 3; do not "clean it up" into an effect without a separate, tested change. |
| Undo/redo emits socket events that mutate shared registry state (blast radius: all users). | Stage 3 lands after its dependency direction is clear; smoke-test undo in a two-client room during Stage 6. |
| Extracting `canvasStore` (Stage 4) touches the most call sites. | Do it as one focused PR with no other changes; lean on the build + a thorough manual smoke test. |
| Shared-module import cycles between stores. | Enforce the one-way dependency direction: hooks → stores → lib. A store may not import a hook. |
| Agent-driven drift mid-refactor. | The `agent.md` `[BLOCKING]` rules (read-before-write, blast-radius, verify-then-claim, three-file protocol) apply to every stage. |

---

## 🗓️ Suggested Cadence

- Stages 0–1 can land quickly (scaffolding + pure helpers); one PR each is fine.
- Stages 2–3 are medium-risk; one PR per stage, reviewed.
- Stage 4 is the keystone; dedicated PR, full smoke test, ideally human-reviewed.
- Stages 5–7 are mechanical once 4 is stable; can be batched cautiously.

Each stage is independently shippable — if any stage reveals a problem,
it can be reverted without unwinding the others, because every stage leaves
the app in a working state.
