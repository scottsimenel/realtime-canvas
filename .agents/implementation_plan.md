# Implementation Plan — WS25: Continuous Touchscreen / Tabletop Mode

## Goal Description
When using Antigravity Canvas on a large horizontal touchscreen (e.g., placing physical miniatures on the glass or having multiple players touch the board simultaneously), persistent touch contacts and multi-finger interactions collide with standard tablet/phone gestures:
1. **Two-finger gesture hijacking**: Placing a second figure or touching the screen while one contact is already resting on the glass makes `activePointerIds.length === 2`, immediately hijacking the interaction into `touch-gesture` (viewport pinch-to-zoom/pan) or `token-pinch-resize`.
2. **3+ contact lockout**: In the current `handlePointerDown`, any touch when `activePointerIds.length > 2` is ignored completely.
3. **Single global `dragStateRef`**: Only one drag state can exist at a time, preventing two tokens from being dragged simultaneously or a token from being dragged while another pointer is active.
4. **Accidental marquee selection**: Resting a figure or palm on empty canvas in `select` mode starts a marquee drag-selection box (`mode: 'select'`) and clears active selections.

We will introduce a **Continuous Touchscreen / Tabletop Mode** toggle (`isTabletopMode`) that:
- **Disables conflicting touch gestures**:
  - Disables 2-finger viewport pinch-to-zoom and 2-finger pan (`touch-gesture`).
  - Disables 2-finger token pinch-to-resize (`token-pinch-resize`).
  - Disables empty-canvas marquee drag-selection (`mode: 'select'`).
