# UX Proposal: Dialog-Based Collaborative Asset Manager

Currently, folder creation, deletion, renaming, and asset-moving controls reside inside the narrow Left Sidebar (`LeftSidebar.jsx`). With a sidebar width of only 320px, nesting tree directories, handling multi-file selections, and displaying asset metadata leads to a highly cramped user interface. 

This proposal details the design, layout, and collaborative interaction model for moving these management controls into a dedicated **Asset Manager Dialog** (modal), inspired by modern asset interfaces in Figma, Miro, and Foundry VTT.

---

## 🎨 Design Philosophy: Premium & Roomy

To make the asset manager feel like a first-class utility, we will design a large, responsive split-pane modal with glassmorphism aesthetics (`bg-slate-950/60 backdrop-blur-xl border border-slate-800 rounded-2xl`).

### 1. The Trigger / Entry Point
Instead of cluttering the sidebar, the Left Sidebar's Images tab will feature a clean, simplified list:
* **Recent Images**: A small horizontal carousel of the 6 most recently used/spawned assets.
* **Presets & Quick Select**: A compact grid of classical tokens and shapes.
* **"Manage Library" Button**: A prominent, styled button at the top (`✨ Manage Asset Library ↗`) that launches the full Asset Manager Dialog.

---

## 📐 Proposed Dialog Layout & Wireframe

The modal will span `max-w-5xl w-11/12 h-[80vh]` to provide ample whitespace and layout hierarchy. It utilizes a **Three-Column Split Pane**:

```text
+--------------------------------------------------------------------------------------------------+
|  📁 Asset Library Manager                                                                  [ X ] |
+------------------------------------+-----------------------------------------------+-------------+
| LEFT PANEL: DIRECTORIES            | CENTER PANEL: ASSETS GRID (Active: "Tokens")  | RIGHT PANEL |
|                                    | Search: [ 🔍 Search library... ]              | INSPECTOR   |
| +--------------------------------+ | View: [ Grid | List ]    Sort: [ Date Added ] |             |
| | 📁 All Assets                  | |                                               | [ Preview ] |
| | 📁 Presets                     | | +--------------+ +--------------+ +---------+ |   Goblin    |
| |                                | | | [🖼️] Goblin   | | [🖼️] Orc      | | [🖼️] Elf  | |   Grunt     |
| | 📁 Custom Folders              | | | Grunt        | | Warrior    | | Archer  | |             |
| |  ├─ 📁 Battlemaps              | | +--------------+ +--------------+ +---------+ | Dimensions  |
| |  └─ 📁 Tokens (Active)         | |                                               | 256x256 px  |
| |                                | | +--------------+ +--------------+             |             |
| | 🗑️ Hidden / Trash              | | | [🖼️] Troll    | | [🖼️] Mage     |             | Size        |
| +--------------------------------+ | | Boss         | | Scholar    |             | 45 KB       |
|                                    | | +--------------+ +--------------+             |             |
| [ 📁+ New Folder ]                 | +---------------------------------------------+ | Uploaded By |
|                                    | [ 📤 Drag & drop files here to upload into folder ]Scott       |
+------------------------------------+-----------------------------------------------+-------------+
| Actions: [ Move Selected ] [ Delete Selected ]                                    | [ Spawn ]   |
+--------------------------------------------------------------------------------------------------+
```

### 1. Left Panel: Folder Tree Navigation (Width: 25%)
* Lists standard system collections (`All Assets`, `Presets`, `Hidden/Trash`).
* Renders the collaborative custom folder hierarchy.
* Folders are selectable to filter the center pane.
* Actions: Click a folder's `✏️` or `🗑️` to rename or delete directly.
* Bottom action button: `📁+ New Folder` to instantiate a folder collaboratively.

### 2. Center Panel: Dynamic Asset Grid (Width: 55%)
* **Toolbar**:
  - Search input: Real-time fuzzy text filter on filenames.
  - View toggles: Switch between a visual grid (`Grid View`) and a tabular layout (`List View` showing name, dimensions, size, and date).
  - Sort dropdown: Order by Name (A-Z), Upload Date (Newest first), or File Size (Smallest/Largest).
* **Grid Area**:
  - Displays cards for all assets in the selected folder.
  - Double-click an asset card to instantly spawn it on the active canvas tab.
  - Hovering over a card shows quick action shortcuts (Add, Delete).
  - Right-click or click `⋮` on a card opens a context menu:
    - `➕ Spawn on Board`
    - `🖼️ Set as Canvas Background`
    - `📁 Move to Folder...` (opens folder list popover)
    - `✏️ Rename`
    - `🗑️ Permanent Delete` (removes from server storage & database)
* **Bottom Upload Dropzone**:
  - Dragging files into this center pane uploads them directly. Files are automatically tagged with the current active folder's `folderId` upon successful upload.

### 3. Right Panel: Metadata Inspector (Width: 20%)
* Shows a larger preview of the selected asset.
* Displays rich details:
  - Pixel dimensions (e.g. `2048 x 1536 px`).
  - File size (e.g. `2.4 MB`).
  - File type (e.g. `image/png`).
  - Owner (e.g. `Scott Simenel`).
  - Date uploaded (e.g. `June 20, 2026, 1:40 PM`).
* Configures default element scale recommendations (e.g. token size `1x1` grid units or battlemap size `30x20` grid units).

---

## 🚀 Collaborative Interactions & Batch Actions

1. **Real-time Synchronized Inspector**:
   - If User A selects an image, they inspect it.
   - If User B renames that image, User A sees the filename in the Inspector update in real-time.
   - If User B moves the asset to another folder, User A's view refreshes the asset lists without interrupting their click selection.
2. **Multi-Select & Bulk Operations**:
   - Shift-click or Control-click selects multiple asset cards in the center panel.
   - Batch footer actions appear:
     - `📁 Move Selected`: Transfers all selected items to a selected folder.
     - `🗑️ Delete Selected`: Permanently deletes selected uploads from the server disk.

---

## 🛠️ Implementation Strategy

### 1. Client Components
* **`AssetManagerModal.jsx`**: A new modular modal component placed in `/client/src/components/sidebar/` or a new `/client/src/components/dialogs/` directory.
* **`LeftSidebar.jsx`**: Replace the current folder directory tree markup with the simplified "Recent / Presets" sidebar view, and add the modal toggle state `isAssetManagerOpen`.

### 2. State & Hooks Integration
* Keep `uploadStore.js` as the single source of truth for assets and folders state.
* The modal will utilize the existing callbacks (`handleCreateFolder`, `handleRenameFolder`, `handleDeleteFolder`, `handleMoveAsset`, `handleRenameAsset`, `handleDeleteAsset`) without requiring backend protocol refactoring, as all events are already fully defined and collaborative!

---

## 🔍 Verification & Quality Plan

* **Design Integrity**: Confirm CSS class styles use standard vanilla Tailwind/CSS styling elements, supporting full dark-mode themes.
* **Drag-and-Drop Spawning**: Verify that double-clicking inside the modal spawns elements, and dragging from the sidebar (or modal, if feasible) still correctly translates viewport coordinates.
* **Linter & Tests**: Ensure all mock data in `uploadStore.test.js` is updated to verify modal visibility states and multi-select actions.
