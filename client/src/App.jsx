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
  const [selectedElementId, setSelectedElementId] = useState(null);

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
        prev.map((el) => (el.id === elementId ? { ...el, ...updates } : el))
      );
    });

    s.on('element-created', ({ element }) => {
      setElements((prev) => [...prev.filter((el) => el.id !== element.id), element]);
    });

    s.on('element-deleted', ({ elementId }) => {
      setElements((prev) => prev.filter((el) => el.id !== elementId));
      setSelectedElementId((prev) => (prev === elementId ? null : prev));
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
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Spawn Image Assets
            </h2>
            <p className="text-[10px] text-slate-500 mb-3">
              Click a thumbnail to spawn high-resolution textures onto the canvas.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SAMPLE_IMAGES.map((img) => (
                <button
                  key={img.name}
                  onClick={() => handleSpawnImage(img.url)}
                  className="group relative h-20 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 hover:border-slate-700 transition active:scale-95 cursor-pointer"
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex items-end p-2">
                    <span className="text-[9px] font-bold text-slate-300 group-hover:text-white transition truncate">
                      {img.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Canvas Area */}
        <main className="flex-1 p-5 flex flex-col overflow-hidden relative">
          <Canvas
            socketRef={socketRef}
            elements={elements}
            setElements={setElements}
            locks={locks}
            setLocks={setLocks}
            users={users}
            currentUser={currentUser}
            selectedElementId={selectedElementId}
            setSelectedElementId={setSelectedElementId}
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
                  const isSelected = el.id === selectedElementId;
                  const shapeName = el.type.charAt(0).toUpperCase() + el.type.slice(1);

                  return (
                    <div
                      key={el.id}
                      onClick={() => {
                        setSelectedElementId(el.id);
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
                                  setSelectedElementId(null);
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
