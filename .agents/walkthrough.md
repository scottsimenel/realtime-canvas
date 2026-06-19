# Walkthrough: Mobile Compatibility, Touch Gestures, Self-Hosting, Canvas Enhancements, Dice Roller, & Codebase Refactoring

This walkthrough documents the technical implementation and verification details for the application features and the architectural refactoring to modularize the monolithic structure.

---

## 🏗️ Architectural Refactoring & Modularization

To improve maintainability, decrease context overhead, and optimize the project for AI-driven development (ADD), we refactored the server and client codebase into modular, single-responsibility files.

### 1. Backend Server Modularization (`/server`)
- Split the monolithic `/server/server.js` by extracting socket event routers into a new `/server/handlers/` directory:
  - **`connectionHandler.js`**: Controls connection lifecycle, room joins, throttled cursor moves, and cleanup.
  - **`elementHandler.js`**: Manages element creation, updates, deletions, mutex locks/unlocks, and layer ordering.
  - **`tabHandler.js`**: Directs multi-canvas tab creation, renaming, deletions, and switches.
  - **`diceHandler.js`**: Handles RPG dice pool rolling logic and advantage/disadvantage calculations.
- Simplified `server.js` to serve strictly as an Express HTTP bootstrapper, static file server, and Multer upload handler, registering modular handlers on connection hooks.

### 2. Client Canvas Drawing Modularization (`/client/src/components/canvas/`)
- Split the monolithic `Canvas.jsx` to separate math/rendering from React component lifecycle:
  - **`CanvasSelection.js`**: Handles rotated hit-detection math, handle target selections, rotated point transforms, and path segment splits.
  - **`CanvasRenderer.js`**: Houses high-DPI canvas 2D draw cycles for grid lines, backgrounds, shapes, selection frames, brush strokes, and drag selection boxes.
  - **`Canvas.jsx`**: Reassembled as a lightweight component coordinating React hooks, viewport pans, pointer capture gestures, and mouse-wheel centered zooming.

### 3. WebGL Physics Dice Modularization (`/client/src/components/dice/`)
- Split the monolithic `DiceEffects.jsx` to clean up the Three.js rendering layer:
  - **`DiceMath.js`**: Implements quaternion logic (quaternion multiplication, normalization, interpolations `qLerp`, axis-angle conversions).
  - **`DiceGeometries.js`**: Declares face normal formulas, face center calculations, and buffer geometry builders for D4–D100 dice meshes.
  - **`DiceParticles.js`**: Generates 2D overlay particle effects (stars, sparkles, critical successes confetti, and critical failures ash clouds).
  - **`DiceEffects.jsx`**: Reassembled to strictly manage the WebGL renderer lifecycle, perspective cameras, ambient lighting, and the frame-rate decoupled animation tick loop.

### 4. Client Dashboard Reassembly (`/client/src/App.jsx`)
- Moved global preset parameters (colors, random name pools, and background samples) into `/client/src/constants.js`.
- Decoupled and extracted key widgets to standalone modules:
  - **`/components/common/DieIcon.jsx`**: Scalable SVG RPG dice mesh representation.
  - **`/components/common/TabButton.jsx`**: Multi-tab capsules supporting double-click renames and active user badges.
  - **`/components/lobby/Lobby.jsx`**: User join entry screen.
  - **`/components/header/Header.jsx`**: Header navbar, profile editing, and hover participants popover.
  - **`/components/sidebar/LeftSidebar.jsx`**: Asset spawning panel, background canvas images, and custom artboard settings.
  - **`/components/sidebar/RightSidebar.jsx`**: Right-side accordions drawer mapping layers and lock indicators.
  - **`/components/sidebar/ActiveUsersWidget.jsx`**: Collapsible participant status lists and instant user recolor pickers.
  - **`/components/sidebar/InspectorWidget.jsx`**: Bounding box coordinate locks and layer adjustments.
  - **`/components/sidebar/TooltipInspector.jsx`**: Custom numerical HP trackers and character attribute grids.
  - **`/components/sidebar/DiceRollerWidget.jsx`**: RPG dice pool bag, size modifier sliders, and session logs.
