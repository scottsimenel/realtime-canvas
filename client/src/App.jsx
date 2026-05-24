import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import Canvas from './components/Canvas';
import DiceEffects from './components/DiceEffects';

const SOCKET_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000')
  : window.location.origin;

const getFullUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${SOCKET_URL}${path}`;
};

const DieIcon = ({ type, value, size = 'w-12 h-12', className = '', isKept = true, isDiscarded = false, userColor = null }) => {
  let fillClass = 'fill-slate-950/80';
  let strokeClass = 'stroke-slate-700/80';
  let textClass = 'fill-slate-200';

  if (isDiscarded) {
    fillClass = 'fill-slate-950/20';
    strokeClass = 'stroke-slate-900';
    textClass = 'fill-slate-600 line-through';
  } else if (isKept) {
    if (userColor) {
      fillClass = 'fill-slate-950/70';
      // Convert hex userColor to stroke
      strokeClass = ''; 
    } else {
      fillClass = 'fill-slate-950/80';
    }
  }

  let path = '';
  let textY = '55';

  switch (type) {
    case 4: // Tetrahedron (Triangle)
      path = 'M 50,10 L 92,86 L 8,86 Z';
      textY = '64';
      break;
    case 6: // Cube (Square)
      path = 'M 20,10 H 80 A 10,10 0 0 1 90,20 V 80 A 10,10 0 0 1 80,90 H 20 A 10,10 0 0 1 10,80 V 20 A 10,10 0 0 1 20,10 Z';
      textY = '56';
      break;
    case 8: // Octahedron (Diamond)
      path = 'M 50,8 L 92,50 L 50,92 L 8,50 Z';
      textY = '56';
      break;
    case 10: // Decahedron (Kite)
      path = 'M 50,8 L 88,38 L 50,92 L 12,38 Z';
      textY = '54';
      break;
    case 12: // Dodecahedron (Pentagon)
      path = 'M 50,8 L 92,38 L 76,88 L 24,88 L 8,38 Z';
      textY = '57';
      break;
    case 20: // Icosahedron (Hexagon)
      path = 'M 50,8 L 88,30 V 70 L 50,92 L 12,70 V 30 Z';
      textY = '56';
      break;
    case 100: // Zocchihedron (Circle)
    default:
      path = 'M 50,50 m -42,0 a 42,42 0 1,0 84,0 a 42,42 0 1,0 -84,0';
      textY = '56';
      break;
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={`${size} ${className}`}
      style={{ overflow: 'visible' }}
    >
      <path
        d={path}
        className={`${fillClass} ${strokeClass} transition-all duration-300`}
        style={strokeClass === '' ? { stroke: userColor || '#4f46e5' } : {}}
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <text
        x="50"
        y={textY}
        textAnchor="middle"
        dominantBaseline="middle"
        className={`${textClass} font-mono font-black text-[35px] transition-all duration-300`}
        style={isDiscarded ? { textDecoration: 'line-through' } : {}}
      >
        {value}
      </text>
    </svg>
  );
};

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

function TooltipInspector({ element, onChange }) {
  const tooltip = element.properties?.tooltip || {
    enabled: false,
    title: '',
    trackers: [],
    stats: [],
  };

  // Local state for buffered title input to prevent WebSocket typing lag
  const [prevElementId, setPrevElementId] = useState(element.id);
  const [prevTitle, setPrevTitle] = useState(tooltip.title);
  const [localTitle, setLocalTitle] = useState(tooltip.title || '');

  if (element.id !== prevElementId || tooltip.title !== prevTitle) {
    setPrevElementId(element.id);
    setPrevTitle(tooltip.title);
    setLocalTitle(tooltip.title || '');
  }

  const [quickAdjustValues, setQuickAdjustValues] = useState({}); // trackerId -> string

  const updateTooltip = (updatedFields) => {
    const newTooltip = {
      ...tooltip,
      ...updatedFields,
    };
    onChange({
      properties: {
        ...element.properties,
        tooltip: newTooltip,
      },
    });
  };

  const handleTitleBlur = () => {
    if (localTitle !== tooltip.title) {
      updateTooltip({ title: localTitle });
    }
  };

  const handleToggleEnabled = (e) => {
    updateTooltip({ enabled: e.target.checked });
  };

  // Trackers CRUD
  const handleAddTracker = () => {
    const newTracker = {
      id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: 'HP',
      value: 10,
      max: 10,
      color: 'red',
      showOnCanvas: true,
    };
    updateTooltip({
      trackers: [...(tooltip.trackers || []), newTracker],
    });
  };

  const handleUpdateTracker = (trackerId, updates) => {
    const updatedTrackers = (tooltip.trackers || []).map((t) => {
      if (t.id === trackerId) {
        return { ...t, ...updates };
      }
      return t;
    });
    updateTooltip({ trackers: updatedTrackers });
  };

  const handleRemoveTracker = (trackerId) => {
    const updatedTrackers = (tooltip.trackers || []).filter((t) => t.id !== trackerId);
    updateTooltip({ trackers: updatedTrackers });
  };

  const handleQuickAdjust = (trackerId, type) => {
    const adjustStr = quickAdjustValues[trackerId] || '';
    const adjustVal = parseInt(adjustStr, 10);
    if (isNaN(adjustVal)) return;

    const tracker = (tooltip.trackers || []).find((t) => t.id === trackerId);
    if (!tracker) return;

    let newValue = tracker.value;
    if (type === 'damage') {
      newValue = Math.max(0, tracker.value - adjustVal);
    } else if (type === 'heal') {
      newValue = Math.min(tracker.max, tracker.value + adjustVal);
    }

    handleUpdateTracker(trackerId, { value: newValue });
    setQuickAdjustValues((prev) => ({ ...prev, [trackerId]: '' }));
  };

  // Stats CRUD
  const handleAddStat = () => {
    const newStat = {
      id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: 'AC',
      value: '10',
    };
    updateTooltip({
      stats: [...(tooltip.stats || []), newStat],
    });
  };

  const handleUpdateStat = (statId, updates) => {
    const updatedStats = (tooltip.stats || []).map((s) => {
      if (s.id === statId) {
        return { ...s, ...updates };
      }
      return s;
    });
    updateTooltip({ stats: updatedStats });
  };

  const handleRemoveStat = (statId) => {
    const updatedStats = (tooltip.stats || []).filter((s) => s.id !== statId);
    updateTooltip({ stats: updatedStats });
  };

  return (
    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 select-none">
          <span>💬</span> Tooltip & Stats
        </h2>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={tooltip.enabled}
            onChange={handleToggleEnabled}
            className="sr-only peer"
          />
          <div className="w-7 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-500 peer-checked:after:bg-white"></div>
        </label>
      </div>

      {tooltip.enabled && (
        <div className="space-y-4">
          {/* Title / Name */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 select-none">
              Tooltip Title / Character Name
            </label>
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="e.g. Grog the Barbarian"
              className="w-full px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
            />
          </div>

          <hr className="border-slate-800/40" />

          {/* Trackers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between select-none">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Numerical Trackers (e.g. HP)
              </label>
              <button
                type="button"
                onClick={handleAddTracker}
                className="text-[10px] text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 transition cursor-pointer"
              >
                ＋ Add Bar
              </button>
            </div>

            <div className="space-y-3">
              {(tooltip.trackers || []).map((tracker) => {
                const colors = ['red', 'green', 'blue', 'amber', 'purple', 'rose'];
                return (
                  <div key={tracker.id} className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={tracker.label}
                        onChange={(e) => handleUpdateTracker(tracker.id, { label: e.target.value })}
                        placeholder="Label (e.g. HP)"
                        className="w-20 px-2 py-1 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={tracker.value}
                          onChange={(e) => handleUpdateTracker(tracker.id, { value: parseInt(e.target.value, 10) || 0 })}
                          className="w-12 px-1 py-1 bg-slate-900 border border-slate-800 rounded-md text-xs text-center text-slate-200 focus:outline-none focus:border-sky-500"
                          placeholder="Val"
                        />
                        <span className="text-slate-600 text-xs select-none">/</span>
                        <input
                          type="number"
                          value={tracker.max}
                          onChange={(e) => handleUpdateTracker(tracker.id, { max: parseInt(e.target.value, 10) || 0 })}
                          className="w-12 px-1 py-1 bg-slate-900 border border-slate-800 rounded-md text-xs text-center text-slate-200 focus:outline-none focus:border-sky-500"
                          placeholder="Max"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTracker(tracker.id)}
                        className="text-slate-600 hover:text-rose-400 transition cursor-pointer text-xs"
                        title="Remove Tracker"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Color Dots & Show on Canvas Checkbox */}
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        {colors.map((c) => {
                          const colorMap = {
                            red: 'bg-red-500',
                            green: 'bg-emerald-500',
                            blue: 'bg-blue-500',
                            amber: 'bg-amber-500',
                            purple: 'bg-purple-500',
                            rose: 'bg-rose-500',
                          };
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleUpdateTracker(tracker.id, { color: c })}
                              className={`w-3.5 h-3.5 rounded-full ${colorMap[c]} border transition cursor-pointer hover:scale-110 ${
                                tracker.color === c ? 'border-white scale-110' : 'border-transparent'
                              }`}
                              title={c}
                            />
                          );
                        })}
                      </div>
                      
                      <label className="flex items-center gap-1 text-slate-400 cursor-pointer hover:text-slate-300 select-none">
                        <input
                          type="checkbox"
                          checked={!!tracker.showOnCanvas}
                          onChange={(e) => handleUpdateTracker(tracker.id, { showOnCanvas: e.target.checked })}
                          className="rounded border-slate-800 bg-slate-900 text-sky-500 focus:ring-0 focus:ring-offset-0"
                        />
                        <span>On Canvas</span>
                      </label>
                    </div>

                    {/* Quick Adjuster Math */}
                    <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-900/60 select-none">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Quick Adjust</span>
                        <input
                          type="number"
                          min="1"
                          value={quickAdjustValues[tracker.id] || ''}
                          onChange={(e) => setQuickAdjustValues((prev) => ({ ...prev, [tracker.id]: e.target.value }))}
                          placeholder="Qty"
                          className="w-16 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] text-center text-slate-200 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickAdjust(tracker.id, 'damage')}
                          className="flex-1 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold transition cursor-pointer active:scale-95 text-center"
                        >
                          Damage (-)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAdjust(tracker.id, 'heal')}
                          className="flex-1 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold transition cursor-pointer active:scale-95 text-center"
                        >
                          Heal (+)
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-800/40" />

          {/* Stats Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between select-none">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Attributes (e.g. AC, Status)
              </label>
              <button
                type="button"
                onClick={handleAddStat}
                className="text-[10px] text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 transition cursor-pointer"
              >
                ＋ Add Stat
              </button>
            </div>

            <div className="space-y-2">
              {(tooltip.stats || []).map((stat) => (
                <div key={stat.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={stat.label}
                    onChange={(e) => handleUpdateStat(stat.id, { label: e.target.value })}
                    placeholder="Stat (e.g. AC)"
                    className="flex-1 min-w-0 px-2 py-1 bg-slate-950/80 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition"
                  />
                  <input
                    type="text"
                    value={stat.value}
                    onChange={(e) => handleUpdateStat(stat.id, { value: e.target.value })}
                    placeholder="Value (e.g. 16)"
                    className="flex-1 min-w-0 px-2 py-1 bg-slate-950/80 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveStat(stat.id)}
                    className="text-slate-600 hover:text-rose-400 transition cursor-pointer text-xs"
                    title="Remove Stat"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
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
        showGrid: true,
        gridType: 'square',
        gridSize: 40,
        customBackgroundWidth: null,
        customBackgroundHeight: null,
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
      showGrid: true,
      gridType: 'square',
      gridSize: 40,
      customBackgroundWidth: null,
      customBackgroundHeight: null,
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
  const [activeVirtualDimensions, setActiveVirtualDimensions] = useState({ width: 1920, height: 1080 });

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

  // Dice Roller States
  const [mixedDice, setMixedDice] = useState({ d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d100: 0 });
  const [d20Count, setD20Count] = useState(1);
  const [d20Mode, setD20Mode] = useState('normal');
  const [activeRolls, setActiveRolls] = useState([]);
  const [rollHistory, setRollHistory] = useState([]);
  const [isDiceSectionCollapsed, setIsDiceSectionCollapsed] = useState(false);
  const [enable3dDice, setEnable3dDice] = useState(true);
  const [isUsersSectionCollapsed, setIsUsersSectionCollapsed] = useState(false);
  const [rollTick, setRollTick] = useState(0);
  const [hoveredRoll, setHoveredRoll] = useState(null);
  const [showCursorNames, setShowCursorNames] = useState(() => {
    try {
      const saved = localStorage.getItem('canvas_show_cursor_names');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('canvas_show_cursor_names', JSON.stringify(showCursorNames));
    } catch (e) {
      console.error(e);
    }
  }, [showCursorNames]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRollTick((prev) => (prev + 1) % 100);
    }, 60);
    return () => clearInterval(interval);
  }, []);

  // Layout Panel Visibility States
  const [showHeader, setShowHeader] = useState(true);
  const [showLeftSidebar, setShowLeftSidebar] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [showRightSidebar, setShowRightSidebar] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [showTabsBar, setShowTabsBar] = useState(true);
  const [leftPanelTab, setLeftPanelTab] = useState('shapes'); // 'shapes' | 'images' | 'canvas'
  const [showDiceRoller, setShowDiceRoller] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  const isZenMode = !showHeader && !showLeftSidebar && !showRightSidebar && !showTabsBar;

  const handleToggleZenMode = useCallback(() => {
    const nextState = isZenMode;
    setShowHeader(nextState);
    setShowLeftSidebar(nextState);
    setShowRightSidebar(nextState);
    setShowTabsBar(nextState);
    setLeftPanelCollapsed(false);
    setRightPanelCollapsed(false);
  }, [isZenMode]);

  const handleCanvasInteraction = useCallback((clickedEmptySpace) => {
    if (clickedEmptySpace) {
      if (showLeftSidebar) setLeftPanelCollapsed(true);
      if (showRightSidebar) setRightPanelCollapsed(true);
    } else {
      if (showLeftSidebar) setLeftPanelCollapsed(true);
      setShowRightSidebar(true);
      setRightPanelCollapsed(false);
    }
  }, [showLeftSidebar, showRightSidebar]);

  // Auto-expand Right Inspector and collapse Left panel when elements are selected (drag-select, click, etc.)
  useEffect(() => {
    if (selectedElementIds.length > 0) {
      if (showLeftSidebar) setLeftPanelCollapsed(true);
      setShowRightSidebar(true);
      setRightPanelCollapsed(false);
    }
  }, [selectedElementIds, showLeftSidebar]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === '\\') {
        const activeEl = document.activeElement;
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.isContentEditable
        );
        if (!isInput) {
          e.preventDefault();
          handleToggleZenMode();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleToggleZenMode]);

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

    s.on('dice-rolled', (roll) => {
      setActiveRolls((prev) => [...prev, { ...roll, status: 'rolling' }]);

      setTimeout(() => {
        setActiveRolls((prev) =>
          prev.map((r) => (r.rollId === roll.rollId ? { ...r, status: 'resolved' } : r))
        );
        setRollHistory((prev) => [roll, ...prev].slice(0, 15));
      }, 1500);

      setTimeout(() => {
        setActiveRolls((prev) => prev.filter((r) => r.rollId !== roll.rollId));
      }, 5000);
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
      const el = elements.find((item) => item.id === id);
      if (!el || el.properties?.locked) return false;
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
  }, [selectedElementIds, elements, locks, currentUser]);

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

  const handleRollDice = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const diceGroups = Object.entries(mixedDice)
      .map(([key, val]) => ({
        type: parseInt(key.substring(1), 10),
        count: val
      }))
      .filter((g) => g.count > 0);

    socket.emit('dice-roll', {
      d20: {
        count: d20Count,
        mode: d20Mode
      },
      dice: diceGroups
    });
  }, [mixedDice, d20Count, d20Mode]);

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



  // Lobby (Join Screen)
  if (!joined) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-[#070b13] relative overflow-y-auto min-h-full">
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

  // Helper render functions for Figma-style floating panels
  const renderActiveUsers = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-1 text-left cursor-pointer select-none">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <span>👥 Active Users</span>
          </h2>
          <span className="text-[11px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/25">
            {users.length}
          </span>
        </div>
        <div className="space-y-2 pt-1 max-h-72 overflow-y-auto custom-scrollbar">
          {users.map((user) => {
            const isMe = user.id === currentUser?.id;
            const isUserActive = user.x !== 0 || user.y !== 0;

            return (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-900/60 hover:border-slate-800 transition"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full border border-white/10"
                    style={{ backgroundColor: user.color }}
                  />
                  <span className="text-sm font-semibold text-slate-300 truncate max-w-[120px]">
                    {user.name}
                    {isMe && <span className="text-xs font-normal text-slate-500 ml-1">(you)</span>}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Active Tab Badge */}
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-medium truncate max-w-[80px]" title={`On ${(() => {
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
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
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
    );
  };

  const renderElementsAndLocks = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/85 pb-2">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <span>Layers & locks</span>
          </h2>
          <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700/50 font-bold px-2 py-0.5 rounded-full">
            {elements.length} items
          </span>
        </div>

        {elements.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6 bg-slate-900/20 rounded-xl border border-dashed border-slate-800">
            No items on canvas. Use the left panel to spawn something.
          </p>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
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
                  className={`p-3 rounded-xl flex flex-col gap-2 transition cursor-grab active:cursor-grabbing select-none ${
                    isSelected
                      ? 'bg-sky-500/10 border border-sky-500/80 shadow-md shadow-sky-500/5'
                      : 'bg-slate-900/40 border border-slate-800/50 hover:border-slate-800'
                  } ${isDragging ? 'opacity-40' : ''} ${
                    isDragOver ? 'border-dashed border-sky-400 bg-sky-500/5 scale-[1.02]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-slate-600 hover:text-slate-400 cursor-grab text-[13px] select-none mr-0.5">
                        ⋮⋮
                      </div>
                      <div className="w-5 h-5 rounded border border-slate-750 flex items-center justify-center text-xs">
                        {el.type === 'circle' ? '⚪' : el.type === 'image' ? '🖼️' : '🟦'}
                      </div>
                      <span className="text-xs font-bold text-slate-350">
                        {shapeName}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustElementLayer(el.id, 'forward');
                        }}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs border transition active:scale-95 cursor-pointer ${
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
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs border transition active:scale-95 cursor-pointer ${
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
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs border transition active:scale-95 cursor-pointer ${
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
                      <span className="text-[10px] text-slate-550 font-mono ml-1">
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
                      className="flex items-center justify-between border rounded-lg px-2.5 py-1 text-xs"
                    >
                      <span className="text-slate-400 flex items-center gap-1.5">
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
                    <div className="flex items-center justify-between border border-amber-500/25 bg-amber-500/5 rounded-lg px-2.5 py-1 text-xs text-amber-400">
                      <span className="flex items-center gap-1">
                        🔒 Canvas Selection Locked
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between border border-slate-800/80 bg-slate-950/20 rounded-lg px-2.5 py-1 text-xs text-slate-500">
                      <span>🔓 Unlocked & Editable</span>
                    </div>
                  )}

                  {/* Delete Element Button */}
                  {isSelected && !isLockedByOther && !el.properties?.locked && (
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
                      className="mt-1 w-full py-2 px-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-xs text-rose-400 font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
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
    );
  };

  const renderInspector = () => {
    if (selectedElementIds.length === 0) return null;
    const selectedEl = elements.find((el) => el.id === selectedElementIds[0]);

    return (
      <div className="space-y-5">
        <div className="p-4.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest">
              Inspector
            </h2>
            <span className="text-xs bg-sky-500/10 text-sky-400 font-bold px-2.5 py-0.5 rounded-full border border-sky-500/25">
              {selectedElementIds.length} Selected
            </span>
          </div>

          {/* Width & Height Inputs */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 select-none">
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
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-205 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 select-none">
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
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-205 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
              />
            </div>
          </div>

          {/* Rotation Control */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                Rotation
              </label>
              <span className="text-xs font-mono text-slate-400">
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
            <div className="flex items-center gap-3">
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
                className="w-16 px-2 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-center text-slate-205 focus:outline-none focus:border-sky-500 transition"
              />
            </div>
          </div>

          {/* Layer Order Controls */}
          <div className="border-t border-slate-800/85 pt-3 space-y-2">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
              Layer Order
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => adjustSelectedElementsLayer('forward')}
                className="py-2 px-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                title="Bring Forward"
              >
                ▲ Bring Forward
              </button>
              <button
                type="button"
                onClick={() => adjustSelectedElementsLayer('backward')}
                className="py-2 px-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                title="Send Backward"
              >
                ▼ Send Backward
              </button>
            </div>
          </div>

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDeleteSelected}
            className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/35 hover:border-rose-500/60 text-xs text-rose-450 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
          >
            🗑️ Delete Selected
          </button>
        </div>

        {selectedElementIds.length === 1 && selectedEl && ['rectangle', 'circle', 'image'].includes(selectedEl.type) && (
          <TooltipInspector
            element={selectedEl}
            onChange={handleInspectorChange}
          />
        )}
      </div>
    );
  };

  // Dashboard (Canvas Board Workspace)
  return (
    <div className="flex-1 flex flex-col bg-[#070b13] overflow-hidden text-slate-100 h-full">
      {/* Header */}
      <header className={`transition-all duration-300 ease-in-out overflow-hidden flex items-center justify-between z-10 ${
        showHeader
          ? 'h-16 px-4 sm:px-6 border-b border-slate-800/80 bg-slate-900/30 backdrop-blur-md opacity-100'
          : 'h-0 py-0 px-6 border-b-0 opacity-0 pointer-events-none'
      }`}>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20 shrink-0">
            AG
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-200 line-clamp-1">
              Antigravity Canvas
            </h1>
            <p className="text-[10px] text-slate-500 font-mono">
              Room: <span className="text-indigo-400">{roomIdInput}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-5">
          {/* Connection status badge */}
          <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-800/60 text-xs">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="font-semibold text-slate-300 hidden sm:inline">
              {connected ? 'Live Syncing' : 'Reconnecting'}
            </span>
          </div>

          {/* User count badge */}
          <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-800/60 text-xs text-slate-300">
            👥 <span className="font-bold">{users.length}</span><span className="hidden sm:inline"> online</span>
          </div>

          {/* User profile capsule */}
          <div className="flex items-center gap-2.5 pl-2.5 sm:pl-3 border-l border-slate-800">
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm shrink-0"
              style={{ backgroundColor: currentUser?.color }}
            />
            <span className="font-semibold text-sm text-slate-200 hidden sm:inline">{currentUser?.name}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Backdrop for Left Sidebar */}
        {showLeftSidebar && (
          <div
            onClick={() => setShowLeftSidebar(false)}
            className="lg:hidden fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-35 cursor-pointer"
          />
        )}
        
        {/* Mobile Backdrop for Right Sidebar */}
        {showRightSidebar && (
          <div
            onClick={() => setShowRightSidebar(false)}
            className="lg:hidden fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-35 cursor-pointer"
          />
        )}

        {/* Left Library Floating Panel */}
        <aside 
          className={`group fixed left-6 top-24 bottom-28 w-80 z-40 flex flex-col bg-slate-950/80 backdrop-blur-md border border-slate-850 rounded-2xl p-5 shadow-2xl overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out select-none ${
            showLeftSidebar
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 -translate-x-10 scale-95 pointer-events-none'
          } ${
            leftPanelCollapsed ? '-translate-x-[calc(100%+12px)] opacity-40 hover:opacity-100 hover:border-sky-500/50 cursor-pointer' : 'translate-x-0'
          }`}
          onMouseEnter={leftPanelCollapsed ? () => setLeftPanelCollapsed(false) : undefined}
        >
          {/* Collapsed Indicator Strip */}
          {leftPanelCollapsed && (
            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-sky-500/50 group-hover:bg-sky-500 transition-colors" />
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-sm font-bold text-slate-355 uppercase tracking-widest">
              Library
            </h2>
            <button
              type="button"
              onClick={() => { setShowLeftSidebar(false); setLeftPanelCollapsed(false); }}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg bg-slate-900 border border-slate-800 transition cursor-pointer active:scale-95 flex items-center justify-center animate-in duration-200"
              title="Close Panel"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Library Tabs */}
          <div className="flex rounded-xl bg-slate-900/60 p-1 border border-slate-800/80 mb-4 shrink-0">
            <button
              type="button"
              onClick={() => setLeftPanelTab('shapes')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-205 cursor-pointer ${
                leftPanelTab === 'shapes'
                  ? 'bg-slate-800 text-sky-400 shadow-sm border border-slate-700/50'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Shapes
            </button>
            <button
              type="button"
              onClick={() => setLeftPanelTab('images')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-205 cursor-pointer ${
                leftPanelTab === 'images'
                  ? 'bg-slate-800 text-sky-400 shadow-sm border border-slate-700/50'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Images
            </button>
            <button
              type="button"
              onClick={() => setLeftPanelTab('canvas')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-205 cursor-pointer ${
                leftPanelTab === 'canvas'
                  ? 'bg-slate-800 text-sky-400 shadow-sm border border-slate-700/50'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Canvas
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-5 custom-scrollbar">
            {leftPanelTab === 'shapes' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Quick Spawn Shapes
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleSpawnShape('rectangle', '#3b82f6', '#2563eb')}
                    className="py-3 px-3 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/30 hover:border-blue-500/40 rounded-xl text-blue-450 font-bold text-xs transition flex flex-col items-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <div className="w-8 h-6 bg-blue-500 rounded border border-blue-600" />
                    <span>Blue Rect</span>
                  </button>
                  <button
                    onClick={() => handleSpawnShape('rectangle', '#ef4444', '#dc2626')}
                    className="py-3 px-3 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/30 hover:border-rose-500/40 rounded-xl text-rose-450 font-bold text-xs transition flex flex-col items-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <div className="w-8 h-6 bg-rose-500 rounded border border-rose-600" />
                    <span>Red Rect</span>
                  </button>
                  <button
                    onClick={() => handleSpawnShape('circle', '#10b981', '#059669')}
                    className="py-3 px-3 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 hover:border-emerald-500/40 rounded-xl text-emerald-450 font-bold text-xs transition flex flex-col items-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <div className="w-6 h-6 bg-emerald-500 rounded-full border border-emerald-600" />
                    <span>Green Circle</span>
                  </button>
                  <button
                    onClick={() => handleSpawnShape('circle', '#8b5cf6', '#7c3aed')}
                    className="py-3 px-3 bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/30 hover:border-purple-500/40 rounded-xl text-purple-450 font-bold text-xs transition flex flex-col items-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <div className="w-6 h-6 bg-purple-500 rounded-full border border-purple-600" />
                    <span>Purple Circle</span>
                  </button>
                </div>
              </div>
            )}

            {leftPanelTab === 'images' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Images grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Spawning Images
                    </h3>
                    {visibleAssets.length > 0 && (
                      <span className="text-[10px] bg-slate-800 text-slate-400 font-bold px-2 py-0.5 rounded-full">
                        {visibleAssets.length}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {showHiddenMode 
                      ? 'Click eye to restore image to active panel.' 
                      : 'Click thumbnail to spawn image on board.'}
                  </p>

                  <div className="max-h-72 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                    {showHiddenMode ? (
                      hiddenAssets.length === 0 ? (
                        <p className="text-xs text-slate-600 text-center py-4 italic">No hidden images.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5">
                          {hiddenAssets.map((img) => (
                            <div
                              key={img.id}
                              className="group relative h-20 rounded-xl overflow-hidden border border-rose-950 bg-rose-950/20"
                            >
                              <img
                                src={getFullUrl(img.url)}
                                alt={img.name}
                                className="w-full h-full object-cover opacity-30 grayscale"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex items-end p-2">
                                <span className="text-[10px] font-bold text-rose-350 truncate pr-6">
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
                        <p className="text-xs text-slate-500 text-center py-5 bg-slate-950/20 border border-dashed border-slate-800 rounded-xl animate-in zoom-in-95 duration-200">
                          No visible images. Upload below or restore hidden.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5">
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
                                  src={getFullUrl(img.url)}
                                  alt={img.name}
                                  className="w-full h-full object-cover opacity-60 group-hover:opacity-85 transition duration-300"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex items-end p-2 pointer-events-none">
                                  <span className="text-[10px] font-bold text-slate-300 group-hover:text-white transition truncate pr-6">
                                    {img.name}
                                  </span>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleUpdateRoomSettings({ backgroundImageUrl: img.url, showBackground: true })}
                                className={`absolute top-1.5 left-1.5 w-6 h-6 rounded-lg border text-slate-400 opacity-0 group-hover:opacity-100 flex items-center justify-center active:scale-95 transition cursor-pointer z-10 ${
                                  roomSettings.backgroundImageUrl === img.url
                                    ? 'bg-sky-500 border-sky-400 text-white shadow-sm'
                                    : 'bg-slate-900/90 border-slate-800 hover:bg-slate-800 hover:text-sky-400'
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
                                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-slate-800 hover:text-rose-450 active:scale-95 transition cursor-pointer z-10"
                                title="Hide Image"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.893 7.893L21 21m-4.228-4.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                </svg>
                              </button>

                              {!img.isPreset && (
                                <span className="absolute bottom-1.5 right-1.5 text-[8px] font-bold bg-sky-500/85 text-white px-1.5 py-0.5 rounded-md select-none pointer-events-none shadow-sm">
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
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => setShowHiddenMode(!showHiddenMode)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl transition border cursor-pointer ${
                          showHiddenMode 
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-450 hover:bg-rose-500/20' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                        }`}
                      >
                        {showHiddenMode ? '← Active Images' : `Manage Hidden (${hiddenAssets.length})`}
                      </button>
                      {showHiddenMode && (
                        <button
                          type="button"
                          onClick={() => {
                            setHiddenAssetUrls([]);
                            setShowHiddenMode(false);
                          }}
                          className="text-xs font-bold text-slate-500 hover:text-slate-350 transition cursor-pointer"
                        >
                          Restore All
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Upload Form */}
                <div className="border-t border-slate-800/80 pt-4 space-y-2.5">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
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
                    className="group relative border border-dashed border-slate-800 rounded-xl p-4.5 bg-slate-950/40 text-center hover:border-slate-700 transition cursor-pointer flex flex-col items-center justify-center min-h-[100px]"
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
                        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-sky-400">Uploading images...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <svg
                          className="w-7 h-7 text-slate-500 group-hover:text-slate-400 transition"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span className="text-xs font-bold text-slate-400 group-hover:text-slate-350 transition">
                          Drag images here or browse
                        </span>
                        <span className="text-[10px] text-slate-600 max-w-[200px] leading-tight">PNG, JPG, GIF, WEBP up to 20MB</span>
                      </div>
                    )}
                  </div>
                  {uploadError && (
                    <p className="text-[10px] text-rose-455 font-semibold flex items-center gap-1">
                      ⚠️ {uploadError}
                    </p>
                  )}
                </div>
              </div>
            )}

            {leftPanelTab === 'canvas' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Canvas settings
                </h3>

                {/* Background Image Toggle */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-300">Background Image</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateRoomSettings({ showBackground: !roomSettings.showBackground })}
                      className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                        roomSettings.showBackground ? 'bg-sky-500' : 'bg-slate-800'
                      }`}
                      title="Toggle Background Image"
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                          roomSettings.showBackground ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {roomSettings.showBackground && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      {/* Active Background Status */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Active Background</span>
                          {roomSettings.backgroundImageUrl && (
                            <button
                              type="button"
                              onClick={() => handleUpdateRoomSettings({ backgroundImageUrl: null })}
                              className="text-xs font-bold text-rose-450 hover:text-rose-350 transition cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        {roomSettings.backgroundImageUrl ? (
                          <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950/60 p-2.5 flex items-center gap-3">
                            <div className="w-14 h-10 rounded bg-slate-900 overflow-hidden border border-slate-800 flex-shrink-0">
                              <img
                                src={getFullUrl(roomSettings.backgroundImageUrl)}
                                alt="Active Background"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-slate-200 truncate">
                                {(() => {
                                  const found = allImageAssets.find(img => img.url === roomSettings.backgroundImageUrl);
                                  return found ? found.name : 'Custom Background';
                                })()}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic py-2">No background image active. Select a preset below or an image in the Images tab.</p>
                        )}
                      </div>

                      {/* Preset Backgrounds Grid */}
                      <div className="space-y-2 pt-1">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Preset Backgrounds</span>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-0.5 custom-scrollbar">
                          {SAMPLE_IMAGES.map((img, index) => {
                            const isActive = roomSettings.backgroundImageUrl === img.url;
                            return (
                              <div
                                key={`preset_${index}`}
                                onClick={() => handleUpdateRoomSettings({ backgroundImageUrl: img.url, showBackground: true })}
                                className={`group rounded-lg overflow-hidden bg-slate-950/20 border transition duration-200 cursor-pointer flex flex-col ${
                                  isActive
                                    ? 'border-sky-500 ring-1 ring-sky-500/20'
                                    : 'border-slate-800/80 hover:border-slate-700/80'
                                }`}
                              >
                                <div className="h-12 w-full bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-900">
                                  <img
                                    src={getFullUrl(img.url)}
                                    alt={img.name}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  />
                                </div>
                                <div className="p-1 flex-1 flex flex-col justify-center min-w-0">
                                  <div className="text-[9px] font-bold text-slate-400 group-hover:text-slate-350 truncate">{img.name}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom Artboard Size */}
                      <div className="space-y-2 pt-2 border-t border-slate-800/40">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Custom Artboard Size</span>
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-1">
                            <label className="text-[10px] text-slate-500 font-bold block">Width (px)</label>
                            <input
                              type="number"
                              placeholder={activeVirtualDimensions.width}
                              value={roomSettings.customBackgroundWidth || ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                handleUpdateRoomSettings({
                                  customBackgroundWidth: isNaN(val) || val <= 0 ? null : val
                                });
                              }}
                              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-sky-500"
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <label className="text-[10px] text-slate-500 font-bold block">Height (px)</label>
                            <input
                              type="number"
                              placeholder={activeVirtualDimensions.height}
                              value={roomSettings.customBackgroundHeight || ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                handleUpdateRoomSettings({
                                  customBackgroundHeight: isNaN(val) || val <= 0 ? null : val
                                });
                              }}
                              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-sky-500"
                            />
                          </div>
                        </div>
                        {(roomSettings.customBackgroundWidth || roomSettings.customBackgroundHeight) && (
                          <button
                            type="button"
                            onClick={() => handleUpdateRoomSettings({
                              customBackgroundWidth: null,
                              customBackgroundHeight: null
                            })}
                            className="text-xs font-bold text-sky-400 hover:text-sky-300 transition cursor-pointer"
                          >
                            Reset to Auto-Fit
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <hr className="border-slate-800/40" />

                {/* Grid Settings */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-300">Grid Overlay</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateRoomSettings({ showGrid: !roomSettings.showGrid })}
                      className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                        roomSettings.showGrid ? 'bg-sky-500' : 'bg-slate-800'
                      }`}
                      title="Toggle Grid Overlay"
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                          roomSettings.showGrid ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {roomSettings.showGrid && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      {/* Grid Type */}
                      <div className="space-y-1.5">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Pattern Variant</span>
                        <div className="flex rounded-xl bg-slate-950/60 p-1 border border-slate-800/80">
                          {['square', 'hexagon'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => handleUpdateRoomSettings({ gridType: type })}
                              className={`flex-1 py-1.5 text-xs font-bold rounded-lg capitalize transition cursor-pointer ${
                                roomSettings.gridType === type
                                  ? 'bg-slate-800 text-sky-400 shadow-sm border border-slate-700/50'
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Grid Size */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                          <span>Grid Spacing</span>
                          <span className="font-mono text-slate-200">{roomSettings.gridSize}px</span>
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

                <hr className="border-slate-800/40" />

                {/* Show Cursor Names toggle */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-300">Show Remote Cursor Names</span>
                    <button
                      type="button"
                      onClick={() => setShowCursorNames(!showCursorNames)}
                      className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                        showCursorNames ? 'bg-sky-500' : 'bg-slate-800'
                      }`}
                      title="Toggle Cursor Names"
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                          showCursorNames ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <hr className="border-slate-800/40" />

                {/* Active Users */}
                {renderActiveUsers()}
              </div>
            )}
          </div>
        </aside>

        {/* Center Canvas Area */}
        <main className="flex-1 p-5 flex flex-col overflow-hidden relative">
          {/* Collaborative Canvas Tabs Bar */}
          <div className={`flex items-center justify-between backdrop-blur-md bg-slate-900/30 border border-slate-800/80 rounded-xl p-1.5 shadow-lg z-20 overflow-hidden transition-all duration-300 ease-in-out ${
            showTabsBar
              ? 'max-h-16 opacity-100 mb-4'
              : 'max-h-0 opacity-0 mb-0 p-0 border-0 pointer-events-none'
          }`}>
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
            {/* Unified Floating Bottom-Center Dock */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 w-max select-none">
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

              {/* Main Dock bar */}
              <div className="backdrop-blur-lg bg-slate-950/80 border border-slate-800/80 rounded-2xl p-1.5 shadow-2xl flex items-center gap-1.5">
                {/* 1. Tool Selectors */}
                <button
                  type="button"
                  onClick={() => setActiveTool('select')}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    activeTool === 'select'
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                  title="Select Tool"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.303.197-1.593 1.593M21.75 12h-2.25m-.197 5.303-1.593-1.593M3.071 6.25 4.664 4.664M12 19.75v2.25M6.25 3.071 4.664 4.664M4.5 12H2.25" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool('pan')}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    activeTool === 'pan'
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                  title="Pan Tool (Hand)"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a2 2 0 114 0v4m0 0V5a2 2 0 114 0v6m0 0V3a2 2 0 114 0v8m0 0V9a2 2 0 114 0v10a7 7 0 01-7 7H9a7 7 0 01-7-7V11a2 2 0 114 0v4m0 0v-4" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool('pen')}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    activeTool === 'pen'
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
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
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                  title="Eraser Tool"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                <div className="w-px h-6 bg-slate-800 self-center mx-1" />

                {/* 2. Actions */}
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={selectedElementIds.length === 0}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    selectedElementIds.length === 0
                      ? 'text-slate-600 cursor-not-allowed opacity-35'
                      : 'text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 active:scale-95'
                  }`}
                  title="Delete Selected Elements (Delete/Backspace)"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleClearDrawings}
                  className="p-2.5 rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all cursor-pointer active:scale-95"
                  title="Clear All Drawings"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16M7 16h10M9 12h6M11 8h2M12 4v4" />
                  </svg>
                </button>

                <div className="w-px h-6 bg-slate-800 self-center mx-1" />

                 {/* 3. Panel Toggles */}
                {/* Library Toggle */}
                <button
                  type="button"
                  onClick={() => { setShowLeftSidebar(!showLeftSidebar); setLeftPanelCollapsed(false); }}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer border ${
                    showLeftSidebar
                      ? 'bg-sky-500 border-sky-400 text-white shadow-md shadow-sky-500/20'
                      : 'text-slate-400 border-transparent hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                  title="Toggle Library Panel (🎨)"
                >
                  <span className="text-base leading-none">🎨</span>
                </button>

                {/* Dice Toggle */}
                <button
                  type="button"
                  onClick={() => setShowDiceRoller(!showDiceRoller)}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer border ${
                    showDiceRoller
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-650/20'
                      : 'text-slate-400 border-transparent hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                  title="Toggle Dice Roller Panel (🎲)"
                >
                  <span className="text-base leading-none">🎲</span>
                </button>

                {/* Properties Toggle */}
                <button
                  type="button"
                  onClick={() => { setShowRightSidebar(!showRightSidebar); setRightPanelCollapsed(false); }}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer border ${
                    showRightSidebar
                      ? 'bg-sky-500 border-sky-400 text-white shadow-md shadow-sky-500/20'
                      : 'text-slate-400 border-transparent hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                  title="Toggle Inspector Panel (⚙️)"
                >
                  <span className="text-base leading-none">⚙️</span>
                </button>

                <div className="w-px h-6 bg-slate-800 self-center mx-1" />

                {/* 4. Zen Mode */}
                <button
                  type="button"
                  onClick={handleToggleZenMode}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    isZenMode
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                  title="Toggle Zen Mode (Press \)"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    {isZenMode ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3 3m12 6V4.5m0 4.5h4.5M15 9l6-6m-6 12v4.5m0-4.5h4.5m-4.5 0l6 6m-6-12v4.5m0-4.5H4.5M9 15l-6 6" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 0v4.5m0-4.5h-4.5m4.5 0l-6-6" />
                    )}
                  </svg>
                </button>
              </div>
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
              onVirtualDimensionsChange={setActiveVirtualDimensions}
              showCursorNames={showCursorNames}
              onCanvasInteraction={handleCanvasInteraction}
            />
          </div>
        </main>

        {/* Right Inspector Floating Panel */}
        <aside 
          className={`group fixed right-6 top-24 bottom-28 w-80 z-40 flex flex-col bg-slate-950/80 backdrop-blur-md border border-slate-850 rounded-2xl p-5 shadow-2xl overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out select-none ${
            showRightSidebar
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 translate-x-10 scale-95 pointer-events-none'
          } ${
            rightPanelCollapsed ? 'translate-x-[calc(100%+12px)] opacity-40 hover:opacity-100 hover:border-sky-500/50 cursor-pointer' : 'translate-x-0'
          }`}
          onMouseEnter={rightPanelCollapsed ? () => setRightPanelCollapsed(false) : undefined}
        >
          {/* Collapsed Indicator Strip */}
          {rightPanelCollapsed && (
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-sky-500/50 group-hover:bg-sky-500 transition-colors" />
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-4 shrink-0 border-b border-slate-800/85 pb-2">
            <h2 className="text-sm font-bold text-slate-355 uppercase tracking-widest">
              {selectedElementIds.length > 0 ? 'Properties' : 'Inspector'}
            </h2>
            <button
              type="button"
              onClick={() => { setShowRightSidebar(false); setRightPanelCollapsed(false); }}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg bg-slate-900 border border-slate-800 transition cursor-pointer active:scale-95 flex items-center justify-center animate-in duration-200"
              title="Close Panel"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-5 custom-scrollbar">
            {selectedElementIds.length > 0 ? (
              <div className="space-y-5 animate-in fade-in duration-200">
                {renderInspector()}
                <hr className="border-slate-850" />
                {renderElementsAndLocks()}
              </div>
            ) : (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="flex flex-col justify-center items-center text-center p-6 text-slate-550">
                  <span className="text-3xl mb-3">🔍</span>
                  <p className="text-sm font-semibold text-slate-400">No Selection</p>
                  <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed mt-1">
                    Select an element on the canvas or from the layers list below to inspect.
                  </p>
                </div>
                <hr className="border-slate-850" />
                {renderElementsAndLocks()}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Floating Dice Roller Card Popover */}
      {showDiceRoller && (
        <div 
          className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[360px] max-h-[70vh] bg-slate-950/90 backdrop-blur-lg border border-slate-800/80 rounded-3xl p-5 shadow-2xl z-40 flex flex-col gap-4 overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-5 fade-in duration-200 select-none"
        >
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h2 className="text-sm font-bold text-slate-205 flex items-center gap-2">
              <span>🎲 Dice Roller</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowDiceRoller(false)}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg bg-slate-900 border border-slate-800 transition cursor-pointer active:scale-95 flex items-center justify-center"
              title="Close Roller"
            >
              ✕
            </button>
          </div>

          {/* 3D Dice Toggle */}
          <div className="flex items-center justify-between bg-slate-900/40 p-3 rounded-xl border border-slate-800/50">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Enable 3D Dice Roll
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enable3dDice}
                onChange={(e) => setEnable3dDice(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-350 after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500 peer-checked:after:bg-white"></div>
            </label>
          </div>

          {/* d20 Configuration */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              d20 Advantage / Disadvantage
            </label>
            <div className="grid grid-cols-4 gap-1.5 bg-slate-900/60 p-1 border border-slate-800 rounded-xl">
              {[
                { label: 'None', count: 0, mode: 'normal' },
                { label: 'Normal', count: 1, mode: 'normal' },
                { label: 'Adv', count: 1, mode: 'advantage' },
                { label: 'Dis', count: 1, mode: 'disadvantage' }
              ].map((opt) => {
                const isActive = d20Count === opt.count && (opt.count === 0 || d20Mode === opt.mode);
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      setD20Count(opt.count);
                      setD20Mode(opt.mode);
                    }}
                    className={`py-2 px-1 text-xs font-bold rounded-lg transition-all cursor-pointer active:scale-95 text-center ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mixed Dice Bag */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Dice Bag (Custom Pool)
              </label>
              {(d20Count > 0 || Object.values(mixedDice).some(v => v > 0)) && (
                <button
                  type="button"
                  onClick={() => {
                    setMixedDice({ d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d100: 0 });
                    setD20Count(0);
                  }}
                  className="text-xs text-rose-450 hover:text-rose-350 transition font-bold cursor-pointer"
                >
                  Reset Bag
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {['d4', 'd6', 'd8', 'd10', 'd12', 'd100'].map((type) => {
                const count = mixedDice[type] || 0;
                return (
                  <div
                    key={type}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border transition ${
                      count > 0
                        ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-200'
                        : 'bg-slate-905 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span className={`text-sm font-black ${count > 0 ? 'text-indigo-400' : 'text-slate-405'}`}>
                      {type}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMixedDice((prev) => ({
                            ...prev,
                            [type]: Math.max(0, count - 1)
                          }));
                        }}
                        disabled={count === 0}
                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 transition text-[11px] font-black text-slate-350 cursor-pointer disabled:cursor-not-allowed"
                      >
                        －
                      </button>
                      <span className="text-sm font-bold w-4 text-center text-slate-205">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMixedDice((prev) => ({
                            ...prev,
                            [type]: Math.min(30, count + 1)
                          }));
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition text-[11px] font-black text-slate-355 cursor-pointer"
                      >
                        ＋
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Roll Button */}
          {(() => {
            const getRollFormula = () => {
              const parts = [];
              if (d20Count > 0) {
                let modeSuffix = '';
                if (d20Mode === 'advantage') modeSuffix = ' (Adv)';
                else if (d20Mode === 'disadvantage') modeSuffix = ' (Dis)';
                parts.push(`${d20Count}d20${modeSuffix}`);
              }
              Object.entries(mixedDice).forEach(([key, val]) => {
                if (val > 0) {
                  parts.push(`${val}${key}`);
                }
              });
              return parts.join(' + ');
            };
            const formula = getRollFormula();
            const isDisabled = !formula;

            return (
              <button
                type="button"
                onClick={handleRollDice}
                disabled={isDisabled}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm rounded-xl shadow-xl shadow-indigo-950/40 hover:shadow-indigo-600/10 border border-indigo-500/30 transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-97 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:from-indigo-600 disabled:hover:to-violet-600"
              >
                <span>🎲</span> {isDisabled ? 'Select Dice to Roll' : `Roll ${formula}`}
              </button>
            );
          })()}

          {/* Roll History logs */}
          <div className="border-t border-slate-800/80 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                History Log
              </span>
              {rollHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRollHistory([])}
                  className="text-xs text-slate-500 hover:text-slate-400 cursor-pointer font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            {rollHistory.length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-4 bg-slate-950/10 border border-dashed border-slate-800/60 rounded-xl">
                No rolls yet.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
                {rollHistory.map((roll) => {
                  const getFormula = (r) => {
                    const parts = [];
                    if (r.d20 && r.d20.count > 0) {
                      let modeSuffix = '';
                      if (r.d20.mode === 'advantage') modeSuffix = ' (Adv)';
                      else if (r.d20.mode === 'disadvantage') modeSuffix = ' (Dis)';
                      parts.push(`${r.d20.count}d20${modeSuffix}`);
                    }
                    if (r.dice && Array.isArray(r.dice)) {
                      r.dice.forEach((g) => {
                        parts.push(`${g.count}d${g.type}`);
                      });
                    }
                    return parts.join(' + ');
                  };
                  const formula = getFormula(roll);
                  const hasD20 = roll.d20 && roll.d20.count > 0;
                  const hasCustomDice = roll.dice && roll.dice.length > 0;

                  return (
                    <div
                      key={roll.rollId}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredRoll({ ...roll, clientTop: rect.top });
                      }}
                      onMouseLeave={() => setHoveredRoll(null)}
                      className="text-xs p-3 rounded-xl bg-slate-900 border border-slate-800/60 hover:bg-slate-850 hover:border-slate-700 flex flex-col gap-2 transition duration-150 cursor-help"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold">
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-white/10"
                            style={{ backgroundColor: roll.userColor }}
                          />
                          <span className="text-slate-200 truncate max-w-[130px] font-black text-xs">{roll.userName}</span>
                        </div>
                        <span className="text-slate-500 text-[10px]">
                          {new Date(roll.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-indigo-400 font-extrabold truncate max-w-[180px] text-xs">
                          {formula}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {hasD20 && (
                            <div className="flex items-center gap-1">
                              {roll.d20.rolls.map((r, idx) => (
                                <span key={idx} className="flex items-center gap-0.5">
                                  <DieIcon
                                    type={20}
                                    value={r.kept}
                                    size="w-5 h-5"
                                    isKept={true}
                                  />
                                  {roll.d20.mode !== 'normal' && (
                                    <DieIcon
                                      type={20}
                                      value={r.discarded}
                                      size="w-5 h-5"
                                      isKept={false}
                                      isDiscarded={true}
                                    />
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                          {hasCustomDice && (
                            <span className="text-indigo-400 font-black ml-1 bg-indigo-500/10 px-2 py-0.5 rounded text-[11px]">
                              ={roll.totalSum}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}


      {/* Dice Roll Broadcast Overlay Notifications */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-4.5 pointer-events-none max-w-sm sm:max-w-md w-full">
        {activeRolls.map((roll) => {
          const isRolling = roll.status === 'rolling';
          
          // Compile flat list of dice types for rolling animation
          const allDiceToRoll = [];
          if (roll.d20 && roll.d20.count > 0) {
            const d20AnimCount = roll.d20.mode !== 'normal' ? roll.d20.count * 2 : roll.d20.count;
            for (let i = 0; i < d20AnimCount; i++) {
              allDiceToRoll.push(20);
            }
          }
          if (roll.dice && Array.isArray(roll.dice)) {
            roll.dice.forEach((g) => {
              for (let i = 0; i < g.count; i++) {
                allDiceToRoll.push(g.type);
              }
            });
          }

          // Build formula display text
          const getBroadcastFormula = () => {
            const parts = [];
            if (roll.d20 && roll.d20.count > 0) {
              let modeSuffix = '';
              if (roll.d20.mode === 'advantage') modeSuffix = ' (Adv)';
              else if (roll.d20.mode === 'disadvantage') modeSuffix = ' (Dis)';
              parts.push(`${roll.d20.count}d20${modeSuffix}`);
            }
            if (roll.dice && Array.isArray(roll.dice)) {
              roll.dice.forEach((g) => {
                parts.push(`${g.count}d${g.type}`);
              });
            }
            return parts.join(' + ');
          };
          const formulaText = getBroadcastFormula();

          return (
            <div
              key={roll.rollId}
              className="pointer-events-auto bg-slate-900/98 border border-slate-800 backdrop-blur-md rounded-2xl p-5 shadow-2xl w-full flex flex-col gap-3 transition-all duration-300 transform scale-100 animate-in slide-in-from-right-4 fade-in"
              style={{
                borderLeftWidth: '5px',
                borderLeftColor: roll.userColor
              }}
            >
              {/* Card Header: User and formula */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full border border-white/10"
                    style={{ backgroundColor: roll.userColor }}
                  />
                  <span className="text-sm font-black text-slate-100">{roll.userName}</span>
                </div>
                <span className="text-xs bg-indigo-500/10 text-indigo-400 font-extrabold px-3 py-1 rounded-lg border border-indigo-500/25">
                  {formulaText}
                </span>
              </div>

              {/* Rolling Animation / Final Results */}
              <div className="py-2 flex flex-col items-center justify-center min-h-[60px] relative">
                {isRolling ? (
                  // Rolling state: Show shaking placeholders with cycling values
                  <div className="flex flex-wrap justify-center gap-2.5 animate-pulse">
                    {allDiceToRoll.map((type, idx) => (
                      <div
                        key={idx}
                        className="animate-spin"
                        style={{
                          animationDuration: `${0.4 + idx * 0.15}s`
                        }}
                      >
                        <DieIcon
                          type={type}
                          value={((rollTick + idx) % type) + 1}
                          size="w-12 h-12"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  // Resolved state: Show final values
                  <div className="flex flex-col items-center gap-4 w-full">
                    {/* d20 roll results (rendered first, separately) */}
                    {roll.d20 && roll.d20.count > 0 && (
                      <div className="flex flex-col items-center gap-1.5 w-full">
                        <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                          d20 roll
                        </span>
                        <div className="flex flex-wrap justify-center gap-2.5">
                          {roll.d20.rolls.map((r, idx) => (
                            <div key={idx} className="flex items-center bg-slate-950/80 border border-slate-800/50 p-2 rounded-xl gap-2 shadow-inner">
                              {roll.d20.mode !== 'normal' ? (
                                <>
                                  <DieIcon
                                    type={20}
                                    value={r.kept}
                                    size="w-10 h-10"
                                    isKept={true}
                                    userColor={roll.userColor}
                                  />
                                  <DieIcon
                                    type={20}
                                    value={r.discarded}
                                    size="w-10 h-10"
                                    isKept={false}
                                    isDiscarded={true}
                                  />
                                </>
                              ) : (
                                <DieIcon
                                  type={20}
                                  value={r.kept}
                                  size="w-10 h-10"
                                  isKept={true}
                                  userColor={roll.userColor}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custom dice groups */}
                    {roll.dice && roll.dice.length > 0 && (
                      <div className="flex flex-col items-center gap-3 w-full border-t border-slate-800/40 pt-3">
                        <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                          Dice Pool Results
                        </span>
                        <div className="flex flex-wrap justify-center gap-4">
                          {roll.dice.map((group, gIdx) => (
                            <div key={gIdx} className="flex flex-col items-center gap-1.5">
                              <span className="text-[9px] font-extrabold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/10">
                                {group.count}d{group.type}
                              </span>
                              <div className="flex flex-wrap justify-center gap-1.5">
                                {group.rolls.map((val, idx) => (
                                  <DieIcon
                                    key={idx}
                                    type={group.type}
                                    value={val}
                                    size="w-8 h-8"
                                    isKept={true}
                                    userColor={roll.userColor}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Total sum for custom dice */}
                        <div className="text-xs font-black text-indigo-400 bg-indigo-500/10 px-4.5 py-2 rounded-full border border-indigo-500/20 animate-in zoom-in duration-300 flex items-center gap-1.5 shadow-sm mt-1">
                          Total Sum: <span className="text-white text-base font-black">{roll.totalSum}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Roll Hover Popover Card */}
      {hoveredRoll && (
        <div
          className="fixed z-50 w-80 bg-slate-900/98 border border-slate-700/80 backdrop-blur-lg rounded-2xl p-4.5 shadow-2xl flex flex-col gap-3.5 pointer-events-none animate-in fade-in slide-in-from-right-3 duration-150"
          style={{
            right: '336px',
            top: `${Math.max(80, Math.min(window.innerHeight - 260, hoveredRoll.clientTop - 60))}px`
          }}
        >
          {/* User badge */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full border border-white/20"
                style={{ backgroundColor: hoveredRoll.userColor }}
              />
              <span className="text-xs font-black text-slate-100">{hoveredRoll.userName}</span>
            </div>
            <span className="text-[9px] text-slate-500 font-mono">
              {new Date(hoveredRoll.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* Formula & Mode */}
          {(() => {
            const getFormula = (roll) => {
              const parts = [];
              if (roll.d20 && roll.d20.count > 0) {
                let modeSuffix = '';
                if (roll.d20.mode === 'advantage') modeSuffix = ' (Adv)';
                else if (roll.d20.mode === 'disadvantage') modeSuffix = ' (Dis)';
                parts.push(`${roll.d20.count}d20${modeSuffix}`);
              }
              if (roll.dice && Array.isArray(roll.dice)) {
                roll.dice.forEach((g) => {
                  parts.push(`${g.count}d${g.type}`);
                });
              }
              return parts.join(' + ');
            };
            return (
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Dice Formula
                </span>
                <span className="text-xs bg-indigo-500/10 text-indigo-400 font-black px-2.5 py-0.5 rounded border border-indigo-500/20 uppercase">
                  {getFormula(hoveredRoll)}
                </span>
              </div>
            );
          })()}

          {/* Detailed Results */}
          <div className="flex flex-col gap-3.5 py-1 bg-slate-950/40 border border-slate-950/80 p-3 rounded-xl max-h-60 overflow-y-auto custom-scrollbar">
            {/* d20 roll results */}
            {hoveredRoll.d20 && hoveredRoll.d20.count > 0 && (
              <div className="flex flex-col items-center gap-1.5 w-full">
                <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                  d20 roll
                </span>
                <div className="flex flex-wrap justify-center gap-2">
                  {hoveredRoll.d20.rolls.map((r, idx) => (
                    <div key={idx} className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 gap-1 shadow-inner">
                      {hoveredRoll.d20.mode !== 'normal' ? (
                        <>
                          <DieIcon
                            type={20}
                            value={r.kept}
                            size="w-9 h-9"
                            isKept={true}
                            userColor={hoveredRoll.userColor}
                          />
                          <DieIcon
                            type={20}
                            value={r.discarded}
                            size="w-9 h-9"
                            isKept={false}
                            isDiscarded={true}
                          />
                        </>
                      ) : (
                        <DieIcon
                          type={20}
                          value={r.kept}
                          size="w-9 h-9"
                          isKept={true}
                          userColor={hoveredRoll.userColor}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom dice groups */}
            {hoveredRoll.dice && hoveredRoll.dice.length > 0 && (
              <div className="flex flex-col gap-3 w-full border-t border-slate-800/40 pt-2.5">
                {hoveredRoll.dice.map((group, gIdx) => (
                  <div key={gIdx} className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-extrabold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/10">
                      {group.count}d{group.type}
                    </span>
                    <div className="flex flex-wrap justify-center gap-1">
                      {group.rolls.map((val, idx) => (
                        <DieIcon
                          key={idx}
                          type={group.type}
                          value={val}
                          size="w-7 h-7"
                          isKept={true}
                          userColor={hoveredRoll.userColor}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sum Total if not d20 only */}
          {hoveredRoll.dice && hoveredRoll.dice.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Total Sum
              </span>
              <span className="text-base font-black text-indigo-400 bg-indigo-500/10 px-3.5 py-1 rounded-xl border border-indigo-500/20">
                {hoveredRoll.totalSum}
              </span>
            </div>
          )}
        </div>
      )}
      {enable3dDice && (
        <DiceEffects activeRolls={activeRolls} />
      )}
    </div>
  );
}
