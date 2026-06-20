# UX Proposal: Revamped Collaborative Image & Asset Library Manager

Currently, the image panel in the left sidebar (`LeftSidebar.jsx`) has several usability limitations:
1. **Flat Asset List**: All custom uploads and preset images are displayed in a single, unstructured grid. As the library grows to 50+ items, finding specific images becomes tedious.
2. **Immediate Action (Aggressive Spawning)**: Clicking an image card immediately spawns it on the board. There is no middle state to inspect details, rename, or configure scaling.
3. **No File Management**: Custom images cannot be renamed or permanently deleted from the room database/server. The "Hide" option only hides files locally (via localStorage) for the current user, leaving orphaned files on the server and cluttering other users' screens.
4. **No Search or Filter Controls**: Finding assets requires scrolling through everything, with no filter tags or text-search queries.
5. **No Visual Metadata**: Users cannot see asset dimensions, file size, upload dates, or uploader names.

---

## 🎨 Design Reference: Industry Best Standards

We model this proposal on the asset managers of industry-leading collaborative canvas and VTT applications:
* **Figma & Miro**: A clean hover hover preview, drag-and-drop file import, drag-and-drop spawning directly onto precise canvas coordinates, and quick search.
* **Roll20 & Foundry VTT**: Nested folder structures, folder CRUD operations, asset tagging (e.g. Map, Token, Asset), collaborative library synchronization, and permanent server deletion.
* **Owlbear Rodeo**: Dedicated categorization tabs (e.g., distinguishing between "Maps" and "Tokens" with custom snapping behaviors for each).

---

## 🚀 Proposed UX Features & Enhancements

### 1. Categorization, folders, and Tags
* **Virtual Folder Directory**: Allow users to create custom folders (e.g., "Battlemaps", "Monsters", "Tokens", "Props"). Folders are collaboratively synchronized across all users.
* **Type-based Categories**: Toggle chips at the top to isolate preset vs. user-uploaded assets, or automatically filter by dimensions (e.g., large assets as `Maps`, small square assets as `Tokens`).

### 2. Search, Filter, and Sort Controls
* **Fuzzy Search Bar**: Real-time filtering by filename, folder name, or uploader.
* **Sorting Menu**: Sort assets by upload date (newest/oldest), filename (A-Z/Z-A), or file size.

### 3. File Context Menu & Action popovers
Instead of immediate spawning on click, clicking an asset card reveals a dropdown menu or popover card containing:
* **Spawn on Canvas**: Creates a board element.
* **Set as Background**: Sets it as the active tab's canvas background image.
* **Rename Asset (Collaborative)**: Opens an inline input to rename the file. This updates the name for all connected users in real time.
* **Asset Details**: Displays dimensions (e.g., `1920x1080px`), file size (e.g., `1.2 MB`), upload date, and uploader name.
* **Delete Permanently**: Removes the asset from the room database and deletes the physical file from the backend `/uploads` folder for all users.
* **Hide Locally**: Hides it locally from the current user's explorer view (existing behavior).

### 4. Drag-and-Drop Spawning
* Enable HTML5 drag-and-drop from the sidebar explorer list directly onto the HTML5 Canvas.
* Upon dropping, the client translates the browser client `(clientX, clientY)` coordinates to virtual coordinates `(vx, vy)` based on the active zoom scale and pan offset, and spawns the image centered at that position.

### 5. Multi-Select & Batch Actions
* Introduce a "Batch Manage" checkbox. Selecting multiple assets allows bulk:
  - Spawning (distributed or stacked).
  - Deleting (permanent removal).
  - Moving (transfer to a folder).

---

## 🛠️ Mockup Design

````carousel
```text
[Current Flat Sidebar List]
-----------------------------------------
Spawning Images              [ 12 items ]
-----------------------------------------
[ Image 1 ]          [ Image 2 ]
(Preset)             (User Uploaded)
[ Set Bg ][ Hide ]   [ Set Bg ][ Hide ]
-----------------------------------------
[ Upload Custom Image Dropzone          ]
-----------------------------------------
```
<!-- slide -->
```text
[Proposed Revamped Library Explorer]
-----------------------------------------
Asset Library
-----------------------------------------
[ 🔍 Search library...                   ]
[ All ]  [ Presets ]  [ Uploads ]  [ Folders ]
-----------------------------------------
📁 Battlemaps (2)
   └─ [🖼️ Map Thumbnail] Swamp Arena (Grid 40)
📁 Tokens (5)
   ├─ [🖼️ Img Thumbnail] Fire Elemental  [⋮]
   └─ [🖼️ Img Thumbnail] Goblin Grunt     [⋮]
-----------------------------------------
[ ⋮ Action Dropdown Menu ]
├─ ➕ Spawn on Board (Drag & Drop)
├─ 🖼️ Set as Background
├─ ✏️ Rename (Collaborative)
├─ ℹ️ Details (1200x800px, 1.4MB, by Scott)
└─ 🗑️ Delete Permanently (Server-Side)
-----------------------------------------
[ 📤 Drag & drop to upload images...     ]
-----------------------------------------
```
````

---

## 🔄 Proposed Code Changes

We will implement this feature by making coordinate changes across client stores, sidebar components, and backend handlers:

### 1. Backend Server Configuration (`/server`)
* **`/server/server.js`**: Add a `app.delete('/api/uploads/:filename', ...)` REST endpoint to safely delete custom uploaded files from the disk storage.
* **`/server/handlers/elementHandler.js`**: Handle the socket event `EVENTS.ASSET_DELETE` to notify all users to remove the asset from their `assets` array.
* **`/server/registry.js`**: Add database mutations to rename and delete assets from the room's transactional state.

### 2. Shared Protocol (`/shared/protocol.js`)
* Define socket events:
  - `ASSET_DELETE`: Broadcast file deletion.
  - `ASSET_RENAME`: Broadcast asset filename updates.
  - `FOLDER_CREATE` / `FOLDER_DELETE` / `FOLDER_MOVE`: Manage folders.

### 3. Client state Stores (`/client/src/state`)
* **`uploadStore.js`**:
  - Integrate fuzzy search filters (`searchQuery`) and sort filters.
  - Implement bulk selection handlers.
  - Implement server deletion callbacks and rename handlers.

### 4. Client Sidebar View (`LeftSidebar.jsx`)
* Redesign the `leftPanelTab === 'images'` interface to support folders, search bars, context menus, details cards, and HTML5 drag start listeners.

### 5. Client Viewport interaction (`Canvas.jsx`)
* Add an `onDragOver` and `onDrop` listener to the canvas element.
* Extract the dropped image URL, calculate scale-adjusted virtual coordinates `(vx, vy)`, and trigger `handleSpawnImage` at the target point.