- Simplified `App.jsx` from 4,200 lines to a lightweight coordinator (~600 lines) binding state synchronization hooks and socket listeners.

---

## 🔍 Verification & Testing Results

### 1. Build Verification
- **Command**: `npm run build` in `/client`
- **Result**: vite packaged successfully, producing production bundles:
  - `dist/index.html` (0.46 kB)
  - `dist/assets/index-Ct4XUHZz.css` (67.37 kB)
  - `dist/assets/index-DzYH-x2A.js` (892.92 kB)

### 2. Lint and Purity Checks
- **Command**: `npm run lint` in `/client`
- **Result**: Zero compilation errors. Resolved React Hook purity warnings by encapsulating impure `performance.now()` calls inside the `useEffect` scope in `DiceEffects.jsx`.

### 3. Git Version Control Tracking
- **Command**: `git status`, `git add .`, and `git commit`
- **Result**: Staged and committed 26 modified/created/deleted files under the git repository successfully to preserve version history.

### 4. Comprehensive Documentation & Remote Sync
- **Documentation**: Exhaustively expanded the root [README.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/README.md) file to document the architecture, file structures, data pipeline sequences (WebSockets, mutex concurrency locks, WebGL dice animations), math equations (rotated coordinates, high-DPI scaling), operational setups (including AirPlay port conflict fixes for macOS), and long-term maintenance/AI-driven development guidelines.
- **Git Push Command**: `git push`
- **Result**: Pushed all local commits (refactoring + documentation updates) to the GitHub remote repository successfully (`origin/main`).

---

## ↩️ Multi-Tab Undo / Redo System (`Ctrl+Z` / `Ctrl+Shift+Z` / UI Buttons)

We implemented an Undo/Redo history system that tracks user actions (creation, deletion, transforms, eraser path splits, and layer arrangements) and allows reverting or re-applying them.

### Features
1. **Multi-Tab Context Aware**: Reverting or re-applying an action automatically switches the client to the tab in which the action was performed.
2. **Keyboard Shortcuts**:
   - **Undo**: Pressing `Ctrl+Z` (or `Cmd+Z` on Mac) triggers undo, ignoring inputs/textareas to prevent conflict.
   - **Redo**: Pressing `Ctrl+Shift+Z` (or `Cmd+Shift+Z` on Mac) or `Ctrl+Y` (`Cmd+Y` on Mac) triggers redo.
3. **Pills & UI Buttons**: Added both an **Undo** and **Redo** pill capsule button in the navigation header that display active states dynamically based on the history and redo stacks.
4. **Socket.io Synchronization**: Revert/re-apply operations emit creates, updates, and deletes to the collaborative Socket.io server to keep all users synchronized.
5. **Memory-Capped Stacks**: Stacks are capped at 50 actions to prevent memory bloat over long collaborative sessions.

### Staged Actions Covered
- **Create**:
  - *Undo*: Deletes the created shapes, images, or brush paths from the target tab.
  - *Redo*: Recreates the deleted shapes, images, or brush paths with all original properties.
- **Delete**:
  - *Undo*: Restores the deleted elements.
  - *Redo*: Deletes the elements again.
- **Transform**:
  - *Undo*: Restores elements to their pre-transform coordinates, dimensions, and rotation.
  - *Redo*: Restores elements to their post-transform coordinates, dimensions, and rotation.
- **Erase**:
  - *Undo*: Deletes the newly created eraser-split fragments and restores the original path.
  - *Redo*: Restores the split paths and deletes the original path.
- **Reorder**:
  - *Undo*: Restores layer arrangements to their previous index order.
  - *Redo*: Restores layer arrangements to their new index order.