- **Enables independent per-pointer multi-touch token dragging**:
  - Tracks token drag sessions per `pointerId` (`multiTouchDragsRef`), allowing users to drag digital tokens smoothly even while $N$ other touch points (physical miniatures, palms, or other players' fingers) remain on the screen, including dragging multiple distinct tokens simultaneously.
  - Preserves collaborative mutex locks (`ELEMENT_LOCK` / `ELEMENT_UNLOCK`), fast-flick race protection, grid snapping, layer elevation (`adjustElementsToFront`), and per-pointer Undo/Redo history (`pushHistoryAction`).
- **Provides 1-tap UI access & visual status**:
  - Adds a quick toggle button in both [`CanvasDock.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasDock.jsx) and the floating bottom-right viewport bar in [`Canvas.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/Canvas.jsx), persisted in `localStorage` via [`uiStore.js`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/uiStore.js).

---

## Blast Radius & Architectural Compliance

- **Client-only changes**: No server handlers or shared socket protocol events require modification. Existing `EVENTS.ELEMENT_LOCK`, `EVENTS.ELEMENT_UPDATE`, `EVENTS.ELEMENT_UNLOCK`, and `EVENTS.ELEMENTS_REORDER` contracts are strictly respected.
- **Decoupled Math (`agent.md` §1 `[BLOCKING]`)**: All coordinate offset, hit-testing, and grid-snapped position calculations for multi-touch token dragging will live as exported pure functions in [`CanvasSelection.js`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasSelection.js) with full JSDoc contracts and unit tests.
- **`App.jsx` Boundary (`agent.md` §6 `[BLOCKING]`)**: `App.jsx` is not touched. State lives in [`uiStore.js`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/uiStore.js) and is wired via [`AppContent.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/AppContent.jsx) and [`CanvasDock.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasDock.jsx).

---

## Proposed Changes

### 1. Pure Multi-Touch Hit-Testing & Snapping Math
#### [MODIFY] [CanvasSelection.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasSelection.js)
- Add and export **`getSnappedCenter(cx, cy, gridType, gridSize)`** (moving the existing helper from `Canvas.jsx` into `CanvasSelection.js` so all geometry math lives in the pure math module).
- Add and export **`canStartPointerTokenDrag(coords, elements, locks, currentUserId, activePointerDrags)`**:
  - Finds the top-most unlocked element at `coords` using `getElementAtCoords`.
  - Returns `null` if no element is hit, if the element is permanently locked (`el.properties?.locked`), if locked by another user (`locks[el.id] !== currentUserId`), or if another pointer in `activePointerDrags` is already dragging `el.id`.
  - Returns `{ element, offsetX: coords.x - element.x, offsetY: coords.y - element.y }`.
- Add and export **`calculateSnappedDragPosition(element, coords, offsetX, offsetY, roomSettings)`**:
  - Computes `{ x, y }` from `coords.x - offsetX` and `coords.y - offsetY`, applying `getSnappedCenter` when `roomSettings?.gridSnapping && roomSettings?.showGrid && element.properties?.snapToGrid !== false`.

---

### 2. UI State Store (`isTabletopMode`)
#### [MODIFY] [uiStore.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/uiStore.js)
- Add `isTabletopMode` state (initialized from `localStorage.getItem('canvas_tabletop_mode')`, default `false`), `setIsTabletopMode`, and `handleToggleTabletopMode`.
- Persist changes to `localStorage` under `'canvas_tabletop_mode'`.
- In `handleCanvasInteraction`, when `isTabletopMode` is active, avoid aggressively collapsing sidebars on every passive figure contact if desired, or keep standard mobile panel dismissal clean.

---

### 3. Iconography & Toolbar Controls
#### [MODIFY] [Icon.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/common/Icon.jsx)
- Add `'touchscreen'` icon to `ICONS` (clean vector tablet/multi-touch hand-point icon).

#### [MODIFY] [CanvasDock.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasDock.jsx)
- Consume `isTabletopMode` and `handleToggleTabletopMode` from `useUiStore()`.
- Add a 1-tap toggle button in the dock next to the Zen Mode button with emerald highlight styling when active (`bg-emerald-500/20 text-emerald-400 border border-emerald-500/30`).

#### [MODIFY] [AppContent.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/AppContent.jsx)
- Pass `isTabletopMode` and `onToggleTabletopMode={handleToggleTabletopMode}` from `useUiStore()` to `<Canvas />`.

---

### 4. Canvas Multi-Touch Lifecycle & Gesture Suppression
#### [MODIFY] [Canvas.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/Canvas.jsx)
- Add `multiTouchDragsRef = useRef({})` mapping `pointerId -> { elementId, offsetX, offsetY, hasLock, originalElement }`.
- **In `handlePointerDown`**:
  - When `isTabletopMode` is `true`:
    - Skip the `activePointerIds.length === 2` pinch-to-zoom (`touch-gesture`) and pinch-to-resize (`token-pinch-resize`) branch completely.
    - Allow any pointer (`activePointerIds.length >= 1`) to initiate an action:
      - If `activeTool === 'pan'` or Spacebar/middle-click is pressed: start viewport pan tracked by `panPointerId`.
      - If `activeTool === 'select'`:
        - First check if single-selection resize/rotate handle is hit (when no conflicting drag is active on that element).
        - Otherwise call `canStartPointerTokenDrag(coords, elements, locks, currentUser?.id, multiTouchDragsRef.current)`.
        - If a token is hit: register `multiTouchDragsRef.current[e.pointerId]`, add `element.id` to `selectedElementIds`, elevate via `adjustElementsToFront([element.id])`, and emit `EVENTS.ELEMENT_LOCK` with fast-flick race cleanup.
        - If empty canvas is hit: do **not** start `mode: 'select'` (no marquee drag-selection box). If no other pointer is currently dragging a token, clear `selectedElementIds`.
      - If `activeTool` is `'pen'`, `'eraser'`, or `'measure'`: allow standard tool interaction if no other tool drag is currently active.
- **In `handlePointerMove`**:
  - If `multiTouchDragsRef.current[e.pointerId]` exists:
    - Calculate new `{ x, y }` via `calculateSnappedDragPosition`.
    - Optimistically update the element in `setElements`.
    - If `session.hasLock` is true, emit `EVENTS.ELEMENT_UPDATE`.
- **In `handlePointerUp` / `handlePointerCancel` / `handlePointerLeave`**:
  - If `multiTouchDragsRef.current[e.pointerId]` exists:
    - Emit final `EVENTS.ELEMENT_UPDATE` and `EVENTS.ELEMENT_UNLOCK` (if `session.hasLock` was acquired).
    - Clear lock from `setLocks`.
    - Push `'transform'` action to `pushHistoryAction` if position changed relative to `session.originalElement`.
    - Delete `multiTouchDragsRef.current[e.pointerId]`.
- **Floating Zoom Bar Indicator**:
  - Add a compact 1-tap Tabletop Mode toggle button in the bottom-right Zoom pill in `Canvas.jsx` so players/DMs can see and toggle Continuous Touchscreen Mode directly from the viewport corner.

---

## Verification Plan

1. **Automated Unit Tests (`vitest run`)**:
   - [`CanvasSelection.test.js`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/__tests__/CanvasSelection.test.js): Add unit tests for `getSnappedCenter`, `canStartPointerTokenDrag` (valid token hit, empty canvas returns `null`, locked token rejection, duplicate pointer on same token rejection, simultaneous distinct tokens allowed), and `calculateSnappedDragPosition` (free move, square grid snap, hex grid snap, `snapToGrid: false` override).
   - [`stores.test.js`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/__tests/stores.test.js): Add unit tests for `isTabletopMode` and `handleToggleTabletopMode` in `UiProvider`.
   - [`Icon.test.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/common/__tests__/Icon.test.jsx): Verify `'touchscreen'` icon renders cleanly.
2. **Linter & Build Verification**:
   - Run ESLint (`eslint .`), Vite production build (`vite build`), and server syntax/unit tests (`node --check server/server.js`, `node --test`).
