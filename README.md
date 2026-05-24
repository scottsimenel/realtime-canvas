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
*   **Canvas Elements**: Tracks vector shapes and image assets (URLs, widths, heights, X/Y coordinates, and rotation properties).
*   **Concurrency Locking (`locks`)**: Maps active element IDs to user socket IDs. When a user holds a mouse down on an element, a handle, or a rotation stem, they acquire an exclusive mutex lock. Other clients are blocked from modifying that element until released.
*   **Deletion**: Deletes the canvas element from the registry and releases any held lock when authorized.
*   **Cleanup**: Automatically releases all locks held by a user and deletes their cursor state when they disconnect.

### 2. High-DPI & Double-Buffer Canvas (`/client/src/components/Canvas.jsx`)
*   **Retina Display Support**: Utilizes `ResizeObserver` along with window `devicePixelRatio` to scale the canvas backing store, rendering crisp shapes, handles, and text regardless of device resolution.
*   **Interactive Transform Handles**: Renders selection bounding boxes, four corner scale handles, and a center-fixed rotation anchor stem.
*   **Rotated Coordinates Hit-Detection**: Translates click events to center-relative local coordinates and rotates them back by the negative element rotation angle $-\theta$. This performs accurate selection/drag bounds checking for elements at any angle.
*   **Render Loop**: Draws grid backgrounds, shapes, images (from an image loading cache to prevent flickering), selection frames, handles, active lock boundaries (styled with the locking user's color scheme), and live overlay cursor tags.

### 3. Throttled Delta Streaming
*   **Cursor Tracking**: Client-side pointer positions are tracked and throttled to a **30ms emission interval** over Socket.io. This minimizes payload overhead and network congestion while maintaining smooth cursor animations.
*   **Optimistic Rendering**: Transforms and coordinates of drag-and-drop actions are rendered locally in React state instantly for zero-latency feedback, then pushed asynchronously to the server to synchronize with peer clients.

---

## 📡 Socket.io Event API Reference

### Client $\rightarrow$ Server
*   `join-room`: Registers a user (`name`, `color`, `roomId`) and retrieves the current board snapshot.
*   `cursor-move`: Sends throttled cursor coordinates (`{ x, y }`).
*   `element-lock`: Requests an exclusive mutex lock on `{ elementId }` to start a drag, resize, or rotate action.
*   `element-unlock`: Releases the lock on `{ elementId }` upon mouse release.
*   `element-create`: Submits a newly spawned canvas `{ element }` schema.
*   `element-update`: Streams coordinates and dimensions `{ elementId, updates: { x, y, width, height, properties: { rotation } } }` during transforms.
*   `element-delete`: Request deletion of `{ elementId }` (checked against active locks).

### Server $\rightarrow$ Client
*   `user-joined`: Broadcasts new participant details to the room.
*   `user-left`: Broadcasts user departure and cleanups.
*   `cursor-update`: Updates a participant's cursor position.
*   `element-locked`: Notifies clients that an element is now locked.
*   `element-unlocked`: Notifies clients that a lock has been released.
*   `element-created`: Notifies clients of a new canvas element.
*   `element-updated`: Synchronizes element coordinates, dimensions, and rotation properties.
*   `element-deleted`: Notifies clients that an element has been removed from the canvas.

---

## 🚀 Operations: Spin Up Local Environments

Select the environment setup instructions relevant to your operating system:

---

### Option A: macOS Environment (with Apple Silicon support)

On macOS Monterey and newer, the system **AirPlay Receiver** service listens on port `5000` by default. To prevent `EADDRINUSE` conflicts, run the server on port `5001`.

#### 1. First-Time System Setup (if needed)
If Homebrew is installed but not in your terminal's search path (common on Apple Silicon M-series Macs), run:
```bash
# Add Homebrew to your shell environment
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

# Install Node.js & Cloudflared via Homebrew
brew install node
brew install cloudflared
```

#### 2. Starting the Backend Server (Port 5001)
Open a new terminal window:
```bash
cd server
npm install
PORT=5001 npm run dev
```
The server will start listening at **`http://localhost:5001`**. You can verify that it is online at `http://localhost:5001/health`.

#### 3. Starting the Frontend Client
Open a second terminal window:
```bash
cd client
npm install
npm run dev
```
The client will start on **`http://localhost:5173`**. Vite will automatically route WebSocket traffic to the server on port `5000` in dev mode unless configured otherwise. Note that for local development, you may want to disable the system AirPlay Receiver (System Settings -> General -> AirDrop & Handoff -> toggle off "AirPlay Receiver") to allow local connection over port 5000, or run the production bundle.

---

### Option B: Windows & Generic Environments

By default, the server runs on port `5000`, which is suitable for Windows or Linux out-of-the-box.

#### 1. Starting the Backend Server (Port 5000)
Open a new terminal window:
```bash
cd server
npm install
npm run dev
```
The server will start listening at **`http://localhost:5000`**.

#### 2. Starting the Frontend Client
Open a second terminal window:
```bash
cd client
npm install
npm run dev
```
The client will spin up at **`http://localhost:5173`**.

---

## 🧪 Testing Multi-User Collaboration
1. Open `http://localhost:5173` in a web browser window.
2. Enter your name, select a cursor color, and click **Enter Workspace**.
3. Open a second browser window (e.g., an Incognito/Private window) side-by-side.
4. Join the same Room ID using a different name and color.
5. Move your mouse in one window to see the colored cursor trail follow in real-time in the other.
6. Spawn objects using the left toolbar. Drag elements to watch lock indicators and coordinates synchronize instantly.

---

## 🌐 Production & Self-Hosting (Cloudflare Tunnels)

This application supports single-origin self-hosting. In production, the Express backend serves the compiled React client statically, allowing you to deploy the entire application under a single domain name using a Cloudflare Tunnel without opening two separate web services.

### 1. Build and Run in Production Mode

To compile the React frontend and run the unified server locally:

#### macOS (Port 5001):
```bash
# 1. Compile the React client assets
cd client
npm run build

# 2. Run the Node server on port 5001
cd ../server
PORT=5001 npm run start
```

#### Windows & Linux (Port 5000):
```bash
# 1. Compile the React client assets
cd client
npm run build

# 2. Run the Node server on port 5000
cd ../server
npm run start
```

---

### 2. Setting Up Cloudflare Tunnels (Zero Trust)

A Cloudflare Tunnel securely exposes your local server to the internet using Cloudflare's edge network.

#### Option A: Quick Tunnels (Free, No Domain or Account Required)
Use this option to temporarily share your local deployment with friends or test touch features on mobile devices:

1. Ensure `cloudflared` is installed.
2. Spin up the server in production mode.
3. Start the tunnel (Note: on macOS or networks with UDP restrictions, append `--protocol http2` to bypass QUIC UDP block issues):

   **macOS (Port 5001):**
   ```bash
   cloudflared tunnel --url http://localhost:5001 --protocol http2
   ```

   **Windows & Linux (Port 5000):**
   ```bash
   cloudflared tunnel --url http://localhost:5000
   ```

4. Copy the temporary `https://*.trycloudflare.com` URL printed in your terminal and share it.

#### Option B: Persistent Cloudflare Tunnel (Requires a Domain on Cloudflare)
To host the application permanently under a custom subdomain (e.g., `canvas.yourdomain.com`):
1. **Install cloudflared**:
   - **Windows**: `winget install Cloudflare.cloudflared`
   - **macOS**: `brew install cloudflared`
   - **Linux**: `sudo apt install cloudflared` (or download `.deb`/`.rpm`)
2. **Authenticate**:
   ```bash
   cloudflared tunnel login
   ```
3. **Create a Tunnel**:
   ```bash
   cloudflared tunnel create canvas-tunnel
   ```
4. **Configure the Tunnel**:
   Create a `config.yml` in your Cloudflare directory (e.g., `~/.cloudflared/config.yml` or `C:\Users\<User>\.cloudflared\config.yml`):
   ```yaml
   tunnel: <TUNNEL_ID>
   credentials-file: <PATH_TO_JSON_CREDENTIALS>
   # Use http2 protocol to prevent QUIC UDP block errors on restricted networks
   protocol: http2

   ingress:
     - hostname: canvas.yourdomain.com
       service: http://localhost:5001
     - service: http_status:404
   ```
   *(Note: Set the service port above to `http://localhost:5000` if hosting on Windows/Linux).*
5. **Route DNS**:
   ```bash
   cloudflared tunnel route dns canvas-tunnel canvas.yourdomain.com
   ```
6. **Run the Tunnel**:
   ```bash
   cloudflared tunnel run canvas-tunnel
   ```
   To run it permanently as a background service on your server, run `cloudflared service install`.

---

## 🗺️ Feature Roadmap & Planning

For details on planned features, implementation designs, and upcoming socket event schemas, see the project [ROADMAP.md](file:///C:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/ROADMAP.md).
