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

function TabButton({ tab, isActive, tabUsers, onSwitch, onDelete, onRename, isDeleteDisabled }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(tab.name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    setIsEditing(false);
    if (editName.trim() && editName !== tab.name) {
      onRename(tab.id, editName.trim());
    } else {
      setEditName(tab.name);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(tab.name);
    }
  };

  return (
    <div
      onClick={() => !isEditing && onSwitch(tab.id)}
      onDoubleClick={() => setIsEditing(true)}
      className={`group flex items-center gap-3 px-4 py-2 rounded-xl transition duration-200 border cursor-pointer select-none relative shrink-0 ${
        isActive
          ? 'bg-sky-500/10 border-sky-500/30 text-sky-400 font-bold shadow-md'
          : 'bg-slate-950/20 border-slate-900 text-slate-400 hover:bg-slate-900/40 hover:text-slate-300'
      }`}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          className="bg-slate-950/80 border border-sky-500 rounded px-1.5 py-0.5 text-xs text-sky-300 focus:outline-none w-24 font-semibold"
        />
      ) : (
        <span className="text-xs truncate max-w-[100px] font-semibold">{tab.name}</span>
      )}

      {/* Users Avatars indicator */}
      {tabUsers.length > 0 && (
        <div className="flex items-center -space-x-1.5 ml-1">
          {tabUsers.map((u) => (
            <div
              key={u.id}
              style={{ backgroundColor: u.color }}
              className="w-4 h-4 rounded-full border border-slate-900 flex items-center justify-center text-[8px] font-black text-white shadow-sm"
              title={u.name}
            >
              {u.name.substring(0, 1).toUpperCase()}
            </div>
          ))}
        </div>
      )}

      {/* Delete button (shows on hover or active, hidden if disabled) */}
      {!isDeleteDisabled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(tab.id);
          }}
          className="w-3.5 h-3.5 rounded-md flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 transition opacity-0 group-hover:opacity-100 cursor-pointer"
          title="Delete Canvas"
        >
          ✕
        </button>
      )}
    </div>
  );
}

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
  const [tabs, setTabs] = useState([
    {
      id: 'tab-default',
      name: 'Canvas 1',
      elements: [],
      locks: {},
      roomSettings: {
        backgroundImageUrl: null,
        showBackground: true,
        backgroundMode: 'fill',
        showGrid: true,
        gridType: 'square',
        gridSize: 40,
      },
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-default');
  const activeTabIdRef = useRef('tab-default');

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0] || {
    id: 'tab-default',
    name: 'Canvas 1',
    elements: [],
    locks: {},
    roomSettings: {
      backgroundImageUrl: null,
      showBackground: true,
      backgroundMode: 'fill',
      showGrid: true,
      gridType: 'square',
      gridSize: 40,
    },
  };
  const elements = activeTab.elements;
  const locks = activeTab.locks;
  const roomSettings = activeTab.roomSettings;

  const setElements = useCallback((updater) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabIdRef.current
          ? {
              ...t,
              elements:
                typeof updater === 'function' ? updater(t.elements) : updater,
            }
          : t
      )
    );
  }, []);

  const setLocks = useCallback((updater) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabIdRef.current
          ? {
              ...t,
              locks: typeof updater === 'function' ? updater(t.locks) : updater,
            }
          : t
      )
    );
  }, []);

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
  const [eraserSize, setEraserSize] = useState(20);

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
  const [draggedElementId, setDraggedElementId] = useState(null);
  const [dragOverElementId, setDragOverElementId] = useState(null);

  // Collaborative Room Settings computed dynamically from active tab
  const [isSettingsSectionCollapsed, setIsSettingsSectionCollapsed] = useState(false);
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);
  const [selectedBgPreviewAsset, setSelectedBgPreviewAsset] = useState(null);

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
              const formattedTabs = (res.tabs || []).map((tab) => {
                const lockMap = {};
                (tab.locks || []).forEach(([eId, uId]) => {
                  lockMap[eId] = uId;
                });
                return {
                  ...tab,
                  locks: lockMap,
                };
              });
              setTabs(formattedTabs);
              setUsers(res.users || []);
              setAssets(res.assets || []);

              let targetTabId = activeTabIdRef.current;
              if (!formattedTabs.some((t) => t.id === targetTabId)) {
                targetTabId = res.activeTabId || 'tab-default';
              }
              setActiveTabId(targetTabId);

              if (targetTabId !== 'tab-default') {
                s.emit('tab-switch', { tabId: targetTabId });
              }

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
      setTabs((prev) =>
        prev.map((tab) => {
          const nextLocks = { ...tab.locks };
          let changed = false;
          Object.keys(nextLocks).forEach((key) => {
            if (nextLocks[key] === userId) {
              delete nextLocks[key];
              changed = true;
            }
          });
          return changed ? { ...tab, locks: nextLocks } : tab;
        })
      );
    });

    s.on('cursor-update', ({ userId, x, y }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, x, y } : u))
      );
    });

    s.on('element-locked', ({ elementId, userId, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) =>
          t.id === targetTabId
            ? { ...t, locks: { ...t.locks, [elementId]: userId } }
            : t
        )
      );
    });

    s.on('element-unlocked', ({ elementId, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== targetTabId) return t;
          const nextLocks = { ...t.locks };
          delete nextLocks[elementId];
          return { ...t, locks: nextLocks };
        })
      );
    });

    s.on('element-updated', ({ elementId, updates, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== targetTabId) return t;
          return {
            ...t,
            elements: t.elements.map((el) => {
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
            }),
          };
        })
      );
    });

    s.on('element-updated-batch', ({ batch, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== targetTabId) return t;
          return {
            ...t,
            elements: t.elements.map((el) => {
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
            }),
          };
        })
      );
    });

    s.on('element-created', ({ element, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== targetTabId) return t;
          return {
            ...t,
            elements: [...t.elements.filter((el) => el.id !== element.id), element],
          };
        })
      );
    });

    s.on('element-deleted', ({ elementId, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== targetTabId) return t;
          const nextLocks = { ...t.locks };
          delete nextLocks[elementId];
          return {
            ...t,
            elements: t.elements.filter((el) => el.id !== elementId),
            locks: nextLocks,
          };
        })
      );
      setSelectedElementIds((prev) => prev.filter((id) => id !== elementId));
    });

    s.on('asset-created', ({ asset }) => {
      setAssets((prev) => [...prev.filter((a) => a.id !== asset.id), asset]);
    });

    s.on('elements-reordered', ({ orderedIds, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== targetTabId) return t;
          const elementMap = new Map(t.elements.map((el) => [el.id, el]));
          const sorted = [];
          orderedIds.forEach((id) => {
            if (elementMap.has(id)) {
              sorted.push(elementMap.get(id));
            }
          });
          t.elements.forEach((el) => {
            if (!orderedIds.includes(el.id)) {
              sorted.push(el);
            }
          });
          return {
            ...t,
            elements: sorted,
          };
        })
      );
    });

    s.on('room-settings-updated', ({ roomSettings: updatedSettings, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) =>
          t.id === targetTabId
            ? { ...t, roomSettings: updatedSettings }
            : t
        )
      );
    });

    s.on('tab-created', ({ tab }) => {
      setTabs((prev) => {
        if (prev.some((t) => t.id === tab.id)) return prev;
        const lockMap = {};
        (tab.locks || []).forEach(([eId, uId]) => {
          lockMap[eId] = uId;
        });
        return [
          ...prev,
          {
            ...tab,
            locks: lockMap,
          },
        ];
      });
    });

    s.on('tab-deleted', ({ tabId, fallbackTabId, users: updatedUsers }) => {
      setTabs((prev) => prev.filter((t) => t.id !== tabId));
      if (updatedUsers) {
        setUsers(updatedUsers);
      }
      setActiveTabId((currentActiveTabId) => {
        if (currentActiveTabId === tabId) {
          setSelectedElementIds([]);
          return fallbackTabId;
        }
        return currentActiveTabId;
      });
    });

    s.on('tab-renamed', ({ tabId, name }) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, name } : t))
      );
    });

    s.on('tab-switched', ({ userId, tabId }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, activeTabId: tabId } : u))
      );
    });

    return () => {
      s.disconnect();
    };
  }, []);

  const adjustElementLayer = useCallback((elementId, direction) => {
    setElements((prev) => {
      const next = [...prev];
      const index = next.findIndex((el) => el.id === elementId);
      if (index === -1) return prev;

      if (direction === 'forward' && index < next.length - 1) {
        const temp = next[index];
        next[index] = next[index + 1];
        next[index + 1] = temp;
      } else if (direction === 'backward' && index > 0) {
        const temp = next[index];
        next[index] = next[index - 1];
        next[index - 1] = temp;
      } else {
        return prev;
      }

      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit('elements-reorder', { orderedIds: next.map((el) => el.id), tabId: activeTabIdRef.current });
      }
      return next;
    });
  }, []);

  const adjustSelectedElementsLayer = useCallback((direction) => {
    if (selectedElementIds.length === 0) return;

    setElements((prev) => {
      const next = [...prev];
      const selectedIndices = selectedElementIds
        .map((id) => next.findIndex((el) => el.id === id))
        .filter((idx) => idx !== -1)
        .sort((a, b) => a - b);

      if (direction === 'forward') {
        for (let i = selectedIndices.length - 1; i >= 0; i--) {
          const idx = selectedIndices[i];
          if (idx < next.length - 1) {
            const temp = next[idx];
            next[idx] = next[idx + 1];
            next[idx + 1] = temp;
          }
        }
      } else {
        for (let i = 0; i < selectedIndices.length; i++) {
          const idx = selectedIndices[i];
          if (idx > 0) {
            const temp = next[idx];
            next[idx] = next[idx - 1];
            next[idx - 1] = temp;
          }
        }
      }

      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit('elements-reorder', { orderedIds: next.map((el) => el.id), tabId: activeTabIdRef.current });
      }
      return next;
    });
  }, [selectedElementIds]);

  const handleDragStart = useCallback((e, id) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedElementId(id);
  }, []);

  const handleDragOver = useCallback((e, id) => {
    e.preventDefault();
    if (draggedElementId && draggedElementId !== id) {
      setDragOverElementId(id);
    }
  }, [draggedElementId]);

  const handleDragLeave = useCallback(() => {
    setDragOverElementId(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedElementId(null);
    setDragOverElementId(null);
  }, []);

  const handleDrop = useCallback((e, targetId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedElementId;
    setDraggedElementId(null);
    setDragOverElementId(null);

    if (!sourceId || sourceId === targetId) return;

    setElements((prev) => {
      const next = [...prev];
      const sourceIndex = next.findIndex((el) => el.id === sourceId);
      const targetIndex = next.findIndex((el) => el.id === targetId);

      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const [removed] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, removed);

      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit('elements-reorder', { orderedIds: next.map((el) => el.id), tabId: activeTabIdRef.current });
      }
      return next;
    });
  }, [draggedElementId]);

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
              const formattedTabs = (res.tabs || []).map((tab) => {
                const lockMap = {};
                (tab.locks || []).forEach(([eId, uId]) => {
                  lockMap[eId] = uId;
                });
                return {
                  ...tab,
                  locks: lockMap,
                };
              });
              setTabs(formattedTabs);
              setUsers(res.users || []);
              setAssets(res.assets || []);

              let targetTabId = activeTabIdRef.current;
              if (!formattedTabs.some((t) => t.id === targetTabId)) {
                targetTabId = res.activeTabId || 'tab-default';
              }
              setActiveTabId(targetTabId);

              if (targetTabId !== 'tab-default') {
                socket.emit('tab-switch', { tabId: targetTabId });
              }

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

      socket.emit('element-create', { element, tabId: activeTabIdRef.current }, (response) => {
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

      const img = new Image();
      img.src = url;

      const spawnWithDimensions = (w, h) => {
        const id = `el_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const element = {
          id,
          type: 'image',
          x: Math.floor(Math.random() * 200) + 120,
          y: Math.floor(Math.random() * 200) + 120,
          width: w,
          height: h,
          properties: {
            url,
          },
        };

        // Optimistically update locally
        setElements((prev) => [...prev, element]);

        socket.emit('element-create', { element, tabId: activeTabIdRef.current }, (response) => {
          if (!response || !response.success) {
            // Rollback
            setElements((prev) => prev.filter((el) => el.id !== id));
            console.error('Failed to create image element:', response?.error);
          }
        });
      };

      img.onload = () => {
        const w = img.naturalWidth || 160;
        const h = img.naturalHeight || 110;

        let targetW;
        let targetH;

        if (w <= h) {
          targetW = 150;
          targetH = Math.round(h * (150 / w));
        } else {
          targetH = 150;
          targetW = Math.round(w * (150 / h));
        }

        spawnWithDimensions(targetW, targetH);
      };

      img.onerror = () => {
        console.error('Failed to load image to determine native dimensions:', url);
        // Fallback with default 160x110 scaled aspect ratio (height is smaller, set to 150)
        spawnWithDimensions(Math.round(160 * (150 / 110)), 150);
      };
    },
    [setElements]
  );

  const handleImageUpload = useCallback(
    async (files) => {
      if (!files || files.length === 0) return;

      const filesArray = Array.from(files);
      const filesToUpload = filesArray.slice(0, 50);

      // Validation
      const invalidFiles = filesToUpload.filter(
        (file) => !file.type.startsWith('image/') || file.size > 20 * 1024 * 1024
      );
      const validFiles = filesToUpload.filter(
        (file) => file.type.startsWith('image/') && file.size <= 20 * 1024 * 1024
      );

      if (validFiles.length === 0) {
        if (invalidFiles.length > 0) {
          setUploadError('None of the selected files are valid images under 20MB.');
        }
        return;
      }

      let warningText = '';
      if (filesArray.length > 50) {
        warningText = 'Only the first 50 files will be uploaded. ';
      }
      if (invalidFiles.length > 0) {
        warningText += `${invalidFiles.length} file(s) skipped (must be images under 20MB).`;
      }
      if (warningText) {
        setUploadError(warningText);
      } else {
        setUploadError('');
      }

      setIsUploading(true);

      const formData = new FormData();
      validFiles.forEach((file) => {
        formData.append('image', file);
      });

      try {
        const response = await fetch(`${SOCKET_URL}/api/upload`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (data.success && data.files) {
          data.files.forEach((uploadedFile) => {
            const assetId = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const originalName = uploadedFile.originalname || uploadedFile.filename;
            const assetName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
            const newAsset = { id: assetId, name: assetName, url: uploadedFile.url };

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
          });
        } else {
          setUploadError(data.error || 'Failed to upload images.');
        }
      } catch (err) {
        console.error('Error uploading images:', err);
        setUploadError('Server connection error.');
      } finally {
        setIsUploading(false);
      }
    },
    []
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

    socket.emit('element-lock', { elementIds: unlockedIds, tabId: activeTabIdRef.current }, (res) => {
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
      socket.emit('element-unlock', { elementIds: activeIds, tabId: activeTabIdRef.current });
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

      socket.emit('element-update', { batch, tabId: activeTabIdRef.current });
    },
    [selectedElementIds, elements, locks, currentUser]
  );

  const handleToggleSelectionLock = useCallback((elementId) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const el = elements.find((item) => item.id === elementId);
    if (!el) return;

    const currentlyLocked = !!el.properties?.locked;
    const nextLocked = !currentlyLocked;

    // Optimistically update locally
    setElements((prev) =>
      prev.map((item) => {
        if (item.id === elementId) {
          return {
            ...item,
            properties: {
              ...(item.properties || {}),
              locked: nextLocked,
            },
          };
        }
        return item;
      })
    );

    // If we are locking the element, remove it from selectedElementIds to drop handles on the canvas
    if (nextLocked) {
      setSelectedElementIds((prev) => prev.filter((id) => id !== elementId));
    }

    // Emit standard element-update Socket.IO event to sync changes room-wide
    const updates = {
      properties: {
        ...(el.properties || {}),
        locked: nextLocked,
      },
    };
    socket.emit('element-update', {
      batch: [{ elementId, updates }],
      tabId: activeTabIdRef.current,
    });
  }, [elements, socketRef, setElements, setSelectedElementIds]);

  const handleDeleteSelected = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const unlockedIds = selectedElementIds.filter((id) => {
      const lockHolderId = locks[id];
      return !lockHolderId || lockHolderId === currentUser?.id;
    });

    if (unlockedIds.length === 0) return;

    socket.emit('element-delete', { elementIds: unlockedIds, tabId: activeTabIdRef.current }, (res) => {
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

      socket.emit('element-delete', { elementIds: unlockableDrawingIds, tabId: activeTabIdRef.current }, (res) => {
        if (res && res.success) {
          setElements((prev) => prev.filter((el) => !unlockableDrawingIds.includes(el.id)));
          setSelectedElementIds((prev) => prev.filter((id) => !unlockableDrawingIds.includes(id)));
        }
      });
    }
  }, [elements, locks, currentUser, setSelectedElementIds]);

  const handleUpdateRoomSettings = useCallback((updates) => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      // Optimistically update local state first
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabIdRef.current
            ? { ...t, roomSettings: { ...t.roomSettings, ...updates } }
            : t
        )
      );
      socket.emit('room-settings-update', { updates, tabId: activeTabIdRef.current }, (res) => {
        if (res && res.success && res.roomSettings) {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === activeTabIdRef.current
                ? { ...t, roomSettings: res.roomSettings }
                : t
            )
          );
        }
      });
    }
  }, []);

  const handleSwitchTab = useCallback((tabId) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    socket.emit('tab-switch', { tabId }, (res) => {
      if (res && res.success) {
        setSelectedElementIds([]);
        setActiveTabId(tabId);
        setUsers((prev) =>
          prev.map((u) => (u.id === socket.id ? { ...u, activeTabId: tabId } : u))
        );
      }
    });
  }, []);

  // Collaborative canvas tab operational callbacks
  const handleCreateTab = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const newTabId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newName = `Canvas ${tabs.length + 1}`;

    socket.emit('tab-create', { tabId: newTabId, name: newName }, (res) => {
      if (res && res.success && res.tab) {
        const lockMap = {};
        (res.tab.locks || []).forEach(([eId, uId]) => {
          lockMap[eId] = uId;
        });
        const formattedTab = {
          ...res.tab,
          locks: lockMap,
        };
        setTabs((prev) => [...prev, formattedTab]);
        handleSwitchTab(newTabId);
      }
    });
  }, [tabs.length, handleSwitchTab]);

  const handleDeleteTab = useCallback((tabId) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    if (tabs.length <= 1) return;

    socket.emit('tab-delete', { tabId }, (res) => {
      if (res && res.success) {
        setTabs((prev) => prev.filter((t) => t.id !== tabId));
        if (res.users) {
          setUsers(res.users);
        }
        if (res.fallbackTabId) {
          setActiveTabId((currentActiveTabId) => {
            if (currentActiveTabId === tabId) {
              setSelectedElementIds([]);
              return res.fallbackTabId;
            }
            return currentActiveTabId;
          });
        }
      }
    });
  }, [tabs.length]);

  const handleRenameTab = useCallback((tabId, name) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const trimmedName = name.trim();
    if (!trimmedName) return;

    socket.emit('tab-rename', { tabId, name: trimmedName }, (res) => {
      if (res && res.success) {
        setTabs((prev) =>
          prev.map((t) => (t.id === tabId ? { ...t, name: trimmedName } : t))
        );
      }
    });
  }, []);

  const handleOpenBgModal = useCallback(() => {
    const activeUrl = roomSettings.backgroundImageUrl;
    if (activeUrl) {
      const foundPreset = SAMPLE_IMAGES.find((img) => img.url === activeUrl);
      if (foundPreset) {
        setSelectedBgPreviewAsset({ id: 'active', name: foundPreset.name, url: activeUrl, isPreset: true });
      } else {
        const foundUser = assets.find((a) => a.url === activeUrl);
        setSelectedBgPreviewAsset(foundUser ? { ...foundUser, isPreset: false } : { id: 'active', name: 'Active Background', url: activeUrl, isPreset: false });
      }
    } else {
      setSelectedBgPreviewAsset(null);
    }
    setIsBgModalOpen(true);
  }, [roomSettings.backgroundImageUrl, assets]);

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
                              onClick={() => handleUpdateRoomSettings({ backgroundImageUrl: img.url, showBackground: true })}
                              className={`absolute top-1.5 left-1.5 w-6 h-6 rounded-lg border text-slate-400 opacity-0 group-hover:opacity-100 flex items-center justify-center active:scale-95 transition cursor-pointer z-10 ${
                                roomSettings.backgroundImageUrl === img.url
                                  ? 'bg-sky-500 border-sky-400 text-white'
                                  : 'bg-slate-900/90 border-slate-700 hover:bg-slate-800 hover:text-sky-400'
                              }`}
                              title="Set as Canvas Background"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a6 6 0 018.486 0l5.16 5.159m-16.5 0h16.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
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
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleImageUpload(e.dataTransfer.files);
                  }
                }}
                className="group relative border border-dashed border-slate-800 rounded-xl p-4 bg-slate-950/40 text-center hover:border-slate-700 transition cursor-pointer flex flex-col items-center justify-center min-h-[90px]"
              >
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleImageUpload(e.target.files);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-bold text-sky-400">Uploading images...</span>
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
                      Drag images here or browse
                    </span>
                    <span className="text-[9px] text-slate-600">Supports PNG, JPG, GIF, WEBP up to 20MB (max 50 files)</span>
                  </div>
                )}
              </div>
              {uploadError && (
                <p className="text-[9px] text-rose-400 mt-1.5 font-medium flex items-center gap-1">
                  ⚠️ {uploadError}
                </p>
              )}
            </div>

            {/* Canvas Settings Panel */}
            <div className="mt-5 pt-4 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setIsSettingsSectionCollapsed(!isSettingsSectionCollapsed)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-200 transition focus:outline-none cursor-pointer"
                >
                  <span>{isSettingsSectionCollapsed ? '▶' : '▼'} Canvas Settings</span>
                </button>
              </div>

              {!isSettingsSectionCollapsed && (
                <div className="space-y-4">
                  {/* Background image section */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Background Image</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateRoomSettings({ showBackground: !roomSettings.showBackground })}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                          roomSettings.showBackground ? 'bg-sky-500' : 'bg-slate-800'
                        }`}
                        title="Toggle Background Image"
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                            roomSettings.showBackground ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {roomSettings.showBackground && (
                      <div className="space-y-2.5 animate-in fade-in duration-200">
                        {/* Select Background Image */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Background Image Asset</span>
                            {roomSettings.backgroundImageUrl && (
                              <button
                                type="button"
                                onClick={() => handleUpdateRoomSettings({ backgroundImageUrl: null })}
                                className="text-[9px] font-bold text-rose-400 hover:text-rose-300 transition cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          {roomSettings.backgroundImageUrl ? (
                            <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950/60 p-2 flex items-center gap-2">
                              <div className="w-12 h-9 rounded bg-slate-900 overflow-hidden border border-slate-800 flex-shrink-0">
                                <img
                                  src={roomSettings.backgroundImageUrl}
                                  alt="Active Background"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[9px] font-bold text-slate-300 truncate">
                                  {(() => {
                                    const found = allImageAssets.find(img => img.url === roomSettings.backgroundImageUrl);
                                    return found ? found.name : 'Custom Background';
                                  })()}
                                </div>
                                <div className="text-[8px] text-slate-500 capitalize">
                                  {roomSettings.backgroundMode} mode
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={handleOpenBgModal}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 text-[8px] font-bold rounded transition cursor-pointer flex-shrink-0"
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={handleOpenBgModal}
                              className="w-full py-3 border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/30 hover:bg-slate-950/50 rounded-lg flex flex-col items-center justify-center gap-1 transition duration-200 group cursor-pointer"
                            >
                              <svg className="w-4 h-4 text-slate-500 group-hover:text-slate-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-[9px] font-medium text-slate-400 group-hover:text-slate-300 transition">Browse Backgrounds...</span>
                            </button>
                          )}
                        </div>

                        {/* Scaling mode */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500">Scaling Mode</span>
                          <div className="flex rounded-lg bg-slate-950/60 p-0.5 border border-slate-800/80">
                            {['fill', 'fit', 'stretch'].map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => handleUpdateRoomSettings({ backgroundMode: mode })}
                                className={`flex-1 py-1 text-[9px] font-bold rounded-md capitalize transition cursor-pointer ${
                                  roomSettings.backgroundMode === mode
                                    ? 'bg-slate-800 text-sky-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                {mode}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <hr className="border-slate-800/60" />

                  {/* Grid section */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grid Overlay</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateRoomSettings({ showGrid: !roomSettings.showGrid })}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                          roomSettings.showGrid ? 'bg-sky-500' : 'bg-slate-800'
                        }`}
                        title="Toggle Grid Overlay"
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                            roomSettings.showGrid ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {roomSettings.showGrid && (
                      <div className="space-y-2.5 animate-in fade-in duration-200">
                        {/* Grid Type */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500">Pattern Variant</span>
                          <div className="flex rounded-lg bg-slate-950/60 p-0.5 border border-slate-800/80">
                            {['square', 'hexagon'].map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => handleUpdateRoomSettings({ gridType: type })}
                                className={`flex-1 py-1 text-[9px] font-bold rounded-md capitalize transition cursor-pointer ${
                                  roomSettings.gridType === type
                                    ? 'bg-slate-800 text-sky-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Grid Size */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>Grid Spacing</span>
                            <span className="font-mono text-slate-300">{roomSettings.gridSize}px</span>
                          </div>
                          <input
                            type="range"
                            min="15"
                            max="150"
                            value={roomSettings.gridSize}
                            onChange={(e) => handleUpdateRoomSettings({ gridSize: parseInt(e.target.value, 10) })}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
        </aside>

        {/* Center Canvas Area */}
        <main className="flex-1 p-5 flex flex-col overflow-hidden relative gap-4">
          {/* Collaborative Canvas Tabs Bar */}
          <div className="flex items-center justify-between backdrop-blur-md bg-slate-900/30 border border-slate-800/80 rounded-xl p-1.5 shadow-lg z-20 overflow-hidden">
            <div className="flex items-center gap-2 overflow-x-auto flex-1 mr-4 py-0.5 scrollbar-none">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                const tabUsers = users.filter((u) => (u.activeTabId || 'tab-default') === tab.id);

                return (
                  <TabButton
                    key={tab.id}
                    tab={tab}
                    isActive={isActive}
                    tabUsers={tabUsers}
                    onSwitch={handleSwitchTab}
                    onDelete={handleDeleteTab}
                    onRename={handleRenameTab}
                    isDeleteDisabled={tabs.length <= 1}
                  />
                );
              })}
            </div>
            
            <button
              onClick={handleCreateTab}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 text-sky-400 hover:text-sky-300 rounded-lg transition active:scale-95 flex items-center justify-center cursor-pointer shadow-md border border-slate-700/50 flex-shrink-0"
              title="Create New Canvas"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>

          <div className="flex-1 min-h-0 relative">
            {/* Floating Toolbar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
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

              {/* Slide-out sub-toolbar when Eraser Tool is active */}
              {activeTool === 'eraser' && (
                <div className="backdrop-blur-md bg-slate-900/70 border border-slate-800 rounded-2xl px-4 py-2 shadow-2xl flex items-center gap-4 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400 select-none">Eraser Size</span>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={eraserSize}
                      onChange={(e) => setEraserSize(parseInt(e.target.value, 10))}
                      className="w-24 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                    <span className="text-[10px] font-mono text-slate-400 select-none w-8 text-right">
                      {eraserSize}px
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
              eraserSize={eraserSize}
              roomSettings={roomSettings}
              tabId={activeTabId}
            />
          </div>
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
                      {/* Active Tab Badge */}
                      <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-medium truncate max-w-[80px]" title={`On ${(() => {
                        const userTabId = user.activeTabId || 'tab-default';
                        const tab = tabs.find((t) => t.id === userTabId);
                        return tab ? tab.name : 'Canvas';
                      })()}`}>
                        {(() => {
                          const userTabId = user.activeTabId || 'tab-default';
                          const tab = tabs.find((t) => t.id === userTabId);
                          return tab ? tab.name : 'Canvas';
                        })()}
                      </span>
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


              {/* Layer Order Controls */}
              <div className="border-t border-slate-800/80 pt-3">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Layer Order
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => adjustSelectedElementsLayer('forward')}
                    className="py-1.5 px-2 rounded-lg bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    title="Bring Forward"
                  >
                    ▲ Bring Forward
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustSelectedElementsLayer('backward')}
                    className="py-1.5 px-2 rounded-lg bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    title="Send Backward"
                  >
                    ▼ Send Backward
                  </button>
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
                {[...elements].reverse().map((el) => {
                  const lockHolderId = locks[el.id];
                  const isLocked = !!lockHolderId;
                  const lockHolder = isLocked ? users.find((u) => u.id === lockHolderId) : null;
                  const isLockedByOther = isLocked && lockHolderId !== currentUser?.id;
                  const isSelected = selectedElementIds.includes(el.id);
                  const shapeName = el.type.charAt(0).toUpperCase() + el.type.slice(1);

                  const originalIndex = elements.findIndex((item) => item.id === el.id);
                  const isFirst = originalIndex === elements.length - 1; // front-most (top of stack)
                  const isLast = originalIndex === 0; // back-most (bottom of stack)

                  const isDragging = draggedElementId === el.id;
                  const isDragOver = dragOverElementId === el.id;

                  return (
                    <div
                      key={el.id}
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, el.id)}
                      onDragOver={(e) => handleDragOver(e, el.id)}
                      onDragLeave={handleDragLeave}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, el.id)}
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
                      className={`p-2.5 rounded-xl flex flex-col gap-1.5 transition cursor-grab active:cursor-grabbing select-none ${
                        isSelected
                          ? 'bg-sky-500/10 border border-sky-500/80 shadow-md shadow-sky-500/5'
                          : 'bg-slate-900/40 border border-slate-800/50 hover:border-slate-800'
                      } ${isDragging ? 'opacity-40' : ''} ${
                        isDragOver ? 'border-dashed border-sky-400 bg-sky-500/5 scale-[1.02]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="text-slate-600 hover:text-slate-400 cursor-grab text-[10px] select-none mr-0.5">
                            ⋮⋮
                          </div>
                          <div
                            className="w-3.5 h-3.5 rounded border border-slate-700 flex items-center justify-center text-[9px]"
                          >
                            {el.type === 'circle' ? '⚪' : el.type === 'image' ? '🖼️' : '🟦'}
                          </div>
                          <span className="text-xs font-bold text-slate-300">
                            {shapeName}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustElementLayer(el.id, 'forward');
                            }}
                            className={`w-5 h-5 rounded flex items-center justify-center text-[9px] border transition active:scale-95 cursor-pointer ${
                              isFirst
                                ? 'border-slate-800 text-slate-700 cursor-not-allowed bg-slate-950/20'
                                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-800'
                            }`}
                            title="Bring Forward"
                            draggable="false"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustElementLayer(el.id, 'backward');
                            }}
                            className={`w-5 h-5 rounded flex items-center justify-center text-[9px] border transition active:scale-95 cursor-pointer ${
                              isLast
                                ? 'border-slate-800 text-slate-700 cursor-not-allowed bg-slate-950/20'
                                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-800'
                            }`}
                            title="Send Backward"
                            draggable="false"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            disabled={isLockedByOther}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSelectionLock(el.id);
                            }}
                            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] border transition active:scale-95 cursor-pointer ${
                              isLockedByOther
                                ? 'border-slate-800/40 text-slate-700 cursor-not-allowed bg-slate-950/10'
                                : el.properties?.locked
                                ? 'border-amber-500/35 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 shadow-sm shadow-amber-500/5'
                                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-800'
                            }`}
                            title={isLockedByOther ? "Cannot lock/unlock: currently being edited" : el.properties?.locked ? "Click to unlock selection on canvas" : "Click to lock selection on canvas (Sidebar only)"}
                            draggable="false"
                          >
                            {el.properties?.locked ? '🔒' : '🔓'}
                          </button>
                          <span className="text-[10px] text-slate-500 font-mono ml-1">
                            X:{el.x} Y:{el.y}
                          </span>
                        </div>
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
                            🔒 Editing: Locked by{' '}
                            <span
                              style={{ color: lockHolder?.color }}
                              className="font-extrabold"
                            >
                              {lockHolder?.name || 'Unknown'}
                            </span>
                          </span>
                        </div>
                      ) : el.properties?.locked ? (
                        <div className="flex items-center justify-between border border-amber-500/25 bg-amber-500/5 rounded-lg px-2 py-1 text-[9px] text-amber-400">
                          <span className="flex items-center gap-1">
                            🔒 Canvas Selection Locked (Sidebar Select Only)
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
                          type="button"
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
                          draggable="false"
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

      {/* Background Selection Modal Overlay */}
      {isBgModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsBgModalOpen(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 w-full max-w-5xl h-[80vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left section: Scrollable asset browser (2/3 width) */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-slate-800">
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    🖼️ Canvas Backgrounds
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Select a custom uploaded asset or preset scene to apply to the collaborative room.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBgModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Asset grid sections */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {/* 1. Custom Uploaded Assets */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                      📤 Your Uploaded Assets
                    </h3>
                    <span className="text-[10px] bg-sky-500/10 text-sky-400 font-bold px-2 py-0.5 rounded-full border border-sky-500/20">
                      {assets.length} Uploads
                    </span>
                  </div>

                  {assets.length === 0 ? (
                    <div className="py-8 text-center bg-slate-950/20 rounded-xl border border-dashed border-slate-800 p-6">
                      <p className="text-xs text-slate-500 italic">No custom uploaded images yet.</p>
                      <p className="text-[10px] text-slate-600 mt-1">Upload images using the "Spawn Image Assets" section in the left panel.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {assets.map((asset) => {
                        const isSelected = selectedBgPreviewAsset?.url === asset.url;
                        const isActive = roomSettings.backgroundImageUrl === asset.url;
                        return (
                          <div
                            key={asset.id}
                            onClick={() => setSelectedBgPreviewAsset({ ...asset, isPreset: false })}
                            className={`group rounded-xl overflow-hidden bg-slate-950/40 border transition duration-200 cursor-pointer flex flex-col ${
                              isSelected
                                ? 'border-sky-500 ring-2 ring-sky-500/20'
                                : 'border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="aspect-video w-full bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-800/80">
                              <img
                                src={asset.url}
                                alt={asset.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                              {isActive && (
                                <div className="absolute top-2 right-2 bg-emerald-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg border border-emerald-400 font-bold text-xs" title="Active background">
                                  ✓
                                </div>
                              )}
                            </div>
                            <div className="p-3 flex-1 flex flex-col justify-center min-w-0">
                              <div className="text-xs font-bold text-slate-200 truncate">{asset.name}</div>
                              <div className="text-[9px] text-slate-500 mt-0.5 truncate">{asset.url}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Preset Backgrounds (Less Prominent) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      🎨 Preset Backgrounds
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {SAMPLE_IMAGES.map((img, index) => {
                      const isSelected = selectedBgPreviewAsset?.url === img.url;
                      const isActive = roomSettings.backgroundImageUrl === img.url;
                      return (
                        <div
                          key={`preset_${index}`}
                          onClick={() => setSelectedBgPreviewAsset({ id: `preset_${index}`, name: img.name, url: img.url, isPreset: true })}
                          className={`group rounded-lg overflow-hidden bg-slate-950/20 border transition duration-200 cursor-pointer flex flex-col ${
                            isSelected
                              ? 'border-sky-500/80 ring-1 ring-sky-500/20'
                              : 'border-slate-800/80 hover:border-slate-700/80'
                          }`}
                        >
                          <div className="h-16 w-full bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-900">
                            <img
                              src={img.url}
                              alt={img.name}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            {isActive && (
                              <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-white w-4 h-4 rounded-full flex items-center justify-center shadow border border-emerald-400 font-bold text-[9px]">
                                ✓
                              </div>
                            )}
                          </div>
                          <div className="p-2 flex-1 flex flex-col justify-center min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 group-hover:text-slate-300 truncate">{img.name}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right section: Detail Preview Panel (1/3 width) */}
            <div className="w-full md:w-80 bg-slate-900/60 p-6 flex flex-col justify-between">
              {selectedBgPreviewAsset ? (
                <div className="flex-1 flex flex-col justify-between min-h-0">
                  <div className="space-y-5">
                    <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      Preview Details
                    </span>

                    {/* High-fidelity preview image */}
                    <div className="aspect-video w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner relative flex items-center justify-center">
                      <img
                        src={selectedBgPreviewAsset.url}
                        alt={selectedBgPreviewAsset.name}
                        className="w-full h-full object-contain"
                      />
                      {roomSettings.backgroundImageUrl === selectedBgPreviewAsset.url && (
                        <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[1px] flex items-center justify-center">
                          <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg border border-emerald-400 flex items-center gap-1">
                            ✓ Currently Active
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Asset Name</label>
                      <h4 className="text-base font-bold text-slate-200 truncate">{selectedBgPreviewAsset.name}</h4>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Origin</label>
                      <div>
                        {selectedBgPreviewAsset.isPreset ? (
                          <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                            Preset Background
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full">
                            User Uploaded
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Source URL</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          readOnly
                          value={selectedBgPreviewAsset.url}
                          className="flex-1 bg-slate-950 border border-slate-800/80 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedBgPreviewAsset.url);
                          }}
                          className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 hover:border-slate-600 rounded-lg text-[10px] font-bold transition active:scale-95 cursor-pointer"
                          title="Copy URL"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mt-6">
                    {roomSettings.backgroundImageUrl === selectedBgPreviewAsset.url ? (
                      <button
                        type="button"
                        onClick={() => {
                          handleUpdateRoomSettings({ backgroundImageUrl: null });
                          setSelectedBgPreviewAsset(null);
                        }}
                        className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-xs text-rose-400 font-bold rounded-xl transition cursor-pointer active:scale-95"
                      >
                        Clear Background
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          handleUpdateRoomSettings({ backgroundImageUrl: selectedBgPreviewAsset.url, showBackground: true });
                        }}
                        className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-sky-500/15 cursor-pointer active:scale-95"
                      >
                        Set as Canvas Background
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
                  <span className="text-3xl mb-2">👈</span>
                  <h4 className="text-xs font-bold text-slate-400">No Asset Selected</h4>
                  <p className="text-[10px] text-slate-500 max-w-[180px] mt-1 leading-relaxed">
                    Click any thumbnail on the left to preview details and set it as the canvas background.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
