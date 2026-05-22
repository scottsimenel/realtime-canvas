# Antigravity Canvas: Real-Time Multi-User Collaborative Workspace

A modern, highly responsive real-time collaborative canvas built with a decoupled monorepo architecture. Users can join rooms, draw and drag shapes or image assets simultaneously, and see each other's mouse cursors with minimal latency. It includes a concurrency control system using selection locks to prevent update collisions.

---

## 📂 Directory & Code Structure

The project is structured as a decoupled monorepo:

```text
/realtime-canvas
  ├── .gitignore               # Root git ignore (prevents tracking node_modules & build folders)
  ├── .antigravityignore       # Root ignore config for development helpers
  ├── README.md                # This file (main developer documentation)
  │
  ├── /server                  # Backend Express + Socket.io Server (Port 5000)
  │     ├── package.json       # Backend configurations and scripts
  │     ├── server.js          # Core entry point (initializes Express, Socket.io, and event handling)
  │     └── registry.js        # Transactional state registry (handles users, elements, and locks)
  │
  └── /client                  # Frontend Vite + React + Tailwind CSS v4 Client (Port 5173)
        ├── package.json       # Frontend configuration & scripts
        ├── vite.config.js     # Vite configuration featuring Tailwind CSS v4 plugin
        ├── index.html         # Shell HTML page
        └── /src
              ├── main.jsx     # App mounting logic
              ├── index.css    # Global stylesheet importing Tailwind CSS v4 and custom scrollbars
              ├── App.jsx      # Canvas workspace dashboard (lobby, control panels, lists)
              └── /components
                    └── Canvas.jsx # High-DPI HTML5 Canvas component with Socket.io delta sync
```

---

## ⚙️ Core Technical Functions

### 1. In-Memory Transactional State Registry (`/server/registry.js`)
*   **Active Users**: Tracks user socket IDs, names, assigned cursor colors, and real-time cursor positions.
*   **Canvas Elements**: Tracks vector shapes (rectangles, circles) and image assets (URLs, widths, heights, X/Y coordinates).
*   **Concurrency Locking (`locks`)**: Maps active element IDs to user socket IDs. When a user holds a mouse button down on a shape, they acquire a lock. Other clients are blocked from moving or modifying that shape until it is unlocked.
*   **Cleanup**: Automatically releases all locks held by a user and deletes their cursor state when they disconnect.

### 2. High-DPI & Double-Buffer Canvas (`/client/src/components/Canvas.jsx`)
*   **Retina Display Support**: Utilizes `ResizeObserver` along with window `devicePixelRatio` to scale the canvas backing store, rendering crisp shapes and text regardless of device resolution.
*   **Render Loop**: Draws grid backgrounds, shapes, images (from an image loading cache to prevent flickering), active lock boundaries (styled with the locking user's color scheme), and live overlay cursor tags.

### 3. Throttled Delta Streaming
*   **Cursor Tracking**: Client-side pointer positions are tracked and throttled to a **30ms emission interval** over Socket.io. This minimizes payload overhead and network congestion while maintaining smooth cursor animations.
*   **Optimistic Rendering**: Coordinates of drag-and-drop actions are rendered locally in React state instantly for zero-latency feedback, then pushed asynchronously to the server to synchronize with peer clients.

---

## 📡 Socket.io Event API Reference

### Client $\rightarrow$ Server
*   `join-room`: Registers a user (`name`, `color`, `roomId`) and retrieves the current board snapshot.
*   `cursor-move`: Sends throttled cursor coordinates (`{ x, y }`).
*   `element-lock`: Requests an exclusive mutex lock on `{ elementId }` to start a drag action.
*   `element-unlock`: Releases the lock on `{ elementId }` upon mouse release.
*   `element-create`: Submits a newly spawned canvas `{ element }` schema.
*   `element-update`: Streams current coordinates `{ elementId, updates: { x, y } }` while dragging.

### Server $\rightarrow$ Client
*   `user-joined`: Broadcasts new participant details to the room.
*   `user-left`: Broadcasts user departure and cleanups.
*   `cursor-update`: Updates a participant's cursor position.
*   `element-locked`: Notifies clients that an element is now locked.
*   `element-unlocked`: Notifies clients that a lock has been released.
*   `element-created`: Notifies clients of a new canvas element.
*   `element-updated`: Synchronizes element coordinates and properties.

---

## 🚀 Operations: Spin Up Local Environments

To run both parts of the application, open **two separate terminal windows**:

### 1. Starting the Backend Server
```bash
# Navigate to the server folder
cd server

# Install dependencies (first-time setup only)
npm install

# Start in development mode (hot reloading via nodemon)
npm run dev
```
The server will start listening at **`http://localhost:5000`**. You can verify that it is online by visiting the health check endpoint: `http://localhost:5000/health`.

### 2. Starting the Frontend Client
```bash
# Navigate to the client folder
cd client

# Install dependencies (first-time setup only)
npm install

# Start Vite dev server
npm run dev
```
The client will spin up at **`http://localhost:5173`** (or another port if 5173 is occupied).

---

## 🧪 Testing Multi-User Collaboration
1. Open `http://localhost:5173` in a web browser window.
2. Enter your name, select a cursor color, and click **Enter Workspace**.
3. Open a second browser window (e.g., an Incognito/Private window) side-by-side.
4. Join the same Room ID using a different name and color.
5. Move your mouse in one window to see the colored cursor trail follow in real-time in the other.
6. Spawn objects using the left toolbar. Drag elements to watch lock indicators and coordinates synchronize instantly.

---

## 🗺️ Feature Roadmap & Planning

For details on planned features, implementation designs, and upcoming socket event schemas, see the project [ROADMAP.md](file:///C:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/ROADMAP.md).
