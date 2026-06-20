# Feature Roadmap & Planning

This document tracks planned collaborative features for the Antigravity Canvas. It details their functional specifications, technical implementation strategies, and Socket.io event interfaces.

---

## 📋 Feature Checklist

- [x] **Feature 1: Collaborative Freehand Drawing Brush**
  - Ability to draw lines on the canvas in real-time.
  - Brush options: Custom colors, pen size, and resizable eraser mode (5px to 100px size options).
  - Action: "Clear Canvas" button to reset freehand drawings.
- [x] **Feature 2: Image Transforms (Resize, Rotate, Delete)**
  - Click to select spawned images and show interactive transform handles.
  - Support dragging handles to resize and rotate (angle state syncing).
  - Delete button/key to purge elements from the board.
- [x] **Feature 2.5: Drag Selection (Multi-Select) & Group Transforms**
  - Drag select intersecting elements on empty space.
  - Apply unified selection outline, bounding box, and group resizing/rotation.
  - Acquire batch locks and handle partial concurrency locks gracefully.
  - Global Transform Inspector control panel with batch resizing, absolute rotation, and delete button.
- [x] **Feature 3: Custom Image Asset Upload**
  - Drag-and-drop or file selector to upload custom files from local computers.
  - Server-side static uploads storage or Base64 streaming fallback.
- [x] **Feature 4: Swappable Grid-Overlaid Background Canvas**
  - Set a room-wide background image URL.
  - Toggle background image visibility.
  - Draw background under the grid lines (ensuring grid remains visible and clear).
- [ ] **Feature 5: Initiative Tracker**
  - Turn order tracker for combat/encounters.
- [ ] **Feature 6: Full Character Sheet**
  - Modeled after DND 5th edition (2014) rules, including resource management, stats, features, abilities, and items.

---

## 🐛 Bug Fixes & Feature Improvements

- [ ] **Fix input clearing & formatting**: Fix text/numerical input elements to allow for clearing the box. Right now you are unable to clear it (it will show 0 and cannot be deleted to be empty), and additionally when 0 is displayed, you can only add numbers to the right of it (i.e. 010 for 10, 023 for 23).
- [ ] **Auto-unlocking locked elements**: For element locking, there should be some automatic unlocking that occurs after some period of inactivity (e.g. 30 seconds after the last time a user interacted with an element). Additionally, elements should automatically unlock when a user switches canvases.
- [ ] **Send to Front/Back ordering controls**: Element ordering should have some way to send an element all the way to the front or back of the entire priority stack.
- [ ] **Representative bottom bar icons**: Clearer, more representative icons in the bottom bar to represent the different features and panels.
- [ ] **Categorized image management system**: Improve the image management system, including the ability to delete images, and categorize/group images into categories (backgrounds, characters, NPCs, spoilers, etc.).
- [ ] **Large-scale element ordering view**: Currently the ordering section for elements is small and hard to use when there are a large number of elements spawned (only a handful of elements are shown in the list scroll view but there may be 30+ elements active, making it hard to find specific elements and manage their ordering via dragging).

---

## 🛠️ Feature Design & Technical Specifications

### Feature 1: Collaborative Freehand Drawing Brush
#### Technical Strategy
*   **Data Representation**: Freehand drawings are represented as `"path"` elements containing an array of `{x, y}` coordinates, a `color`, `width`, and an `isEraser` flag.
*   **Socket Flow**: 
    1.  On `pointerdown`, client creates a unique path ID and emits `element-create` with the path shell.
    2.  On `pointermove`, client throttles updates and emits `path-point-add` with `{ pathId, point: {x, y} }` to stream path growth rather than re-sending the whole path array.
    3.  Server registry appends points to the path element and broadcasts `path-point-added` to room clients.
*   **Eraser Mode**: Implemented by calculating vector line segment intersections to split drawing strokes. Includes an independent, customizable eraser size state (`5px` to `100px`) that dynamically scales the collision detection radius and cursor indicator overlay.
*   **Clear Drawings**: Emits `canvas-clear-drawings` to server, resetting all path-type elements in the registry.

---

### Feature 2: Image Transforms (Resize, Rotate, Delete)
#### Technical Strategy
*   **Transform Handles**: Selecting an image triggers rendering bounding outlines with 8 handles (corners + midpoints) and a rotation anchor handle (extending above the top center).
*   **State Extensions**: Extend `CanvasElement` properties with:
    ```typescript
    interface CanvasElement {
      rotation: number; // Angle in radians
      scaleX: number;
      scaleY: number;
    }
    ```
*   **Collision Detection**: Ray-casting or transformed coordinate space conversions to detect cursor clicks inside rotated bounding boxes.
*   **Socket Flow**: Uses existing `element-lock` and `element-update` channels, transmitting updated `width`, `height`, and `rotation` values.
*   **Deletions**: Emits `element-delete` with `{ elementId }`, clearing the item from the registry and emitting `element-deleted` to other clients.

---

### Feature 3: Custom Image Asset Upload
#### Technical Strategy
*   **Backend Upload endpoint**: Set up `multer` in Express server to upload files to `/server/uploads/` directory.
*   **Static Serving**: Configure Express static middleware to serve uploads: `app.use('/uploads', express.static('uploads'))`.
*   **Socket Flow**:
    1.  Client uploads file to server `/upload` REST endpoint via multipart form data.
    2.  Server returns the file URL: `http://localhost:5000/uploads/filename.jpg`.
    3.  Client spawns the image element by emitting `element-create` using that URL.

---

### Feature 4: Swappable Grid-Overlaid Background Canvas
#### Technical Strategy
*   **Room State**: Server registry holds global room settings:
    ```typescript
    interface RoomSettings {
      backgroundImageUrl: string | null;
      showBackground: boolean;
    }
    ```
*   **Events**:
    *   `room-background-update`: Client updates background settings. Broadcasts change to room.
*   **Rendering Sequence**:
    1.  Clear canvas.
    2.  If `showBackground` and `backgroundImageUrl` exist, draw background image using `'aspect-fill'` scaling.
    3.  Draw grid overlay lines on top using semi-transparent color (e.g., `#1e293b80` / 50% opacity) so they remain visible.
    4.  Draw vector shapes and image elements.
