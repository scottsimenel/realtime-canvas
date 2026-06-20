import { useState } from 'react';
import { SAMPLE_IMAGES } from '../../constants.js';
import ActiveUsersWidget from './ActiveUsersWidget.jsx';
import { useUploadStore } from '../../state/uploadStore.js';

export default function LeftSidebar({
  showLeftSidebar,
  setShowLeftSidebar,
  leftPanelCollapsed,
  setLeftPanelCollapsed,
  leftPanelTab,
  setLeftPanelTab,
  visibleAssets,
  hiddenAssets,
  showHiddenMode,
  setShowHiddenMode,
  roomSettings,
  allImageAssets,
  activeVirtualDimensions,
  showCursorNames,
  setShowCursorNames,
  users,
  currentUser,
  tabs,
  isUploading,
  uploadError,
  handleSpawnShape,
  handleSpawnImage,
  handleUpdateRoomSettings,
  handleImageUpload,
  toggleHideAsset,
  hiddenAssetUrls,
  setHiddenAssetUrls,
  handleRecolorUser,
  getFullUrl,
}) {
  const {
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    handleRenameAsset,
    handleDeleteAsset,
    folders,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleMoveAsset
  } = useUploadStore();

  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [collapsedFolderIds, setCollapsedFolderIds] = useState([]);
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  const [editingAssetId, setEditingAssetId] = useState(null);
  const [editingAssetName, setEditingAssetName] = useState('');

  const startEditingAsset = (e, img) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingAssetId(img.id);
    setEditingAssetName(img.name);
  };

  const saveAssetRename = (assetId) => {
    if (editingAssetName.trim() && editingAssetName.trim() !== '') {
      handleRenameAsset(assetId, editingAssetName.trim());
    }
    setEditingAssetId(null);
  };

  const startEditingFolder = (e, folder) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const saveFolderRename = (folderId) => {
    if (editingFolderName.trim() && editingFolderName.trim() !== '') {
      handleRenameFolder(folderId, editingFolderName.trim());
    }
    setEditingFolderId(null);
  };

  const toggleFolderCollapsed = (folderId) => {
    setCollapsedFolderIds((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]
    );
  };

  const handleDragOverFolder = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-sky-500/10', 'border-sky-500/30');
  };

  const handleDragLeaveFolder = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-sky-500/10', 'border-sky-500/30');
  };

  const handleDropOnFolder = (e, folderId) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-sky-500/10', 'border-sky-500/30');
    try {
      const textData = e.dataTransfer.getData('text/plain');
      if (!textData) return;
      const data = JSON.parse(textData);
      if (data && data.url) {
        const match = visibleAssets.find((a) => a.url === data.url && !a.isPreset);
        if (match) {
          handleMoveAsset(match.id, folderId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDropOnRoot = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-slate-900/50', 'border-slate-800');
    try {
      const textData = e.dataTransfer.getData('text/plain');
      if (!textData) return;
      const data = JSON.parse(textData);
      if (data && data.url) {
        const match = visibleAssets.find((a) => a.url === data.url && !a.isPreset);
        if (match) {
          handleMoveAsset(match.id, null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderAssetCard = (img) => (
    <div
      key={img.id}
      draggable="true"
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ url: img.url, type: 'image' }));
      }}
      className="group relative h-20 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 hover:border-slate-700 transition cursor-grab active:cursor-grabbing"
    >
      <button
        type="button"
        onClick={() => handleSpawnImage(img.url)}
        className="w-full h-full text-left p-0 bg-transparent border-0 cursor-pointer"
      >
        <img
          src={getFullUrl(img.url)}
          alt={img.name}
          className="w-full h-full object-cover opacity-60 group-hover:opacity-85 transition duration-300 pointer-events-none"
        />
        {editingAssetId === img.id ? (
          <div className="absolute inset-x-0 bottom-0 bg-slate-950/95 p-1 z-20 flex gap-1 pointer-events-auto">
            <input
              type="text"
              value={editingAssetName}
              onChange={(e) => setEditingAssetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  saveAssetRename(img.id);
                } else if (e.key === 'Escape') {
                  setEditingAssetId(null);
                }
              }}
              onBlur={() => saveAssetRename(img.id)}
              autoFocus
              className="w-full text-[10px] bg-slate-900 border border-slate-750 text-slate-200 px-1 py-0.5 rounded focus:outline-none focus:border-sky-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex items-end justify-between p-2 pointer-events-none">
            <span className="text-[10px] font-bold text-slate-300 group-hover:text-white transition truncate max-w-[75%]">
              {img.name}
            </span>
            {!img.isPreset && (
              <button
                type="button"
                onClick={(e) => startEditingAsset(e, img)}
                className="pointer-events-auto opacity-0 group-hover:opacity-100 text-slate-450 hover:text-white transition cursor-pointer ml-1 z-20"
                title="Rename Image"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                </svg>
              </button>
            )}
          </div>
        )}
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
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-slate-800 hover:text-rose-455 active:scale-95 transition cursor-pointer z-10"
        title="Hide Image"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.893 7.893L21 21m-4.228-4.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
      </button>

      {!img.isPreset && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (confirm(`Are you sure you want to permanently delete "${img.name}"? This will delete it for all users and remove it from the server.`)) {
              handleDeleteAsset(img.id);
            }
          }}
          className="absolute top-1.5 right-8 w-6 h-6 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-455 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-slate-800 hover:text-rose-600 active:scale-95 transition cursor-pointer z-10"
          title="Delete Permanently"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );

  const [spawnShapeType, setSpawnShapeType] = useState('rectangle');
  const [spawnFillColor, setSpawnFillColor] = useState('#3b82f6');
  const [spawnFillOpacity, setSpawnFillOpacity] = useState(1);
  const [spawnStrokeEnabled, setSpawnStrokeEnabled] = useState(true);
  const [spawnStrokeColor, setSpawnStrokeColor] = useState('#2563eb');
  const [spawnStrokeOpacity, setSpawnStrokeOpacity] = useState(1);
  const [spawnStrokeWidth, setSpawnStrokeWidth] = useState(2);

  const PRESET_COLORS = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#8b5cf6', // purple
    '#f59e0b', // orange
    '#ec4899', // pink
    '#14b8a6', // teal
    '#64748b', // slate
    '#ffffff', // white
    '#000000', // black
  ];

  return (
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
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-5 custom-scrollbar">
        {leftPanelTab === 'shapes' && (
          <div className="space-y-4.5 animate-in fade-in duration-200">
            {/* Custom Shape Configurator */}
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4 shadow-xl">
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 select-none">
                  1. Select Shape
                </h4>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { type: 'rectangle', label: 'Rect', icon: '⬜' },
                    { type: 'circle', label: 'Circle', icon: '⚪' },
                    { type: 'triangle', label: 'Tri', icon: '🔺' },
                    { type: 'star', label: 'Star', icon: '⭐' },
                    { type: 'hexagon', label: 'Hex', icon: '⬢' },
                  ].map((s) => (
                    <button
                      key={s.type}
                      type="button"
                      onClick={() => setSpawnShapeType(s.type)}
                      className={`py-2 rounded-xl text-center border transition flex flex-col items-center gap-1 active:scale-95 cursor-pointer ${
                        spawnShapeType === s.type
                          ? 'bg-sky-500/15 border-sky-500/50 text-sky-400'
                          : 'bg-slate-950/40 border-slate-800/60 text-slate-400 hover:bg-slate-900 hover:border-slate-700'
                      }`}
                      title={s.label}
                    >
                      <span className="text-sm">{s.icon}</span>
                      <span className="text-[8px] font-bold uppercase tracking-wider">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fill Section */}
              <div className="space-y-2 border-t border-slate-800/40 pt-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest select-none">
                    2. Fill Color & Opacity
                  </h4>
                  <span className="text-[10px] text-slate-500 font-bold">{Math.round(spawnFillOpacity * 100)}%</span>
                </div>
                
                {/* Presets + Picker */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSpawnFillColor(c)}
                      className={`w-6 h-6 rounded-full border transition-all duration-150 cursor-pointer hover:scale-110 active:scale-95 ${
                        spawnFillColor === c
                          ? 'ring-2 ring-sky-500 border-white scale-105'
                          : 'border-slate-800'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <div className="relative w-6 h-6 rounded-full border border-slate-800 overflow-hidden cursor-pointer bg-slate-950 flex items-center justify-center">
                    <input
                      type="color"
                      value={spawnFillColor}
                      onChange={(e) => setSpawnFillColor(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <span className="text-[10px] pointer-events-none select-none text-slate-400">🎨</span>
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={spawnFillOpacity}
                  onChange={(e) => setSpawnFillOpacity(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              {/* Outline Section */}
              <div className="space-y-2 border-t border-slate-800/40 pt-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest select-none">
                    3. Outline Settings
                  </h4>
                  <button
                    type="button"
                    onClick={() => setSpawnStrokeEnabled(!spawnStrokeEnabled)}
                    className={`w-9 h-5 rounded-full p-0.5 border transition-colors duration-200 cursor-pointer flex items-center ${
                      spawnStrokeEnabled
                        ? 'bg-sky-500 border-sky-600 justify-end'
                        : 'bg-slate-950/80 border-slate-800 justify-start'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                  </button>
                </div>

                {spawnStrokeEnabled && (
                  <div className="space-y-2.5 animate-in fade-in duration-200 pt-1">
                    {/* Outline Color */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSpawnStrokeColor(c)}
                          className={`w-6 h-6 rounded-full border transition-all duration-150 cursor-pointer hover:scale-110 active:scale-95 ${
                            spawnStrokeColor === c
                              ? 'ring-2 ring-sky-500 border-white scale-105'
                              : 'border-slate-800'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <div className="relative w-6 h-6 rounded-full border border-slate-800 overflow-hidden cursor-pointer bg-slate-950 flex items-center justify-center">
                        <input
                          type="color"
                          value={spawnStrokeColor}
                          onChange={(e) => setSpawnStrokeColor(e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <span className="text-[10px] pointer-events-none select-none text-slate-400">🎨</span>
                      </div>
                    </div>

                    {/* Thickness */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                        <span>Width</span>
                        <span>{spawnStrokeWidth}px</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="12"
                        step="1"
                        value={spawnStrokeWidth}
                        onChange={(e) => setSpawnStrokeWidth(parseInt(e.target.value, 10))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                      />
                    </div>

                    {/* Opacity */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                        <span>Opacity</span>
                        <span>{Math.round(spawnStrokeOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={spawnStrokeOpacity}
                        onChange={(e) => setSpawnStrokeOpacity(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Spawn Shape Trigger */}
              <button
                type="button"
                onClick={() => {
                  handleSpawnShape(
                    spawnShapeType,
                    spawnFillColor,
                    spawnStrokeColor,
                    {
                      strokeWidth: spawnStrokeWidth,
                      fillOpacity: spawnFillOpacity,
                      strokeOpacity: spawnStrokeOpacity,
                      strokeEnabled: spawnStrokeEnabled,
                    }
                  );
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition active:scale-[0.98] shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                ➕ Spawn Shape
              </button>
            </div>

            {/* Quick Spawn Accordion / Classic Presets */}
            <div className="space-y-2 pt-2 border-t border-slate-800/40">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest select-none">
                Quick Presets
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSpawnShape('rectangle', '#3b82f6', '#2563eb', { fillOpacity: 1, strokeOpacity: 1, strokeEnabled: true, strokeWidth: 2 })}
                  className="py-2 px-2.5 bg-slate-900/30 hover:bg-slate-900/50 border border-slate-800 rounded-xl text-slate-300 font-medium text-[11px] transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <div className="w-4 h-3 bg-blue-500 rounded border border-blue-600 shrink-0" />
                  <span>Blue Rect</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSpawnShape('rectangle', '#ef4444', '#dc2626', { fillOpacity: 1, strokeOpacity: 1, strokeEnabled: true, strokeWidth: 2 })}
                  className="py-2 px-2.5 bg-slate-900/30 hover:bg-slate-900/50 border border-slate-800 rounded-xl text-slate-300 font-medium text-[11px] transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <div className="w-4 h-3 bg-rose-500 rounded border border-rose-600 shrink-0" />
                  <span>Red Rect</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSpawnShape('circle', '#10b981', '#059669', { fillOpacity: 1, strokeOpacity: 1, strokeEnabled: true, strokeWidth: 2 })}
                  className="py-2 px-2.5 bg-slate-900/30 hover:bg-slate-900/50 border border-slate-800 rounded-xl text-slate-300 font-medium text-[11px] transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <div className="w-4 h-4 bg-emerald-500 rounded-full border border-emerald-600 shrink-0" />
                  <span>Green Circle</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSpawnShape('circle', '#8b5cf6', '#7c3aed', { fillOpacity: 1, strokeOpacity: 1, strokeEnabled: true, strokeWidth: 2 })}
                  className="py-2 px-2.5 bg-slate-900/30 hover:bg-slate-900/50 border border-slate-800 rounded-xl text-slate-300 font-medium text-[11px] transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <div className="w-4 h-4 bg-purple-500 rounded-full border border-purple-600 shrink-0" />
                  <span>Purple Circle</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {leftPanelTab === 'images' && (
          <div className="space-y-5 animate-in fade-in duration-200">
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
                  : 'Click thumbnail to spawn image or drag to board.'}
              </p>

              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 Search library..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-355 placeholder-slate-600 focus:outline-none focus:border-slate-700 transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1.5 text-slate-450 hover:text-slate-200 cursor-pointer text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex gap-1.5 select-none">
                  {['all', 'presets', 'uploads'].map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveFilter(filter)}
                      className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider border transition cursor-pointer ${
                        activeFilter === filter
                          ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                          : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:bg-slate-900 hover:text-slate-400'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Create Folder Section */}
              {!showHiddenMode && (
                <div className="space-y-2 border-t border-slate-900 pt-2 pb-1">
                  {showNewFolderForm ? (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="Folder name..."
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCreateFolder(newFolderName);
                            setNewFolderName('');
                            setShowNewFolderForm(false);
                          } else if (e.key === 'Escape') {
                            setShowNewFolderForm(false);
                          }
                        }}
                        className="w-full text-xs bg-slate-900 border border-slate-850 text-slate-200 px-2 py-1 rounded-lg focus:outline-none focus:border-sky-500"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowNewFolderForm(false)}
                          className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-350 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleCreateFolder(newFolderName);
                            setNewFolderName('');
                            setShowNewFolderForm(false);
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 rounded-lg transition cursor-pointer"
                        >
                          Create
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => setShowNewFolderForm(true)}
                        className="text-[10px] font-bold text-sky-400 hover:text-sky-350 transition cursor-pointer flex items-center gap-1 select-none"
                      >
                        📁+ New Folder
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="max-h-72 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                {/* Collapsible Folders List */}
                {!showHiddenMode && folders.map((folder) => {
                  const folderAssets = visibleAssets.filter((a) => a.folderId === folder.id);
                  const isCollapsed = collapsedFolderIds.includes(folder.id);
                  return (
                    <div
                      key={folder.id}
                      onDragOver={handleDragOverFolder}
                      onDragLeave={handleDragLeaveFolder}
                      onDrop={(e) => handleDropOnFolder(e, folder.id)}
                      className="border border-slate-900/60 rounded-xl overflow-hidden bg-slate-950/20 transition duration-150"
                    >
                      {/* Folder Header */}
                      <div
                        onClick={() => toggleFolderCollapsed(folder.id)}
                        className="flex items-center justify-between p-2 bg-slate-950/40 hover:bg-slate-950/70 transition cursor-pointer select-none border-b border-slate-900/40"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {isCollapsed ? '▶' : '▼'}
                          </span>
                          <span className="text-xs shrink-0">📁</span>
                          {editingFolderId === folder.id ? (
                            <input
                              type="text"
                              value={editingFolderName}
                              onChange={(e) => setEditingFolderName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveFolderRename(folder.id);
                                } else if (e.key === 'Escape') {
                                  setEditingFolderId(null);
                                }
                              }}
                              onBlur={() => saveFolderRename(folder.id)}
                              autoFocus
                              className="text-xs bg-slate-900 border border-slate-750 text-slate-200 px-1 py-0.5 rounded focus:outline-none focus:border-sky-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="text-xs font-bold text-slate-400 truncate max-w-[130px]">
                              {folder.name}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-600 font-bold">
                            ({folderAssets.length})
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 pointer-events-auto">
                          <button
                            type="button"
                            onClick={(e) => startEditingFolder(e, folder)}
                            className="text-slate-500 hover:text-slate-300 transition cursor-pointer"
                            title="Rename Folder"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to delete folder "${folder.name}"? Assets inside will remain in the library.`)) {
                                handleDeleteFolder(folder.id);
                              }
                            }}
                            className="text-slate-500 hover:text-rose-500 transition cursor-pointer"
                            title="Delete Folder"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Folder Content Grid */}
                      {!isCollapsed && (
                        <div className="p-2.5">
                          {folderAssets.length === 0 ? (
                            <p className="text-[10px] text-slate-600 text-center py-2.5 italic">
                              Drag custom uploads here.
                            </p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2.5">
                              {folderAssets.map((img) => renderAssetCard(img))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Root / Uncategorized Dropzone Header */}
                {!showHiddenMode && folders.length > 0 && (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('bg-slate-900/50', 'border-slate-800');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('bg-slate-900/50', 'border-slate-800');
                    }}
                    onDrop={handleDropOnRoot}
                    className="border border-dashed border-slate-900 p-2 rounded-xl text-center select-none text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-950/10 transition"
                  >
                    📥 Drop here to move back to Root Library
                  </div>
                )}

                {/* Root / Flat Assets list */}
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
                            className="w-full h-full object-cover opacity-30 grayscale pointer-events-none"
                          />
                          {editingAssetId === img.id ? (
                            <div className="absolute inset-x-0 bottom-0 bg-slate-950/95 p-1 z-20 flex gap-1 pointer-events-auto">
                              <input
                                type="text"
                                value={editingAssetName}
                                onChange={(e) => setEditingAssetName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    saveAssetRename(img.id);
                                  } else if (e.key === 'Escape') {
                                    setEditingAssetId(null);
                                  }
                                }}
                                onBlur={() => saveAssetRename(img.id)}
                                autoFocus
                                className="w-full text-[10px] bg-slate-900 border border-slate-750 text-slate-200 px-1 py-0.5 rounded focus:outline-none focus:border-sky-500"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          ) : (
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex items-end justify-between p-2 pointer-events-none">
                              <span className="text-[10px] font-bold text-rose-350 truncate max-w-[75%]">
                                {img.name}
                              </span>
                              {!img.isPreset && (
                                <button
                                  type="button"
                                  onClick={(e) => startEditingAsset(e, img)}
                                  className="pointer-events-auto opacity-0 group-hover:opacity-100 text-slate-450 hover:text-white transition cursor-pointer ml-1 z-20"
                                  title="Rename Image"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                          
                          <button
                            type="button"
                            onClick={() => toggleHideAsset(img.url)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-lg hover:bg-emerald-400 hover:scale-105 active:scale-95 transition cursor-pointer z-10"
                            title="Restore Image"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>

                          {!img.isPreset && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (confirm(`Are you sure you want to permanently delete "${img.name}"? This will delete it for all users and remove it from the server.`)) {
                                  handleDeleteAsset(img.id);
                                }
                              }}
                              className="absolute top-1.5 left-1.5 w-6 h-6 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-455 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-slate-800 hover:text-rose-600 active:scale-95 transition cursor-pointer z-10"
                              title="Delete Permanently"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (() => {
                    const rootAssets = folders.length > 0
                      ? visibleAssets.filter((a) => !a.folderId)
                      : visibleAssets;

                    return rootAssets.length === 0 ? (
                      folders.length > 0 ? (
                        <p className="text-[10px] text-slate-600 text-center py-2.5 italic">
                          No uncategorized root assets.
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 text-center py-5 bg-slate-950/20 border border-dashed border-slate-800 rounded-xl animate-in zoom-in-95 duration-200">
                          No visible images. Upload below or restore hidden.
                        </p>
                      )
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        {rootAssets.map((img) => renderAssetCard(img))}
                      </div>
                    );
                  })()}
              </div>

              {hiddenAssetUrls.length > 0 && (
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setShowHiddenMode(!showHiddenMode)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl transition border cursor-pointer ${
                      showHiddenMode 
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-455 hover:bg-rose-500/20' 
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
                    <span className="text-[10px] text-slate-650 max-w-[200px] leading-tight">PNG, JPG, GIF, WEBP up to 20MB</span>
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
                          className="text-xs font-bold text-rose-455 hover:text-rose-350 transition cursor-pointer"
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
                  {/* Grid Snapping */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Grid Snapping</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateRoomSettings({ gridSnapping: !roomSettings.gridSnapping })}
                      className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                        roomSettings.gridSnapping ? 'bg-sky-500' : 'bg-slate-800'
                      }`}
                      title="Toggle Grid Snapping"
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                          roomSettings.gridSnapping ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

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

                  {/* Grid Scale Configuration */}
                  <div className="space-y-1.5 border-t border-slate-800/40 pt-3">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Measurement Scale</span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-1.5 rounded-xl bg-slate-950/60 px-3 py-2 border border-slate-800/80">
                        <span className="text-slate-500 text-xs select-none">1 space =</span>
                        <input
                          type="text"
                          value={roomSettings.gridScaleNumber !== undefined ? roomSettings.gridScaleNumber : 5}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              handleUpdateRoomSettings({ gridScaleNumber: val });
                            }
                          }}
                          onBlur={(e) => {
                            if (e.target.value.trim() === '') {
                              handleUpdateRoomSettings({ gridScaleNumber: 5 });
                            }
                          }}
                          className="w-12 bg-transparent text-white text-xs font-medium focus:outline-none"
                          placeholder="5"
                        />
                      </div>
                      <div className="w-20 rounded-xl bg-slate-950/60 px-3 py-2 border border-slate-800/80">
                        <input
                          type="text"
                          value={roomSettings.gridScaleUnit || 'ft'}
                          onChange={(e) => handleUpdateRoomSettings({ gridScaleUnit: e.target.value })}
                          className="w-full bg-transparent text-white text-xs font-medium focus:outline-none"
                          placeholder="unit"
                          maxLength="10"
                        />
                      </div>
                    </div>
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

            {/* Active Users Accordion */}
            <ActiveUsersWidget
              users={users}
              currentUser={currentUser}
              tabs={tabs}
              handleRecolorUser={handleRecolorUser}
              isCollapsedDisabled={false}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
