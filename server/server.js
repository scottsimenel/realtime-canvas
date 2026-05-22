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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    
    res.status(200).json({
      success: true,
      url: fileUrl,
      filename: req.file.filename
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
        elements: state.elements,
        locks: state.locks,
        assets: state.assets || []
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
   * Handle element lock request when a user selects/drags an element.
   * Prevents multiple users from moving the same element simultaneously.
   */
  socket.on('element-lock', (data, callback) => {
    const { elementId, elementIds } = data || {};
    const room = socket.room || DEFAULT_ROOM;

    if (elementIds && Array.isArray(elementIds)) {
      const lockedIds = registry.lockElements(elementIds, socket.id);
      console.log(`Elements locked: [${lockedIds.join(', ')}] by ${socket.id}`);
      lockedIds.forEach((id) => {
        socket.to(room).emit('element-locked', { elementId: id, userId: socket.id });
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

    const success = registry.lockElement(elementId, socket.id);
    if (success) {
      console.log(`Element locked: ${elementId} by ${socket.id}`);
      socket.to(room).emit('element-locked', { elementId, userId: socket.id });
      if (typeof callback === 'function') callback({ success: true });
    } else {
      const currentHolder = registry.locks.get(elementId);
      console.log(`Element lock failed: ${elementId} is held by ${currentHolder}`);
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
    const { elementId, elementIds } = data || {};
    const room = socket.room || DEFAULT_ROOM;

    if (elementIds && Array.isArray(elementIds)) {
      const unlockedIds = registry.unlockElements(elementIds, socket.id);
      console.log(`Elements unlocked: [${unlockedIds.join(', ')}] by ${socket.id}`);
      unlockedIds.forEach((id) => {
        socket.to(room).emit('element-unlocked', { elementId: id, userId: socket.id });
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

    const success = registry.unlockElement(elementId, socket.id);
    if (success) {
      console.log(`Element unlocked: ${elementId} by ${socket.id}`);
      socket.to(room).emit('element-unlocked', { elementId, userId: socket.id });
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
    const { elementId, updates, batch } = data || {};
    const room = socket.room || DEFAULT_ROOM;

    if (batch && Array.isArray(batch)) {
      const updatedElements = registry.updateElements(batch, socket.id);
      if (updatedElements.length > 0) {
        // Broadcast batch updates to other clients
        socket.to(room).emit('element-updated-batch', {
          batch: batch.filter(item => updatedElements.some(el => el.id === item.elementId)),
          userId: socket.id
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

    const updatedElement = registry.updateElement(elementId, updates, socket.id);
    if (updatedElement) {
      socket.to(room).emit('element-updated', {
        elementId,
        updates,
        userId: socket.id
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
    const { element } = data || {};
    if (!element || !element.id || !element.type) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid element schema' });
      return;
    }

    const createdElement = registry.createElement(element);
    const room = socket.room || DEFAULT_ROOM;

    socket.to(room).emit('element-created', {
      element: createdElement,
      userId: socket.id
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
    const { elementId, elementIds } = data || {};
    const room = socket.room || DEFAULT_ROOM;

    if (elementIds && Array.isArray(elementIds)) {
      const deletedIds = registry.deleteElements(elementIds, socket.id);
      console.log(`Elements deleted: [${deletedIds.join(', ')}] by ${socket.id}`);
      deletedIds.forEach((id) => {
        socket.to(room).emit('element-deleted', { elementId: id, userId: socket.id });
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

    const success = registry.deleteElement(elementId, socket.id);
    if (success) {
      console.log(`Element deleted: ${elementId} by ${socket.id}`);
      socket.to(room).emit('element-deleted', { elementId, userId: socket.id });
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
    const { orderedIds } = data || {};
    if (!orderedIds || !Array.isArray(orderedIds)) {
      if (typeof callback === 'function') callback({ success: false, error: 'orderedIds array is required' });
      return;
    }

    const room = socket.room || DEFAULT_ROOM;
    const finalOrderedIds = registry.reorderElements(orderedIds);

    // Broadcast the new order to all other clients in the room
    socket.to(room).emit('elements-reordered', { orderedIds: finalOrderedIds });

    if (typeof callback === 'function') {
      callback({ success: true, orderedIds: finalOrderedIds });
    }
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
    releasedLocks.forEach((elementId) => {
      socket.to(room).emit('element-unlocked', {
        elementId,
        userId: socket.id
      });
    });
  });
});

// Run server on configured port
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Real-time Canvas server running on http://localhost:${PORT}`);
});