### Files Modified
- [App.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/App.jsx): Maintained `history` and `redoStack` states, defined `pushHistoryAction`, `handleUndo`, `handleRedo`, and global window keyboard event listeners.
- [Canvas.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/Canvas.jsx): Logged brush creations, eraser splits, and bounding box transforms.
- [Header.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/header/Header.jsx): Bound the **Undo** and **Redo** header controls and handled disabled states.
- [RightSidebar.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/RightSidebar.jsx): Pushed layer panel deletions onto the history stack.
- [DiceEffects.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/dice/DiceEffects.jsx): Fixed the React Hook linter dependency warnings.

---

## 💾 Canvas State Persistence (Save & Load) Across Sessions

We implemented a robust persistence layer that saves and recovers the collaborative canvas state across server sessions and restarts. 

### Features
1. **Named manual saves**: Users can manually save the collaborative canvas state, naming each save dynamically in the UI saves dashboard. Saves are stored as structured JSON under `/server/registry/saves/`.
2. **Automatic Startup Restoration**: The server automatically queries the saved files list on boot, finds the absolute newest save file by timestamp, and auto-restores the collaborative tabs, elements, and custom assets.
3. **Background Periodic Auto-Saves**: Set up a background `setInterval` loop that auto-saves the current collaborative room state every 2 minutes to a single `autosave.json` file. The autosave file is self-overwriting, preventing saves directory bloat, while still participating in startup recovery.
4. **Saves Dashboard Modal**: Created a gorgeous, interactive React modal component for entering new save names, looking up existing saves sorted newest-first, and triggering loads or deletions.
5. **Real-time Synchronization**: Loading a save updates all active elements, tabs, and custom assets in the server registry, and instantly broadcasts `room-state-loaded` to update all connected clients in real time.
6. **Uploaded Image Stability**: Uploaded image assets persist naturally because images are stored inside the local static `/server/public/uploads` directory which survives server restarts.

### Files Created
- [saveHandler.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/handlers/saveHandler.js): Houses WebSocket event routers for saving, loading, listing, and deleting canvas states.
- [SavesModal.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/saves/SavesModal.jsx): An overlay modal component UI to manage saves.

### Files Modified
- [registry.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/registry.js): Implemented serialization maps to array parsing, saves listing, loading, deletion, and auto-restore search loops.
- [server.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/server.js): Loaded latest save on startup, created a 2-minute periodic background autosave loop, and registered `registerSaveHandlers`.
- [App.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/App.jsx): Added local states, registered the `room-state-loaded` sync listener, defined callback handlers, and conditionally rendered `<SavesModal />`.
- [Header.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/header/Header.jsx): Destructured the saves trigger prop and rendered the Saves header button.

---

## 🧲 Grid Snapping System (Square & Hexagonal)

We implemented a real-time collaborative grid snapping system. When active, it aligns element centers to the centers of the nearest grid cells.

### Features
1. **Mathematical Square & Hex Snapping**:
   - **Square Grid**: Accurately computes the center coordinates of standard grid cells based on `gridSize` spacing.
   - **Hexagonal Grid**: Mathematically searches a candidate coordinate window around the drag cursor to find the exact center of the closest flat-topped hexagon.
