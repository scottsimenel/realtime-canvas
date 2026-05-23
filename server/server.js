import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { CanvasRegistry } from './registry.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Setup Express application
const app = express();
app.use(cors());
app.use(express.json());

// Serve uploaded images statically
app.use('/uploads', express.static(uploadsDir));

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp to prevent name collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WEBP) are allowed!'));
  }
});

// Custom file upload endpoint
app.post('/api/upload', upload.array('image', 50), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }
    const filesData = req.files.map(file => ({
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      originalname: file.originalname
    }));
    
    res.status(200).json({
      success: true,
      files: filesData
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Handle upload errors (like file size limit exceeded)
app.use('/api/upload', (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File size limit exceeded (max 5MB)' });
    }
    return res.status(400).json({ success: false, error: err.message });
  } else if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
});

// Add basic HTTP health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve React frontend static files in production if the build directory exists
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    // Avoid intercepting API, uploads, health check, or socket.io routes
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/uploads') ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/socket.io')
    ) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
  console.log(`Serving static client files from: ${clientDistPath}`);
} else {
  console.log(`Client dist directory not found at: ${clientDistPath}. Running in API-only server mode.`);
}


// Setup HTTP server and Socket.io
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for development and ease of testing
    methods: ['GET', 'POST']
  }
});

// Initialize global in-memory canvas registry
const registry = new CanvasRegistry();
const DEFAULT_ROOM = 'canvas-default';

