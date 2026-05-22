import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { CanvasRegistry } from './registry.js';

// Setup Express application
const app = express();
app.use(cors());
app.use(express.json());

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
        locks: state.locks
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
    const { elementId } = data || {};
    if (!elementId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Element ID is required' });
      return;
    }

    const success = registry.lockElement(elementId, socket.id);
    const room = socket.room || DEFAULT_ROOM;

    if (success) {
      console.log(`Element locked: ${elementId} by ${socket.id}`);
      // Notify others that the element is locked by this user
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
    const { elementId } = data || {};
    if (!elementId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Element ID is required' });
      return;
    }

    const success = registry.unlockElement(elementId, socket.id);
    const room = socket.room || DEFAULT_ROOM;

    if (success) {
      console.log(`Element unlocked: ${elementId} by ${socket.id}`);
      // Notify others that the lock has been released
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
    const { elementId, updates } = data || {};
    if (!elementId || !updates) {
      if (typeof callback === 'function') callback({ success: false, error: 'Missing parameters' });
      return;
    }

    const updatedElement = registry.updateElement(elementId, updates, socket.id);
    const room = socket.room || DEFAULT_ROOM;

    if (updatedElement) {
      // Broadcast the changes to all other clients in the room
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

    // Broadcast element creation to all users in the room (including creator for consistency check or simply io.to)
    // Here we broadcast to everyone so that they get the event. 
    // Usually, socket.to(room).emit is preferred if the creator already has it,
    // but io.to(room) is safer to keep everyone in sync. Let's broadcast to other clients in the room.
    socket.to(room).emit('element-created', {
      element: createdElement,
      userId: socket.id
    });

    if (typeof callback === 'function') {
      callback({ success: true, element: createdElement });
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