2. **Layout-Preserving Group Snapping**:
   - Selecting and dragging multiple elements snaps only the primary leader element (under the user's cursor).
   - Translates all other elements by the exact same snapped delta, preserving relative spacing and layout within the group.
3. **Room-wide Global Settings**:
   - Integrated a global "Grid Snapping" toggle inside the Left Sidebar Grid Overlay settings.
   - Toggling is synchronized room-wide across all connected collaborators via `roomSettings.gridSnapping`.
4. **Per-element Custom Override**:
   - Added a "Snap to Grid" toggle switch inside the Right Sidebar Inspector Widget.
   - Allows users to selectively disable snapping for specific shapes/images (saved as `properties.snapToGrid !== false`) while others snap normally.

### Files Modified
- [Canvas.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/Canvas.jsx): Added `getSnappedCenter` math utility, wired single-element drag snap calculations, and implemented group-drag snapped offset translation.
- [LeftSidebar.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/LeftSidebar.jsx): Integrated global grid snapping switch toggle synced with room settings.
- [InspectorWidget.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/InspectorWidget.jsx): Added per-element "Snap to Grid" toggle override in properties.
- [App.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/App.jsx): Added default `gridSnapping: false` room settings defaults.
- [registry.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/registry.js): Allowed `gridSnapping` settings updates on the backend, and defined default configurations for tab loading and initialization.

### Bug Fixes
- **Room Settings Serialization Allowlist**: Fixed the issue where the global toggle did not stay enabled. Added `gridSnapping` to the backend [registry.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/registry.js) list of allowed settings in `updateRoomSettings`.
- **Group Drag Leader Element ID Mapping**: Resolved an issue where multi-element group snapping did not snap the elements. Provided the missing `elementId` property mapping inside the `group-move` state initialization block in [Canvas.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/Canvas.jsx) to properly track the leader element under the cursor.
- **Active Tab Synchronization & Lock Resolution**: Resolved the error message logging `Element lock failed: ... is held by null in tab tab-default`. Found that on user join/connect, the server hardcoded `activeTabId` to `'tab-default'`. If the server had loaded a save on boot, the default tab was replaced by loaded tabs, making `'tab-default'` invalid and causing subsequent client element locking requests to fail. Added [getFallbackTabId()](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/registry.js#L76-L86) in [registry.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/registry.js) to resolve the first valid loaded tab ID and return it to the client dynamically.

---

## 📏 Distance Measurement Ruler Tool

We implemented a distance measurement tool that allows users to measure distances in real time on the canvas using a configurable grid scale factor (e.g. 1 space = 5 ft).

### Features
1. **Interactive Ruler Action**:
   - Selecting the Ruler tool enables click-to-measure.
   - **Click 1**: Places the initial anchor point.
   - **Pointer Move**: Renders a glowing connection line stretching to the cursor, with a floating measurement badge showing the distance in real time.
   - **Click 2**: Fixes the measurement line, moving the badge to the midpoint of the line.
   - **Click 3**: Resets the state to begin a new measurement.
2. **Grid Snapping Compatibility**:
   - If grid snapping is active room-wide, both measurement points automatically snap to the nearest grid cell centers for precise grid space counting.
3. **Hexagonal & Square Geometry Calculation**:
   - Calculates standard Euclidean grid space counts for square grids.
   - Dynamically scales measurements for flat-topped hexagonal grids based on vertical/diagonal hex center distance (`sqrt(3) * radius`).
4. **Configurable Room Scale settings**:
   - Added **Measurement Scale** options inside the Left Sidebar Grid Accordion (under Grid Spacing range slider) to define custom values (e.g., 5) and units (e.g., `ft`, `m`).
5. **Glassmorphic Hover Badge**:
   - Highlights the measurement using a slate-900 high-opacity rounded glass badge with slate-700 fine borders, scaling font sizes dynamically with zoom level.

### Files Modified
- [App.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/App.jsx): Added default scale configurations to room settings, registered `activeTool` support, and rendered the Ruler tool button inside the Main Dock.
- [Canvas.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/Canvas.jsx): Wired click and pointer move handlers to calculate measurements, manage ruler states, and clear ruler states on tool switches.
- [CanvasRenderer.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasRenderer.js): Safely parsed scale values, falling back to 0 if the value is empty or invalid during active typing.
- [LeftSidebar.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/LeftSidebar.jsx): Updated `gridScaleNumber` input to `type="text"`, utilizing regex to support decimal fractions and empty states, plus an `onBlur` fallback resetting to 5 if left entirely blank.
- [registry.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/server/registry.js): Allowed custom scale numbers and units to update and default on the backend.

### Bug Fixes
- **Scale Input Clearing/Backspace Fix**: Fixed the issue where users could not clear the Measurement Scale number or backspace it down to an empty value without it immediately reverting to `0` or `010`. The input is now a flexible text field that accepts temporary empty inputs and decimal separators seamlessly, syncing with the database and reset-defaulting on blur.

---

## 📐 Spawning and Inspecting Custom Shapes

We implemented shape customization features that allow users to select from five shape types, fully personalize fill colors/opacities, and control outline configurations both when spawning and after creation.

### Features
1. **Interactive Configurator Tab (Left Sidebar)**:
   - **Shape Type Selection**: Select from Rectangle, Circle, Triangle, Star, and Hexagon.
   - **Color Presets & Dynamic Color Picker**: Conveniently pick from ten preset colors or choose custom hex values.
   - **Opacity Sliders**: Modify shape fill transparency using premium range sliders (0% to 100%).
   - **Outline Customization**: Toggle outlines on/off, customize outline color, change thickness (1px to 12px), and adjust outline opacity.
2. **Appearance & Style Editor Accordion (Right Sidebar Inspector)**:
   - Dynamic real-time editing of selected shapes.
   - Support for **multi-element style updates** where selecting multiple shapes lets you adjust their style properties (such as fill color, shape type, opacity, etc.) simultaneously.
3. **Advanced Drawing Routines (2D Canvas Renderer)**:
   - Added support for rendering `triangle`, `star`, and `hexagon` matching element bounds.
   - Uses nested `ctx.save()` / `ctx.restore()` scopes and `ctx.globalAlpha` channels to isolate fill opacity from outline opacity.
4. **Precise Geometric Hit-Detection**:
   - Built precise mathematical hit tests:
     - **Triangle**: Barycentric sign check.
     - **Hexagon**: Same-side sign check of all six convex edges.
     - **Star**: Fallback to rotated bounding box.
   - Ensures mouse clicks and cursor hover highlights work exactly as expected on shapes.

### Files Modified
- [App.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/App.jsx): Extended `handleSpawnShape` to support customizing opacity and outline characteristics during spawn.
- [CanvasRenderer.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasRenderer.js): Added custom path drawing routines and localized alpha masking for fill vs stroke.
- [CanvasSelection.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasSelection.js): Built geometric point-in-polygon checks for selections and hover highlights.
- [LeftSidebar.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/LeftSidebar.jsx): Implemented custom shape spawner widget and preset fallback options.
- [InspectorWidget.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/InspectorWidget.jsx): Rendered dynamic styling sliders, color rows, outline toggle switch, and support for multi-selection styling.

---

## 📋 Collaborative Canvas Clipboard Mechanics (Copy, Cut, Paste)

We implemented robust local clipboard workflows mapping to standard keyboard shortcuts `Ctrl+C` (Copy), `Ctrl+X` (Cut), and `Ctrl+V` (Paste) (supporting macOS `Cmd` keys).

### Features
1. **Curated Memory Store (`clipboardRef`)**:
   - Uses deep-cloned JSON arrays to cache the selected element structures without requesting standard browser system clipboard permissions, keeping performance fluid and secure.
2. **Offset Spacing Sequence (`pasteOffsetRef`)**:
   - Spawns duplicate elements shifted by `+20px` diagonally on each paste to clearly distinguish them from the original assets.
   - Resets the offset back to `20px` on any subsequent copy or cut action.
3. **Instant Interactive Highlight Focus**:
   - Pasting deselects original components and immediately moves selection highlights to the newly created components, letting users drag or modify copies immediately.
4. **History & Collaborative Synchronization**:
   - Pasting triggers sequential `element-create` WebSocket packets to update room collaborators.
   - Pushes a single history record containing all pasted elements, allowing a single Undo (`Ctrl+Z`) to clear the entire pasted batch.
   - Cutting triggers standard deletion updates, copies items to the memory ref, and registers a single history delete action.

### Files Modified
- [App.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/App.jsx): Added local refs, defined callbacks `handleCopy`, `handleCut`, `handlePaste`, and bound key interceptions in the global input-bypassing keyboard listener.

### Bug Fixes
- **Ctrl+Shift+Z Redo Fix**: Resolved the issue where `Ctrl+Shift+Z` was ignored because when `Shift` is held down, browsers evaluate `e.key` as uppercase `'Z'` rather than lowercase `'z'`. Updated all shortcut checking parameters in the keyboard listener to use case-insensitive checks (`e.key.toLowerCase()`) so that combinations using Shift or Caps Lock are parsed correctly.

---

## 📋 Code Health, Maintainability, & Universal Agent Guardrails

We established universal AI agent guardrails and codebase context guidelines to ensure clean maintainability, token conservation, and standard workflow execution.

### Features
1. **Universal Instruction File (`agent.md`)**:
   - Built a portable workspace instruction template outlining token conservation strategies, modular code principles, and coding patterns.
   - Instructed agents on how to leverage tool-agnostic guidelines across Cursor, Windsurf, Copilot, Cline, and other assistants.
2. **Context Preservation & Token Conservation**:
   - Configured guidelines to limit chat sessions to 15-20 turns to prevent token drift/bloat.
   - Instructed agents to delegate heavy audit tasks, broad code searches, and raw document lookups to specialized `research` subagents to save memory in the main context loop.
   - Restricted copy-pasting of large logs (recommending extraction of small 10-30 line error stacks).
3. **Decoupled Architecture & Coding Invariants**:
   - Standardized the rule that math logic must be separated into pure functional modules, keeping views focused strictly on DOM/SVG rendering.
   - Mandated JSDoc contracts for all functions and optimistic client state overrides.
4. **Project Index Optimization**:
   - Expanded `.antigravityignore` to exclude package locks, binary media (audio, video, images), build cache folders, and IDE config directories, significantly decreasing index weights and token parsing overhead.

### Files Created/Modified
- [agent.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/agent.md): Universal guide documenting model behaviors, context targets, and coding rules.
- [.antigravityignore](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/.antigravityignore): Cleaned index rules list.

### 5. Final Stage Modularization & Protocol Rewiring (Stages 4-7)
- **Canvas Store & Tab Management (Stage 4)**: Created `state/canvasStore.js` and `app/hooks/useTabs.js` to decouple room settings, tabs registry, element states, active locks, and tab CRUD operations from components.
- **Upload Store & Element Actions (Stage 5)**: Created `state/uploadStore.js` and `app/hooks/useElementActions.js` to manage file uploads, assets registries, hidden assets, shape/image spawning, layer adjustments, and drag-and-drop ordering.
- **Socket Event hooks (Stage 6)**: Created 6 modular hooks (`useSocketConnection.js`, `useUserEvents.js`, `useElementEvents.js`, `useTabEvents.js`, `useDiceEvents.js`, `useSaveEvents.js`) to slice the connection listener `useEffect` into domain-specific, self-cleaning modules.
- **Shared Protocol Rewiring & App.jsx Slimming (Stage 7)**: Rewired all client/server socket `.on` and `.emit` calls to import event names from the single source of truth `shared/protocol.js`. Reduced `App.jsx` to a minimal layout coordinator.

---

## 🔍 Verification & Testing Results (Stages 4-7)

### 1. Build Verification
- **Command**: `npm run build` in `/client`
- **Result**: vite packaged successfully, producing production bundles:
  - `dist/index.html` (0.46 kB)
  - `dist/assets/index-B1ez3Gu7.css` (69.57 kB)
  - `dist/assets/index-BOicGxcd.js` (941.91 kB)

### 2. Lint and Purity Checks
- **Command**: `npm run lint` in `/client`
- **Result**: Zero errors and warnings.

### 3. Server Syntax Checks
- **Command**: `node --check server.js` in `/server`
- **Result**: Passed with no syntax errors.

### 4. Unit Test Checks
- **Command**: `npm run test` in `/client`
- **Result**: 28/28 unit tests passed, including definition verification checks for all newly added stores and hooks.