/**
 * Socket.io connection and event handling.
 */
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  /**
   * Handle user joining a room.
   * Registers user, returns current canvas state, and notifies other users.
   */
  socket.on('join-room', (data, callback) => {
    const { name, color, roomId } = data || {};
    const room = roomId || DEFAULT_ROOM;

    // Join the specified room
    socket.join(room);
    socket.room = room; // Store room reference on the socket

    // Register user in our state registry
    const state = registry.joinRoom(socket.id, name, color);
    const currentUser = state.users.find(u => u.id === socket.id);

    console.log(`User ${currentUser.name} (${socket.id}) joined room: ${room}`);

    // Reply with initial room snapshot to the joining user
    if (typeof callback === 'function') {
      callback({
        success: true,
        users: state.users,
        assets: state.assets || [],
        tabs: state.tabs,
        activeTabId: state.activeTabId
      });
    }

    // Broadcast user joined notification to everyone else in the room
    socket.to(room).emit('user-joined', currentUser);
  });

  /**
   * Handle real-time cursor movements.
   * Updates user position and broadcasts it to other users in the room.
   */
  socket.on('cursor-move', (data) => {
    const { x, y } = data || {};
    if (typeof x !== 'number' || typeof y !== 'number') return;

    const user = registry.updateCursor(socket.id, x, y);
    if (user) {
      const room = socket.room || DEFAULT_ROOM;
      // Broadcast cursor updates efficiently (excluding the sender)
      socket.to(room).emit('cursor-update', {
        userId: socket.id,
        x: user.x,
        y: user.y
      });
    }
  });

  /**
   * Handle tab creation.
   */
  socket.on('tab-create', (data, callback) => {
    const { tabId, name } = data || {};
    if (!tabId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Tab ID is required' });
      return;
    }
    const newTab = registry.createTab(tabId, name);
    const room = socket.room || DEFAULT_ROOM;
    // Broadcast tab creation to other clients
    socket.to(room).emit('tab-created', { tab: newTab });
    if (typeof callback === 'function') {
      callback({ success: true, tab: newTab });
    }
  });

  /**
   * Handle tab deletion.
   */
  socket.on('tab-delete', (data, callback) => {
    const { tabId } = data || {};
    if (!tabId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Tab ID is required' });
      return;
    }
    const result = registry.deleteTab(tabId);
    if (result.success) {
      const room = socket.room || DEFAULT_ROOM;
      // Broadcast deletion to all other clients, including new user assignments and fallback tab
      socket.to(room).emit('tab-deleted', {
        tabId,
        fallbackTabId: result.fallbackTabId,
        users: result.users
      });
      if (typeof callback === 'function') {
        callback({
          success: true,
          fallbackTabId: result.fallbackTabId,
          users: result.users
        });
      }
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'Cannot delete tab' });
    }
  });

  /**
   * Handle tab renaming.
   */
  socket.on('tab-rename', (data, callback) => {
    const { tabId, name } = data || {};
    if (!tabId || !name) {
      if (typeof callback === 'function') callback({ success: false, error: 'Tab ID and Name are required' });
      return;
    }
    const success = registry.renameTab(tabId, name);
    if (success) {
      const room = socket.room || DEFAULT_ROOM;
      socket.to(room).emit('tab-renamed', { tabId, name });
      if (typeof callback === 'function') callback({ success: true });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'Tab not found' });
    }
  });

  /**
   * Handle user tab switching.
   */
  socket.on('tab-switch', (data, callback) => {
    const { tabId } = data || {};
    if (!tabId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Tab ID is required' });
      return;
    }
    const user = registry.switchUserTab(socket.id, tabId);
    if (user) {
      const room = socket.room || DEFAULT_ROOM;
      // Broadcast that user switched tab
      socket.to(room).emit('tab-switched', { userId: socket.id, tabId });
      if (typeof callback === 'function') callback({ success: true, user });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'User or tab not found' });
    }
  });

  /**
   * Handle element lock request when a user selects/drags an element.
   * Prevents multiple users from moving the same element simultaneously.
   */
  socket.on('element-lock', (data, callback) => {
    const { elementId, elementIds, tabId } = data || {};
    const room = socket.room || DEFAULT_ROOM;
    const targetTabId = tabId || 'tab-default';

    if (elementIds && Array.isArray(elementIds)) {
      const lockedIds = registry.lockElements(targetTabId, elementIds, socket.id);
      console.log(`Elements locked: [${lockedIds.join(', ')}] by ${socket.id} in tab ${targetTabId}`);
      lockedIds.forEach((id) => {
        socket.to(room).emit('element-locked', { elementId: id, userId: socket.id, tabId: targetTabId });
      });
      if (typeof callback === 'function') {
        callback({ success: lockedIds.length > 0, lockedIds });
      }
      return;
    }

    if (!elementId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Element ID is required' });
      return;
    }

    const success = registry.lockElement(targetTabId, elementId, socket.id);
    if (success) {
      console.log(`Element locked: ${elementId} by ${socket.id} in tab ${targetTabId}`);
      socket.to(room).emit('element-locked', { elementId, userId: socket.id, tabId: targetTabId });
      if (typeof callback === 'function') callback({ success: true });
    } else {
      const tab = registry.tabs.get(targetTabId);
      const currentHolder = tab ? tab.locks.get(elementId) : null;
      console.log(`Element lock failed: ${elementId} is held by ${currentHolder} in tab ${targetTabId}`);
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: 'Element is locked by another user',
          lockedBy: currentHolder
        });
      }
    }
  });

  /**
   * Handle element unlock request when a user deselects or stops dragging an element.
   */
  socket.on('element-unlock', (data, callback) => {
    const { elementId, elementIds, tabId } = data || {};
    const room = socket.room || DEFAULT_ROOM;
    const targetTabId = tabId || 'tab-default';

    if (elementIds && Array.isArray(elementIds)) {
      const unlockedIds = registry.unlockElements(targetTabId, elementIds, socket.id);
      console.log(`Elements unlocked: [${unlockedIds.join(', ')}] by ${socket.id} in tab ${targetTabId}`);
      unlockedIds.forEach((id) => {
        socket.to(room).emit('element-unlocked', { elementId: id, userId: socket.id, tabId: targetTabId });
      });
      if (typeof callback === 'function') {
        callback({ success: unlockedIds.length > 0, unlockedIds });
      }
      return;
    }

    if (!elementId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Element ID is required' });
      return;
    }

    const success = registry.unlockElement(targetTabId, elementId, socket.id);
    if (success) {
      console.log(`Element unlocked: ${elementId} by ${socket.id} in tab ${targetTabId}`);
      socket.to(room).emit('element-unlocked', { elementId, userId: socket.id, tabId: targetTabId });
      if (typeof callback === 'function') callback({ success: true });
    } else {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'You do not hold the lock for this element' });
      }
    }
  });

  /**
   * Handle updating properties of a canvas element (position, size, styling).
   * Verifies locks before applying updates and broadcasts changes.
   */
  socket.on('element-update', (data, callback) => {
    const { elementId, updates, batch, tabId } = data || {};
    const room = socket.room || DEFAULT_ROOM;
    const targetTabId = tabId || 'tab-default';

    if (batch && Array.isArray(batch)) {
      const updatedElements = registry.updateElements(targetTabId, batch, socket.id);
      if (updatedElements.length > 0) {
        // Broadcast batch updates to other clients
        socket.to(room).emit('element-updated-batch', {
          batch: batch.filter(item => updatedElements.some(el => el.id === item.elementId)),
          userId: socket.id,
          tabId: targetTabId
        });
      }
      if (typeof callback === 'function') {
        callback({ success: updatedElements.length > 0, elements: updatedElements });
      }
      return;
    }

    if (!elementId || !updates) {
      if (typeof callback === 'function') callback({ success: false, error: 'Missing parameters' });
      return;
    }

    const updatedElement = registry.updateElement(targetTabId, elementId, updates, socket.id);
    if (updatedElement) {
      socket.to(room).emit('element-updated', {
        elementId,
        updates,
        userId: socket.id,
        tabId: targetTabId
      });

      if (typeof callback === 'function') {
        callback({ success: true, element: updatedElement });
      }
    } else {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Update denied: Element locked by another user or not found' });
      }
    }
  });

  /**
   * Handle creation of a new canvas element.
   * Saves it to the registry and broadcasts creation to all room members.
   */
  socket.on('element-create', (data, callback) => {
    const { element, tabId } = data || {};
    const targetTabId = tabId || 'tab-default';
    if (!element || !element.id || !element.type) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid element schema' });
      return;
    }

    const createdElement = registry.createElement(targetTabId, element);
    if (!createdElement) {
      if (typeof callback === 'function') callback({ success: false, error: 'Failed to create element' });
      return;
    }
    const room = socket.room || DEFAULT_ROOM;

    socket.to(room).emit('element-created', {
      element: createdElement,
      userId: socket.id,
      tabId: targetTabId
    });

    if (typeof callback === 'function') {
      callback({ success: true, element: createdElement });
    }
  });

  /**
   * Handle registration of a new custom image asset.
   * Saves it to the registry and broadcasts it to all room members.
   */
  socket.on('asset-create', (data, callback) => {
    const { asset } = data || {};
    if (!asset || !asset.id || !asset.url) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid asset schema' });
      return;
    }

    const createdAsset = registry.createAsset(asset);
    const room = socket.room || DEFAULT_ROOM;

    // Broadcast newly created asset to other clients in the room
    socket.to(room).emit('asset-created', {
      asset: createdAsset,
      userId: socket.id
    });

    if (typeof callback === 'function') {
      callback({ success: true, asset: createdAsset });
    }
  });

  /**
   * Handle deletion of an element.
   */
  socket.on('element-delete', (data, callback) => {
    const { elementId, elementIds, tabId } = data || {};
    const room = socket.room || DEFAULT_ROOM;
    const targetTabId = tabId || 'tab-default';

    if (elementIds && Array.isArray(elementIds)) {
      const deletedIds = registry.deleteElements(targetTabId, elementIds, socket.id);
      console.log(`Elements deleted: [${deletedIds.join(', ')}] by ${socket.id} in tab ${targetTabId}`);
      deletedIds.forEach((id) => {
        socket.to(room).emit('element-deleted', { elementId: id, userId: socket.id, tabId: targetTabId });
      });
      if (typeof callback === 'function') {
        callback({ success: deletedIds.length > 0, deletedIds });
      }
      return;
    }

    if (!elementId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Element ID is required' });
      return;
    }

    const success = registry.deleteElement(targetTabId, elementId, socket.id);
    if (success) {
      console.log(`Element deleted: ${elementId} by ${socket.id} in tab ${targetTabId}`);
      socket.to(room).emit('element-deleted', { elementId, userId: socket.id, tabId: targetTabId });
      if (typeof callback === 'function') callback({ success: true });
    } else {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Delete denied: Element locked by another user or not found' });
      }
    }
  });

  /**
   * Handle reordering of elements.
   */
  socket.on('elements-reorder', (data, callback) => {
    const { orderedIds, tabId } = data || {};
    const targetTabId = tabId || 'tab-default';
    if (!orderedIds || !Array.isArray(orderedIds)) {
      if (typeof callback === 'function') callback({ success: false, error: 'orderedIds array is required' });
      return;
    }

    const room = socket.room || DEFAULT_ROOM;
    const finalOrderedIds = registry.reorderElements(targetTabId, orderedIds);

    // Broadcast the new order to all other clients in the room
    socket.to(room).emit('elements-reordered', { orderedIds: finalOrderedIds, tabId: targetTabId });

    if (typeof callback === 'function') {
      callback({ success: true, orderedIds: finalOrderedIds });
    }
  });

  /**
   * Handle room settings update request (background and grid).
   */
  socket.on('room-settings-update', (data, callback) => {
    const { updates, tabId } = data || {};
    const targetTabId = tabId || 'tab-default';
    const room = socket.room || DEFAULT_ROOM;
    const updatedSettings = registry.updateRoomSettings(targetTabId, updates || {});

    if (!updatedSettings) {
      if (typeof callback === 'function') callback({ success: false, error: 'Tab not found' });
      return;
    }

    // Broadcast updated settings to everyone else in the room
    socket.to(room).emit('room-settings-updated', { roomSettings: updatedSettings, tabId: targetTabId });

    if (typeof callback === 'function') {
      callback({ success: true, roomSettings: updatedSettings });
    }
  });

  /**
   * Handle collaborative dice rolling.
   * Generates random values and advantage/disadvantage results, then broadcasts.
   */
  socket.on('dice-roll', (data) => {
    const { count, type, mode } = data || {};
    const room = socket.room || DEFAULT_ROOM;

    // Validate inputs
    const safeCount = Math.max(1, Math.min(20, parseInt(count, 10) || 1));
    const safeType = [4, 6, 8, 10, 12, 20, 100].includes(parseInt(type, 10)) ? parseInt(type, 10) : 6;
    const safeMode = ['normal', 'advantage', 'disadvantage'].includes(mode) ? mode : 'normal';

    const user = registry.users.get(socket.id);
    if (!user) return;

    const rollDie = (sides) => Math.floor(Math.random() * sides) + 1;
    const rollId = `roll_${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    const timestamp = new Date().toISOString();

    let rollResult = {};

    if (safeType === 20) {
      // Advantage/disadvantage evaluated per-die for d20
      const rolls = [];
      for (let i = 0; i < safeCount; i++) {
        const r1 = rollDie(20);
        const r2 = rollDie(20);
        let kept, discarded;

        if (safeMode === 'advantage') {
          kept = Math.max(r1, r2);
          discarded = Math.min(r1, r2);
        } else if (safeMode === 'disadvantage') {
          kept = Math.min(r1, r2);
          discarded = Math.max(r1, r2);
        } else {
          kept = r1;
          discarded = null;
        }

        rolls.push({
          roll1: r1,
          roll2: safeMode !== 'normal' ? r2 : null,
          kept,
          discarded
        });
      }
      rollResult = { rolls };
    } else {
      // For non-d20, advantage/disadvantage rolls two full sets of N dice and keeps the higher/lower sum
      if (safeMode === 'normal') {
        const rolls = Array.from({ length: safeCount }, () => rollDie(safeType));
        const sum = rolls.reduce((a, b) => a + b, 0);
        rollResult = { rolls, sum };
      } else {
        const rollsA = Array.from({ length: safeCount }, () => rollDie(safeType));
        const rollsB = Array.from({ length: safeCount }, () => rollDie(safeType));
        const sumA = rollsA.reduce((a, b) => a + b, 0);
        const sumB = rollsB.reduce((a, b) => a + b, 0);

        let kept, discarded, keptRolls, discardedRolls, keptSum, discardedSum;
        if (safeMode === 'advantage') {
          if (sumA >= sumB) {
            kept = 'A'; keptRolls = rollsA; keptSum = sumA;
            discarded = 'B'; discardedRolls = rollsB; discardedSum = sumB;
          } else {
            kept = 'B'; keptRolls = rollsB; keptSum = sumB;
            discarded = 'A'; discardedRolls = rollsA; discardedSum = sumA;
          }
        } else {
          if (sumA <= sumB) {
            kept = 'A'; keptRolls = rollsA; keptSum = sumA;
            discarded = 'B'; discardedRolls = rollsB; discardedSum = sumB;
          } else {
            kept = 'B'; keptRolls = rollsB; keptSum = sumB;
            discarded = 'A'; discardedRolls = rollsA; discardedSum = sumA;
          }
        }

        rollResult = {
          rolls: keptRolls,
          sum: keptSum,
          discardedRolls,
          discardedSum,
          kept
        };
      }
    }

    const payload = {
      rollId,
      timestamp,
      userId: socket.id,
      userName: user.name,
      userColor: user.color,
      count: safeCount,
      type: safeType,
      mode: safeMode,
      result: rollResult
    };

    io.to(room).emit('dice-rolled', payload);
  });

  /**
   * Handle user disconnection.
   * Clean up registry entries (user cursor and held locks) and notify other clients.
   */
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const room = socket.room || DEFAULT_ROOM;

    // Remove user and release locks
    const { releasedLocks } = registry.disconnectUser(socket.id);

    // Broadcast to room that the user left
    socket.to(room).emit('user-left', { userId: socket.id });

    // Notify other users of released locks
    releasedLocks.forEach(({ tabId, elementId }) => {
      socket.to(room).emit('element-unlocked', {
        elementId,
        userId: socket.id,
        tabId
      });
    });
  });
});

// Run server on configured port
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Real-time Canvas server running on http://localhost:${PORT}`);
});
