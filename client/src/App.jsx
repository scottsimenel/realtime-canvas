import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import Canvas from './components/Canvas';

const SOCKET_URL = 'http://localhost:5000';

const RANDOM_NAMES = [
  'Creative Fox',
  'Swift Eagle',
  'Artistic Panther',
  'Curious Dolphin',
  'Design Koala',
  'Dynamic Tiger',
  'Smart Owl',
  'Bright Cheetah',
];

const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
];

const SAMPLE_IMAGES = [
  {
    name: 'Neon Waves',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=60',
  },
  {
    name: 'Abstract Glass',
    url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=400&auto=format&fit=crop&q=60',
  },
  {
    name: 'Deep Space',
    url: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=400&auto=format&fit=crop&q=60',
  },
  {
    name: 'Cyberpunk Grid',
    url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&auto=format&fit=crop&q=60',
  },
];

export default function App() {
  // Connection states
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const socketRef = useRef(null);

  // Setup refs for socket event handlers to access latest state
  const nameRef = useRef('');
  const colorRef = useRef('');
  const roomIdRef = useRef('');
  const joinedRef = useRef(false);

  // Lobby Inputs (lazy initialized to avoid setState in effect warnings)
  const [nameInput, setNameInput] = useState(() => {
    return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  });
  const [colorInput, setColorInput] = useState(() => {
    return PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
  });
  const [roomIdInput, setRoomIdInput] = useState('canvas-default');

  // Shared board state
  const [users, setUsers] = useState([]);
  const [elements, setElements] = useState([]);
  const [locks, setLocks] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedElementIds, setSelectedElementIds] = useState([]);

  // Local states for Transform Inspector inputs to enable smooth multi-selection editing
  const [inputWidth, setInputWidth] = useState('');
  const [inputHeight, setInputHeight] = useState('');
  const [inputRotation, setInputRotation] = useState('');

  const [isWidthFocused, setIsWidthFocused] = useState(false);
  const [isHeightFocused, setIsHeightFocused] = useState(false);
  const [isRotationFocused, setIsRotationFocused] = useState(false);

  // States for collaborative drawing tool (Feature 1)
  const [activeTool, setActiveTool] = useState('select'); // 'select', 'pen', 'eraser'
  const [penColor, setPenColor] = useState('#3b82f6');
  const [penSize, setPenSize] = useState(4);

  // Upload states (Feature 3)
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Custom Image Assets (Feature 3.5)
  const [assets, setAssets] = useState([]);
  const [isImageSectionCollapsed, setIsImageSectionCollapsed] = useState(false);
  const [hiddenAssetUrls, setHiddenAssetUrls] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('canvas_hidden_assets') || '[]');
    } catch {
      return [];
    }
  });
  const [showHiddenMode, setShowHiddenMode] = useState(false);

  useEffect(() => {
    localStorage.setItem('canvas_hidden_assets', JSON.stringify(hiddenAssetUrls));
  }, [hiddenAssetUrls]);

  const allImageAssets = [
    ...SAMPLE_IMAGES.map((img, index) => ({ id: `preset_${index}`, name: img.name, url: img.url, isPreset: true })),
    ...assets.map(asset => ({ id: asset.id, name: asset.name, url: asset.url, isPreset: false }))
  ];

  const visibleAssets = allImageAssets.filter(asset => !hiddenAssetUrls.includes(asset.url));
  const hiddenAssets = allImageAssets.filter(asset => hiddenAssetUrls.includes(asset.url));

  const toggleHideAsset = useCallback((url) => {
    setHiddenAssetUrls(prev => {
      const next = prev.includes(url)
        ? prev.filter(u => u !== url)
        : [...prev, url];
      
      if (next.length === 0) {
        setShowHiddenMode(false);
      }
      return next;
    });
  }, []);

  // Sync state during rendering to avoid useEffect cascading renders
  const [prevSelectedElementIds, setPrevSelectedElementIds] = useState([]);
  const [prevElements, setPrevElements] = useState([]);

  if (prevSelectedElementIds !== selectedElementIds || prevElements !== elements) {
    setPrevSelectedElementIds(selectedElementIds);
    setPrevElements(elements);

    if (selectedElementIds.length === 0) {
      setInputWidth('');
      setInputHeight('');
      setInputRotation('');
    } else {
      const selectedElements = elements.filter((el) => selectedElementIds.includes(el.id));
      if (selectedElements.length > 0) {
        if (!isWidthFocused) {
          const firstWidth = selectedElements[0].width;
          const allSameWidth = selectedElements.every((el) => el.width === firstWidth);
          setInputWidth(allSameWidth ? String(firstWidth) : '');
        }
        if (!isHeightFocused) {
          const firstHeight = selectedElements[0].height;
          const allSameHeight = selectedElements.every((el) => el.height === firstHeight);
          setInputHeight(allSameHeight ? String(firstHeight) : '');
        }
        if (!isRotationFocused) {
          const firstRot = selectedElements[0].properties?.rotation || 0;
          const deg = Math.round((firstRot * 180) / Math.PI) % 360;
          const normalizedDeg = deg < 0 ? deg + 360 : deg;
          const allSameRot = selectedElements.every((el) => {
            const r = el.properties?.rotation || 0;
            const d = Math.round((r * 180) / Math.PI) % 360;
            const nd = d < 0 ? d + 360 : d;
            return nd === normalizedDeg;
          });
          setInputRotation(allSameRot ? String(normalizedDeg) : '');
        }
      }
    }
  }

  // Update refs when inputs or connection state changes
  useEffect(() => {
    nameRef.current = nameInput;
    colorRef.current = colorInput;
    roomIdRef.current = roomIdInput;
    joinedRef.current = joined;
  }, [nameInput, colorInput, roomIdInput, joined]);

  // Connect socket and register general listeners
  useEffect(() => {
    const s = io(SOCKET_URL, {
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = s;

    s.on('connect', () => {
      setConnected(true);
      // Auto re-join room if already joined prior to disconnect
      if (joinedRef.current) {
        s.emit(
          'join-room',
          {
            name: nameRef.current,
            color: colorRef.current,
            roomId: roomIdRef.current,
          },
          (res) => {
            if (res && res.success) {
              setElements(res.elements || []);
              const lockMap = {};
              (res.locks || []).forEach(([eId, uId]) => {
                lockMap[eId] = uId;
              });
              setLocks(lockMap);
              setUsers(res.users || []);
              setAssets(res.assets || []);
              setCurrentUser({
                id: s.id,
                name: nameRef.current,
                color: colorRef.current,
              });
            }
          }
        );
      }
    });

    s.on('disconnect', () => {
      setConnected(false);
    });

    s.on('user-joined', (user) => {
      setUsers((prev) => [...prev.filter((u) => u.id !== user.id), user]);
    });

    s.on('user-left', ({ userId }) => {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setLocks((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (next[key] === userId) {
            delete next[key];
          }
        });
        return next;
      });
    });

    s.on('cursor-update', ({ userId, x, y }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, x, y } : u))
      );
    });

    s.on('element-locked', ({ elementId, userId }) => {
      setLocks((prev) => ({ ...prev, [elementId]: userId }));
    });

    s.on('element-unlocked', ({ elementId }) => {
      setLocks((prev) => {
        const next = { ...prev };
        delete next[elementId];
        return next;
      });
    });

    s.on('element-updated', ({ elementId, updates }) => {
      setElements((prev) =>
        prev.map((el) => {
          if (el.id === elementId) {
            return {
              ...el,
              ...updates,
              properties: {
                ...(el.properties || {}),
                ...(updates.properties || {}),
              },
            };
          }
          return el;
        })
      );
    });

    s.on('element-updated-batch', ({ batch }) => {
      setElements((prev) =>
        prev.map((el) => {
          const match = batch.find((item) => item.elementId === el.id);
          if (match) {
            return {
              ...el,
              ...match.updates,
              properties: {
                ...(el.properties || {}),
                ...(match.updates.properties || {}),
              },
            };
          }
          return el;
        })
      );
    });

    s.on('element-created', ({ element }) => {
      setElements((prev) => [...prev.filter((el) => el.id !== element.id), element]);
    });

    s.on('element-deleted', ({ elementId }) => {
      setElements((prev) => prev.filter((el) => el.id !== elementId));
      setSelectedElementIds((prev) => prev.filter((id) => id !== elementId));
    });

    s.on('asset-created', ({ asset }) => {
      setAssets((prev) => [...prev.filter((a) => a.id !== asset.id), asset]);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  const handleJoin = useCallback(
    (e) => {
      e.preventDefault();
      if (!nameInput.trim()) return;

      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit(
          'join-room',
          {
            name: nameInput,
            color: colorInput,
            roomId: roomIdInput,
          },
          (res) => {
            if (res && res.success) {
              setElements(res.elements || []);
              const lockMap = {};
              (res.locks || []).forEach(([eId, uId]) => {
                lockMap[eId] = uId;
              });
              setLocks(lockMap);
              setUsers(res.users || []);
              setAssets(res.assets || []);
              setCurrentUser({
                id: socket.id,
                name: nameInput,
                color: colorInput,
              });
              setJoined(true);
            } else {
              alert('Failed to join room.');
            }
          }
        );
      } else {
        alert('Socket server not connected. Please check if backend is running.');
      }
    },
    [nameInput, colorInput, roomIdInput]
  );

  const handleSpawnShape = useCallback(
    (type, fill, stroke) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return;

      const id = `el_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const element = {
        id,
        type,
        x: Math.floor(Math.random() * 200) + 120,
        y: Math.floor(Math.random() * 200) + 120,
        width: type === 'circle' ? 100 : 120,
        height: 100,
        properties: {
          fill,
          stroke,
          strokeWidth: 2,
        },
      };

      // Optimistically update locally
      setElements((prev) => [...prev, element]);

      socket.emit('element-create', { element }, (response) => {
        if (!response || !response.success) {
          // Rollback
          setElements((prev) => prev.filter((el) => el.id !== id));
          console.error('Failed to create shape element:', response?.error);
        }
      });
    },
    []
  );

  const handleSpawnImage = useCallback(
    (url) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return;

      const id = `el_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const element = {
        id,
        type: 'image',
        x: Math.floor(Math.random() * 200) + 120,
        y: Math.floor(Math.random() * 200) + 120,
        width: 160,
        height: 110,
        properties: {
          url,
        },
      };

      // Optimistically update locally
      setElements((prev) => [...prev, element]);

      socket.emit('element-create', { element }, (response) => {
        if (!response || !response.success) {
          // Rollback
          setElements((prev) => prev.filter((el) => el.id !== id));
          console.error('Failed to create image element:', response?.error);
        }
      });
    },
    []
  );

  const handleImageUpload = useCallback(
    async (file) => {
      if (!file) return;

      // Basic client-side validation
      if (!file.type.startsWith('image/')) {
        setUploadError('Selected file is not a valid image.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('Image size exceeds 5MB limit.');
        return;
      }

      setIsUploading(true);
      setUploadError('');

      const formData = new FormData();
      formData.append('image', file);

      try {
        const response = await fetch(`${SOCKET_URL}/api/upload`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (data.success) {
          const assetId = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const assetName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const newAsset = { id: assetId, name: assetName, url: data.url };
          
          const socket = socketRef.current;
          if (socket && socket.connected) {
            socket.emit('asset-create', { asset: newAsset }, (res) => {
              if (res && res.success) {
                setAssets((prev) => [...prev.filter((a) => a.id !== res.asset.id), res.asset]);
              }
            });
          } else {
            setAssets((prev) => [...prev, newAsset]);
          }
          handleSpawnImage(data.url);
        } else {
          setUploadError(data.error || 'Failed to upload image.');
        }
      } catch (err) {
        console.error('Error uploading image:', err);
        setUploadError('Server connection error.');
      } finally {
        setIsUploading(false);
      }
    },
    [handleSpawnImage]
  );

  const inspectorLockRef = useRef(false);

  const handleStartInspectorTransform = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const unlockedIds = selectedElementIds.filter((id) => {
      const lockHolderId = locks[id];
      return !lockHolderId || lockHolderId === currentUser?.id;
    });

    if (unlockedIds.length === 0) return;

    socket.emit('element-lock', { elementIds: unlockedIds }, (res) => {
      if (res && res.success) {
        inspectorLockRef.current = true;
        setLocks((prev) => {
          const next = { ...prev };
          unlockedIds.forEach((id) => {
            next[id] = currentUser.id;
          });
          return next;
        });
      }
    });
  }, [selectedElementIds, locks, currentUser]);

  const handleEndInspectorTransform = useCallback(() => {
    if (!inspectorLockRef.current) return;
    const socket = socketRef.current;
    if (socket && socket.connected) {
      const activeIds = selectedElementIds.filter((id) => locks[id] === currentUser?.id);
      socket.emit('element-unlock', { elementIds: activeIds });
      setLocks((prev) => {
        const next = { ...prev };
        activeIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
    }
    inspectorLockRef.current = false;
  }, [selectedElementIds, locks, currentUser]);

  const handleInspectorChange = useCallback(
    (updatesMap) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return;

      const activeIds = selectedElementIds.filter((id) => {
        return locks[id] === currentUser?.id || !locks[id];
      });

      if (activeIds.length === 0) return;

      const batch = activeIds.map((id) => {
        const el = elements.find((item) => item.id === id);
        const updates = typeof updatesMap === 'function' ? updatesMap(el) : updatesMap;
        return { elementId: id, updates };
      });

      // Optimistically update locally
      setElements((prev) =>
        prev.map((el) => {
          const match = batch.find((b) => b.elementId === el.id);
          if (match) {
            return {
              ...el,
              ...match.updates,
              properties: {
                ...(el.properties || {}),
                ...(match.updates.properties || {}),
              },
            };
          }
          return el;
        })
      );

      socket.emit('element-update', { batch });
    },
    [selectedElementIds, elements, locks, currentUser]
  );

  const handleDeleteSelected = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const unlockedIds = selectedElementIds.filter((id) => {
      const lockHolderId = locks[id];
      return !lockHolderId || lockHolderId === currentUser?.id;
    });

    if (unlockedIds.length === 0) return;

    socket.emit('element-delete', { elementIds: unlockedIds }, (res) => {
      if (res && res.success) {
        setElements((prev) => prev.filter((el) => !unlockedIds.includes(el.id)));
        setSelectedElementIds((prev) => prev.filter((id) => !unlockedIds.includes(id)));
      }
    });
  }, [selectedElementIds, locks, currentUser]);

  const handleClearDrawings = useCallback(() => {
    const drawingElementIds = elements
      .filter((el) => el.type === 'path')
      .map((el) => el.id);

    if (drawingElementIds.length === 0) return;

    const socket = socketRef.current;
    if (socket && socket.connected) {
      const unlockableDrawingIds = drawingElementIds.filter((id) => {
        const lockHolderId = locks[id];
        return !lockHolderId || lockHolderId === currentUser?.id;
      });

      if (unlockableDrawingIds.length === 0) return;

      socket.emit('element-delete', { elementIds: unlockableDrawingIds }, (res) => {
        if (res && res.success) {
          setElements((prev) => prev.filter((el) => !unlockableDrawingIds.includes(el.id)));
          setSelectedElementIds((prev) => prev.filter((id) => !unlockableDrawingIds.includes(id)));
        }
      });
    }
  }, [elements, locks, currentUser, setSelectedElementIds]);

  // Lobby (Join Screen)
  if (!joined) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-[#070b13] relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

        <div className="w-full max-w-md backdrop-blur-xl bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 shadow-2xl z-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Antigravity Canvas
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              Real-time vector workspace. Design and move shapes together.
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Display Name
              </label>
              <input
                type="text"
                required
                maxLength={20}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/50 transition"
                placeholder="Enter your name..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Cursor Color
              </label>
              <div className="flex flex-wrap gap-2.5 mb-3">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setColorInput(color)}
                    style={{ backgroundColor: color }}
                    className={`w-7 h-7 rounded-full transition-transform duration-150 ${
                      colorInput === color
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                        : 'hover:scale-105'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorInput}
                  onChange={(e) => setColorInput(e.target.value)}
                  className="w-10 h-7 bg-transparent border-0 cursor-pointer rounded"
                />
                <span className="text-xs text-slate-400 font-mono">{colorInput}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Room ID
              </label>
              <input
                type="text"
                required
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/50 transition font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={!connected}
              className={`w-full py-3.5 px-4 rounded-xl font-semibold text-white shadow-lg transition-all duration-300 ${
                connected
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {connected ? 'Enter Workspace' : 'Connecting to Server...'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-xs font-medium text-slate-500">
              {connected ? 'Socket Server Online' : 'Connecting to Server...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard (Canvas Board Workspace)
  return (
    <div className="flex-1 flex flex-col bg-[#070b13] overflow-hidden text-slate-100 h-full">
      {/* Header */}
      <header className="h-16 px-6 border-b border-slate-800/80 bg-slate-900/30 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
            AG
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-200">
              Antigravity Canvas
            </h1>
            <p className="text-[10px] text-slate-500 font-mono">
              Room: <span className="text-indigo-400">{roomIdInput}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* Connection status badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-800/60 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="font-semibold text-slate-300">
              {connected ? 'Live Syncing' : 'Reconnecting'}
            </span>
          </div>

          {/* User count badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-800/60 text-xs text-slate-300">
            👥 <span className="font-bold">{users.length}</span> online
          </div>

          {/* User profile capsule */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
              style={{ backgroundColor: currentUser?.color }}
            />
            <span className="font-semibold text-sm text-slate-200">{currentUser?.name}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Control Panel */}
        <aside className="w-80 border-r border-slate-800/80 bg-slate-900/10 p-5 flex flex-col gap-6 overflow-y-auto z-10">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Spawn Elements
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleSpawnShape('rectangle', '#3b82f6', '#2563eb')}
                className="py-2.5 px-3 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/30 hover:border-blue-500/40 rounded-xl text-blue-400 font-semibold text-xs transition flex flex-col items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <div className="w-7 h-5 bg-blue-500 rounded border border-blue-600" />
                <span>Blue Rect</span>
              </button>
              <button
                onClick={() => handleSpawnShape('rectangle', '#ef4444', '#dc2626')}
                className="py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/30 hover:border-rose-500/40 rounded-xl text-rose-400 font-semibold text-xs transition flex flex-col items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <div className="w-7 h-5 bg-rose-500 rounded border border-rose-600" />
                <span>Red Rect</span>
              </button>
              <button
                onClick={() => handleSpawnShape('circle', '#10b981', '#059669')}
                className="py-2.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 hover:border-emerald-500/40 rounded-xl text-emerald-400 font-semibold text-xs transition flex flex-col items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <div className="w-6 h-6 bg-emerald-500 rounded-full border border-emerald-600" />
                <span>Green Circle</span>
              </button>
              <button
                onClick={() => handleSpawnShape('circle', '#8b5cf6', '#7c3aed')}
                className="py-2.5 px-3 bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/30 hover:border-purple-500/40 rounded-xl text-purple-400 font-semibold text-xs transition flex flex-col items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <div className="w-6 h-6 bg-purple-500 rounded-full border border-purple-600" />
                <span>Purple Circle</span>
              </button>
            </div>
          </div>

          <hr className="border-slate-800/80" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setIsImageSectionCollapsed(!isImageSectionCollapsed)}
                className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-200 transition focus:outline-none cursor-pointer"
              >
                <span>{isImageSectionCollapsed ? '▶' : '▼'} Spawn Image Assets</span>
                {!isImageSectionCollapsed && allImageAssets.length > 0 && (
                  <span className="text-[10px] bg-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded">
                    {visibleAssets.length}
                  </span>
                )}
              </button>
            </div>

            {!isImageSectionCollapsed && (
              <div className="space-y-3">
                <p className="text-[10px] text-slate-500">
                  {showHiddenMode 
                    ? 'Click eye to restore image to active panel.' 
                    : 'Click to spawn. Hover to hide.'}
                </p>

                <div className="max-h-72 overflow-y-auto pr-1.5 space-y-3 custom-scrollbar">
                  {showHiddenMode ? (
                    hiddenAssets.length === 0 ? (
                      <p className="text-[10px] text-slate-600 text-center py-4">No hidden images.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {hiddenAssets.map((img) => (
                          <div
                            key={img.id}
                            className="group relative h-20 rounded-xl overflow-hidden border border-rose-950 bg-rose-950/20"
                          >
                            <img
                              src={img.url}
                              alt={img.name}
                              className="w-full h-full object-cover opacity-30 grayscale"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex items-end p-2">
                              <span className="text-[9px] font-bold text-rose-300 truncate pr-6">
                                {img.name}
                              </span>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => toggleHideAsset(img.url)}
                              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-lg hover:bg-emerald-400 hover:scale-105 active:scale-95 transition cursor-pointer"
                              title="Restore Image"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    visibleAssets.length === 0 ? (
                      <p className="text-[10px] text-slate-500 text-center py-4 bg-slate-950/20 border border-dashed border-slate-800 rounded-xl">
                        No visible image assets. Upload one below or restore hidden ones.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {visibleAssets.map((img) => (
                          <div
                            key={img.id}
                            className="group relative h-20 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 hover:border-slate-700 transition"
                          >
                            <button
                              type="button"
                              onClick={() => handleSpawnImage(img.url)}
                              className="w-full h-full text-left p-0 bg-transparent border-0 cursor-pointer"
                            >
                              <img
                                src={img.url}
                                alt={img.name}
                                className="w-full h-full object-cover opacity-60 group-hover:opacity-85 transition duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex items-end p-2 pointer-events-none">
                                <span className="text-[9px] font-bold text-slate-300 group-hover:text-white transition truncate pr-6">
                                  {img.name}
                                </span>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleHideAsset(img.url)}
                              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-400 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-slate-800 hover:text-rose-400 active:scale-95 transition cursor-pointer z-10"
                              title="Hide Image"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.893 7.893L21 21m-4.228-4.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                              </svg>
                            </button>

                            {!img.isPreset && (
                              <span className="absolute bottom-1.5 right-1.5 text-[7px] font-bold bg-sky-500/80 text-white px-1 rounded-sm select-none pointer-events-none">
                                User
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>

                {hiddenAssetUrls.length > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => setShowHiddenMode(!showHiddenMode)}
                      className={`text-[9px] font-bold px-2 py-1 rounded-lg transition border cursor-pointer ${
                        showHiddenMode 
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' 
                          : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                      }`}
                    >
                      {showHiddenMode ? '← Active Panel' : `Manage Hidden (${hiddenAssets.length})`}
                    </button>
                    {showHiddenMode && (
                      <button
                        type="button"
                        onClick={() => {
                          setHiddenAssetUrls([]);
                          setShowHiddenMode(false);
                        }}
                        className="text-[9px] font-bold text-slate-500 hover:text-slate-300 transition cursor-pointer"
                      >
                        Restore All
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

            {/* Custom File Upload Panel */}
            <div className="mt-5 pt-4 border-t border-slate-800/80">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Upload Custom Image
              </h3>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('border-blue-500/80', 'bg-blue-500/5');
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-blue-500/80', 'bg-blue-500/5');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-blue-500/80', 'bg-blue-500/5');
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleImageUpload(e.dataTransfer.files[0]);
                  }
                }}
                className="group relative border border-dashed border-slate-800 rounded-xl p-4 bg-slate-950/40 text-center hover:border-slate-700 transition cursor-pointer flex flex-col items-center justify-center min-h-[90px]"
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageUpload(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-bold text-sky-400">Uploading image...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <svg
                      className="w-6 h-6 text-slate-500 group-hover:text-slate-400 transition"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-300 transition">
                      Drag image here or browse
                    </span>
                    <span className="text-[9px] text-slate-600">Supports PNG, JPG, GIF, WEBP up to 5MB</span>
                  </div>
                )}
              </div>
              {uploadError && (
                <p className="text-[9px] text-rose-400 mt-1.5 font-medium flex items-center gap-1">
                  ⚠️ {uploadError}
                </p>
              )}
            </div>
        </aside>

        {/* Center Canvas Area */}
        <main className="flex-1 p-5 flex flex-col overflow-hidden relative">
          {/* Floating Toolbar */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
            <div className="backdrop-blur-md bg-slate-900/75 border border-slate-800 rounded-2xl p-1.5 shadow-2xl flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTool('select')}
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                  activeTool === 'select'
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                title="Select Tool"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.303.197-1.593 1.593M21.75 12h-2.25m-.197 5.303-1.593-1.593M3.071 6.25 4.664 4.664M12 19.75v2.25M6.25 3.071 4.664 4.664M4.5 12H2.25" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('pen')}
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                  activeTool === 'pen'
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                title="Pen Tool"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('eraser')}
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                  activeTool === 'eraser'
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                title="Eraser Tool"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <div className="w-px h-6 bg-slate-800 self-center mx-1" />
              <button
                type="button"
                onClick={handleClearDrawings}
                className="p-2.5 rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all cursor-pointer"
                title="Clear All Drawings"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {/* Slide-out sub-toolbar when Pen Tool is active */}
            {activeTool === 'pen' && (
              <div className="backdrop-blur-md bg-slate-900/70 border border-slate-800 rounded-2xl px-4 py-2 shadow-2xl flex items-center gap-4 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                {/* Pen Color presets */}
                <div className="flex items-center gap-1.5">
                  {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ffffff'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setPenColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-5 h-5 rounded-full transition-all border border-black/10 cursor-pointer ${
                        penColor === color
                          ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-900 scale-110'
                          : 'hover:scale-105'
                      }`}
                    />
                  ))}
                  {/* Custom color picker */}
                  <div className="relative w-5 h-5 rounded-full overflow-hidden border border-slate-700 cursor-pointer flex items-center justify-center">
                    <input
                      type="color"
                      value={penColor}
                      onChange={(e) => setPenColor(e.target.value)}
                      className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer opacity-0"
                    />
                    <span className="text-[10px] text-slate-400 font-bold select-none">+</span>
                  </div>
                </div>

                <div className="w-px h-4 bg-slate-800" />

                {/* Pen size selector */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400 select-none">Size</span>
                  <input
                    type="range"
                    min="2"
                    max="24"
                    value={penSize}
                    onChange={(e) => setPenSize(parseInt(e.target.value, 10))}
                    className="w-20 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                  <span className="text-[10px] font-mono text-slate-400 select-none w-5 text-right">
                    {penSize}px
                  </span>
                </div>
              </div>
            )}
          </div>

          <Canvas
            socketRef={socketRef}
            elements={elements}
            setElements={setElements}
            locks={locks}
            setLocks={setLocks}
            users={users}
            currentUser={currentUser}
            selectedElementIds={selectedElementIds}
            setSelectedElementIds={setSelectedElementIds}
            activeTool={activeTool}
            penColor={penColor}
            penSize={penSize}
          />
        </main>

        {/* Right Info Panel */}
        <aside className="w-80 border-l border-slate-800/80 bg-slate-900/10 p-5 flex flex-col gap-6 overflow-y-auto z-10">
          {/* Active Users */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Active Users
              </h2>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-1.5 py-0.5 rounded">
                {users.length}
              </span>
            </div>
            <div className="space-y-2">
              {users.map((user) => {
                const isMe = user.id === currentUser?.id;
                const isUserActive = user.x !== 0 || user.y !== 0;

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/50 hover:border-slate-800 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/10"
                        style={{ backgroundColor: user.color }}
                      />
                      <span className="text-xs font-bold text-slate-300 truncate max-w-[120px]">
                        {user.name}
                        {isMe && <span className="text-[9px] font-normal text-slate-500 ml-1">(you)</span>}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                          isUserActive
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isUserActive ? 'Active' : 'Idle'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-800/80" />

          {/* Transform Inspector */}
          {selectedElementIds.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                  Transform Inspector
                </h2>
                <span className="text-[10px] bg-sky-500/10 text-sky-400 font-bold px-1.5 py-0.5 rounded">
                  {selectedElementIds.length} selected
                </span>
              </div>

              {/* Width & Height Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Width (px)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="2000"
                    value={inputWidth}
                    placeholder={selectedElementIds.length > 1 && inputWidth === '' ? 'Mixed' : 'Width'}
                    onFocus={() => {
                      setIsWidthFocused(true);
                      handleStartInspectorTransform();
                    }}
                    onBlur={() => {
                      setIsWidthFocused(false);
                      handleEndInspectorTransform();
                      // Sync immediately on blur
                      const selectedElements = elements.filter((el) => selectedElementIds.includes(el.id));
                      if (selectedElements.length > 0) {
                        const firstWidth = selectedElements[0].width;
                        const allSameWidth = selectedElements.every((el) => el.width === firstWidth);
                        setInputWidth(allSameWidth ? String(firstWidth) : '');
                      }
                    }}
                    onChange={(e) => {
                      setInputWidth(e.target.value);
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        handleInspectorChange({ width: val });
                      }
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Height (px)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="2000"
                    value={inputHeight}
                    placeholder={selectedElementIds.length > 1 && inputHeight === '' ? 'Mixed' : 'Height'}
                    onFocus={() => {
                      setIsHeightFocused(true);
                      handleStartInspectorTransform();
                    }}
                    onBlur={() => {
                      setIsHeightFocused(false);
                      handleEndInspectorTransform();
                      // Sync immediately on blur
                      const selectedElements = elements.filter((el) => selectedElementIds.includes(el.id));
                      if (selectedElements.length > 0) {
                        const firstHeight = selectedElements[0].height;
                        const allSameHeight = selectedElements.every((el) => el.height === firstHeight);
                        setInputHeight(allSameHeight ? String(firstHeight) : '');
                      }
                    }}
                    onChange={(e) => {
                      setInputHeight(e.target.value);
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        handleInspectorChange({ height: val });
                      }
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                  />
                </div>
              </div>

              {/* Rotation Control */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Rotation
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {(() => {
                      if (inputRotation !== '') {
                        return `${inputRotation}°`;
                      }
                      const firstEl = elements.find((el) => el.id === selectedElementIds[0]);
                      const rotRad = firstEl?.properties?.rotation || 0;
                      const deg = Math.round((rotRad * 180) / Math.PI) % 360;
                      return `${deg < 0 ? deg + 360 : deg}°`;
                    })()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={(() => {
                      if (inputRotation !== '') {
                        const deg = parseInt(inputRotation, 10);
                        if (!isNaN(deg)) return deg;
                      }
                      const firstEl = elements.find((el) => el.id === selectedElementIds[0]);
                      const rotRad = firstEl?.properties?.rotation || 0;
                      const deg = Math.round((rotRad * 180) / Math.PI) % 360;
                      return deg < 0 ? deg + 360 : deg;
                    })()}
                    onMouseDown={handleStartInspectorTransform}
                    onTouchStart={handleStartInspectorTransform}
                    onMouseUp={handleEndInspectorTransform}
                    onTouchEnd={handleEndInspectorTransform}
                    onChange={(e) => {
                      const deg = parseInt(e.target.value, 10);
                      setInputRotation(String(deg));
                      const rad = (deg * Math.PI) / 180;
                      handleInspectorChange((el) => ({
                        properties: {
                          ...(el.properties || {}),
                          rotation: rad,
                        },
                      }));
                    }}
                    className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                  <input
                    type="number"
                    min="0"
                    max="360"
                    value={inputRotation}
                    placeholder={selectedElementIds.length > 1 && inputRotation === '' ? 'Mixed' : '0'}
                    onFocus={() => {
                      setIsRotationFocused(true);
                      handleStartInspectorTransform();
                    }}
                    onBlur={() => {
                      setIsRotationFocused(false);
                      handleEndInspectorTransform();
                      // Sync immediately on blur
                      const selectedElements = elements.filter((el) => selectedElementIds.includes(el.id));
                      if (selectedElements.length > 0) {
                        const firstRot = selectedElements[0].properties?.rotation || 0;
                        const deg = Math.round((firstRot * 180) / Math.PI) % 360;
                        const normalizedDeg = deg < 0 ? deg + 360 : deg;
                        const allSameRot = selectedElements.every((el) => {
                          const r = el.properties?.rotation || 0;
                          const d = Math.round((r * 180) / Math.PI) % 360;
                          const nd = d < 0 ? d + 360 : d;
                          return nd === normalizedDeg;
                        });
                        setInputRotation(allSameRot ? String(normalizedDeg) : '');
                      }
                    }}
                    onChange={(e) => {
                      setInputRotation(e.target.value);
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        const deg = val % 360;
                        const rad = (deg * Math.PI) / 180;
                        handleInspectorChange((el) => ({
                          properties: {
                            ...(el.properties || {}),
                            rotation: rad,
                          },
                        }));
                      }
                    }}
                    className="w-16 px-2 py-1 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-center text-slate-200 focus:outline-none focus:border-sky-500 transition"
                  />
                </div>
              </div>


              {/* Delete Button */}
              <button
                onClick={handleDeleteSelected}
                className="w-full py-2 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/35 hover:border-rose-500/60 text-xs text-rose-400 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                🗑️ Delete Selected
              </button>
            </div>
          )}

          <hr className="border-slate-800/80" />

          {/* Board Elements & Locks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Elements & Locks
              </h2>
              <span className="text-[10px] bg-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded">
                {elements.length}
              </span>
            </div>

            {elements.length === 0 ? (
              <p className="text-[11px] text-slate-500 text-center py-4 bg-slate-900/20 rounded-xl border border-dashed border-slate-800">
                No items on canvas. Use the left panel to spawn something.
              </p>
            ) : (
              <div className="space-y-2">
                {elements.map((el) => {
                  const lockHolderId = locks[el.id];
                  const isLocked = !!lockHolderId;
                  const lockHolder = isLocked ? users.find((u) => u.id === lockHolderId) : null;
                  const isLockedByOther = isLocked && lockHolderId !== currentUser?.id;
                  const isSelected = selectedElementIds.includes(el.id);
                  const shapeName = el.type.charAt(0).toUpperCase() + el.type.slice(1);

                  return (
                    <div
                      key={el.id}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          setSelectedElementIds((prev) =>
                            prev.includes(el.id)
                              ? prev.filter((id) => id !== el.id)
                              : [...prev, el.id]
                          );
                        } else {
                          setSelectedElementIds([el.id]);
                        }
                      }}
                      className={`p-2.5 rounded-xl flex flex-col gap-1.5 transition cursor-pointer select-none ${
                        isSelected
                          ? 'bg-sky-500/10 border border-sky-500/80 shadow-md shadow-sky-500/5'
                          : 'bg-slate-900/40 border border-slate-800/50 hover:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3.5 h-3.5 rounded border border-slate-700 flex items-center justify-center text-[9px]"
                          >
                            {el.type === 'circle' ? '⚪' : el.type === 'image' ? '🖼️' : '🟦'}
                          </div>
                          <span className="text-xs font-bold text-slate-300">
                            {shapeName}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          X:{el.x} Y:{el.y}
                        </span>
                      </div>

                      {/* Lock Status Bar */}
                      {isLocked ? (
                        <div
                          style={{
                            borderColor: lockHolder?.color ? `${lockHolder.color}20` : '#38bdf820',
                            backgroundColor: lockHolder?.color ? `${lockHolder.color}08` : '#38bdf808',
                          }}
                          className="flex items-center justify-between border rounded-lg px-2 py-1 text-[9px]"
                        >
                          <span className="text-slate-400 flex items-center gap-1">
                            🔒 Locked by{' '}
                            <span
                              style={{ color: lockHolder?.color }}
                              className="font-extrabold"
                            >
                              {lockHolder?.name || 'Unknown'}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between border border-slate-800/80 bg-slate-950/20 rounded-lg px-2 py-1 text-[9px] text-slate-500">
                          <span>🔓 Unlocked & Editable</span>
                        </div>
                      )}

                      {/* Delete Element Button */}
                      {isSelected && !isLockedByOther && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const socket = socketRef.current;
                            if (socket && socket.connected) {
                              socket.emit('element-delete', { elementId: el.id }, (response) => {
                                if (response && response.success) {
                                  setElements((prev) => prev.filter((item) => item.id !== el.id));
                                  setSelectedElementIds((prev) => prev.filter((id) => id !== el.id));
                                }
                              });
                            }
                          }}
                          className="mt-1 w-full py-1.5 px-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-[10px] text-rose-400 font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                        >
                          🗑️ Delete Element
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
