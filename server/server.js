import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { CanvasRegistry, sanitizeRoomId } from './registry.js';
import { RoomManager } from './roomManager.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { registerConnectionHandlers } from './handlers/connectionHandler.js';
import { registerElementHandlers } from './handlers/elementHandler.js';
import { registerTabHandlers } from './handlers/tabHandler.js';
import { registerDiceHandlers } from './handlers/diceHandler.js';
import { registerSaveHandlers } from './handlers/saveHandler.js';

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

// Configure Multer storage to organize uploads into per-room subdirectories
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const rawRoom = req.query.roomId || req.body?.roomId || 'canvas-default';
    const safeRoom = sanitizeRoomId(rawRoom);
    const roomUploadsDir = path.join(uploadsDir, safeRoom);
    if (!fs.existsSync(roomUploadsDir)) {
      fs.mkdirSync(roomUploadsDir, { recursive: true });
    }
    cb(null, roomUploadsDir);
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

// Custom file upload endpoint (scoped per roomId)
app.post('/api/upload', upload.array('image', 50), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }
    const rawRoom = req.query.roomId || req.body?.roomId || 'canvas-default';
    const safeRoom = sanitizeRoomId(rawRoom);
    const filesData = req.files.map(file => ({
      url: `/uploads/${safeRoom}/${file.filename}`,
      filename: file.filename,
      originalname: file.originalname,
      roomId: safeRoom
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

// REST endpoint to list all available rooms (both active and saved)
app.get('/api/rooms', (req, res) => {
  try {
    const rooms = roomManager.listRooms();
    res.status(200).json({ success: true, rooms });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
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

// Initialize RoomManager for multi-room canvas isolation
const roomManager = new RoomManager();

// Set up periodic background autosave (every 2 minutes) across all active rooms
setInterval(() => {
  try {
    const savedCount = roomManager.autosaveAllRooms();
    if (savedCount > 0) {
      console.log(`Periodic background autosave completed for ${savedCount} active room(s).`);
    }
  } catch (err) {
    console.error('Periodic background autosave failed:', err);
  }
}, 2 * 60 * 1000);

/**
 * Socket.io connection and event handling.
 */
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Register modular handlers bound to roomManager
  registerConnectionHandlers(io, socket, roomManager);
  registerElementHandlers(io, socket, roomManager);
  registerTabHandlers(io, socket, roomManager);
  registerDiceHandlers(io, socket, roomManager);
  registerSaveHandlers(io, socket, roomManager);
});

// Run server on configured port
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Real-time Canvas server running on http://localhost:${PORT}`);
});
