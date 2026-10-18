import { useState, useMemo } from 'react';
import { SAMPLE_IMAGES } from '../../constants.js';
import ActiveUsersWidget from './ActiveUsersWidget.jsx';
import Icon from '../common/Icon.jsx';
import { useUploadStore } from '../../state/uploadStore.js';
import {
  MAX_FOLDER_DEPTH,
  buildFolderTree,
  flattenFolderTree,
  canMoveFolder,
  getSubtreeAssetIds
} from '../../lib/folderTree.js';

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
    assets,
    currentRoomId,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    handleRenameAsset,
    handleDeleteAsset,
    folders,
    handleCreateFolder,
    handleRenameFolder,
    handleMoveFolder,
    handleDeleteFolder,
    handleMoveAsset
  } = useUploadStore();

  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingSubfolderParentId, setCreatingSubfolderParentId] = useState(null);
  const [subfolderName, setSubfolderName] = useState('');

  const folderTreeNodes = useMemo(() => buildFolderTree(folders), [folders]);
  const flattenedFolders = useMemo(() => flattenFolderTree(folders), [folders]);

  const [collapsedFolderIds, setCollapsedFolderIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('canvas_collapsed_folders') || '[]');
    } catch {
      return [];
    }
  });
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [isOverRootDropzone, setIsOverRootDropzone] = useState(false);

  const [editingAssetId, setEditingAssetId] = useState(null);
  const [editingAssetName, setEditingAssetName] = useState('');

  const startEditingAsset = (e, img) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingAssetId(img.id);
    setEditingAssetName(img.name);
  };

  const saveAssetRename = (assetId) => {
    if (editingAssetId !== assetId) return;
    const trimmed = editingAssetName.trim();
    const current = (allImageAssets || []).find((a) => a.id === assetId);
    if (trimmed && current && trimmed !== current.name) {
      handleRenameAsset(assetId, trimmed);
    }
    setEditingAssetId(null);
    setEditingAssetName('');
  };

  const startEditingFolder = (e, folder) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const saveFolderRename = (folderId) => {
    if (editingFolderId !== folderId) return;
    const trimmed = editingFolderName.trim();
    const current = (folders || []).find((f) => f.id === folderId);
    if (trimmed && current && trimmed !== current.name) {
      handleRenameFolder(folderId, trimmed);
    }
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const toggleFolderCollapsed = (folderId) => {
    setCollapsedFolderIds((prev) => {
      const next = prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId];
      try {
        localStorage.setItem('canvas_collapsed_folders', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleDragOverFolder = (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverFolderId !== folderId) {
      setDragOverFolderId(folderId);
    }
  };

  const handleDragLeaveFolder = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverFolderId(null);
    }
  };

  const handleDropOnFolder = (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    // If external OS desktop files dropped directly onto folder
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files, currentRoomId, folderId);
      setCollapsedFolderIds((prev) => prev.filter((id) => id !== folderId));
      return;
    }

    try {
      const textData = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (!textData) return;
      const data = JSON.parse(textData);
      if (!data) return;

      if (data.type === 'folder') {
        if (data.folderId === folderId) return;
        const check = canMoveFolder(data.folderId, folderId, folders);
        if (check.valid) {
          handleMoveFolder(data.folderId, folderId);
          setCollapsedFolderIds((prev) => prev.filter((id) => id !== folderId));
        } else if (check.error) {
          alert(check.error);
        }
        return;
      }

      if (data.isPreset) return;
      if (data.sourceFolderId === folderId) return;

      const targetAssetId = data.assetId || ((assets || []).find((a) => a.url === data.url)?.id);
      if (targetAssetId) {
        handleMoveAsset(targetAssetId, folderId);
        setCollapsedFolderIds((prev) => prev.filter((id) => id !== folderId));
      }
    } catch (err) {
      console.error('Failed to handle drop on folder:', err);
    }
  };

  const handleDragOverRoot = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOverRootDropzone) {
      setIsOverRootDropzone(true);
    }
  };

  const handleDragLeaveRoot = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsOverRootDropzone(false);
    }
  };

  const handleDropOnRoot = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOverRootDropzone(false);

    // If external OS desktop files dropped directly onto root
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files, currentRoomId, null);
      return;
    }

    try {
      const textData = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (!textData) return;
      const data = JSON.parse(textData);
      if (!data) return;

      if (data.type === 'folder') {
        if (!data.sourceFolderId) return; // already root
        const check = canMoveFolder(data.folderId, null, folders);
        if (check.valid) {
          handleMoveFolder(data.folderId, null);
        } else if (check.error) {
          alert(check.error);
        }
        return;
      }

      if (data.isPreset) return;
      if (!data.sourceFolderId) return; // already root

      const targetAssetId = data.assetId || ((assets || []).find((a) => a.url === data.url)?.id);
      if (targetAssetId) {
        handleMoveAsset(targetAssetId, null);
      }
    } catch (err) {
      console.error('Failed to handle drop on root:', err);
    }
  };

  const renderAssetCard = (img) => (
    <div
      key={img.id}
      draggable="true"
      onDragStart={(e) => {
        const payload = {
          type: 'image',
          url: img.url,
          assetId: img.id,
          isPreset: !!img.isPreset,
          sourceFolderId: img.folderId || null,
        };
        e.dataTransfer.setData('text/plain', JSON.stringify(payload));
        e.dataTransfer.setData('application/json', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'copyMove';
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
              maxLength={40}
              value={editingAssetName}
              onChange={(e) => setEditingAssetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveAssetRename(img.id);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditingAssetId(null);
                  setEditingAssetName('');
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
                <Icon name="pencil" className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </button>

      <button
        type="button"
        onClick={() => handleUpdateRoomSettings({ backgroundImageUrl: img.url, showBackground: true })}
        className={`absolute top-1.5 left-1.5 w-6 h-6 rounded-lg border text-slate-400 flex items-center justify-center active:scale-95 transition cursor-pointer z-10 ${
          roomSettings.backgroundImageUrl === img.url
            ? 'opacity-100 bg-sky-500 border-sky-400 text-white shadow-sm'
            : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-slate-900/90 border-slate-800 hover:bg-slate-800 hover:text-sky-400'
        }`}
        title="Set as Canvas Background"
      >
        <Icon name="image" className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => toggleHideAsset(img.url)}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-400 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto flex items-center justify-center hover:bg-slate-800 hover:text-rose-455 active:scale-95 transition cursor-pointer z-10"
        title="Hide Image"
      >
        <Icon name="eye-off" className="w-3.5 h-3.5" />
      </button>

      {!img.isPreset && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (typeof window !== 'undefined' && window.confirm(`Permanently delete "${img.name}" for all users?`)) {
              handleDeleteAsset(img.id);
            }
          }}
          className="absolute top-1.5 right-8 w-6 h-6 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-455 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto flex items-center justify-center hover:bg-slate-800 hover:text-rose-600 active:scale-95 transition cursor-pointer z-10"
          title="Delete Permanently"
        >
          <Icon name="trash" className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Touch & quick folder selector */}
      {!img.isPreset && folders && folders.length > 0 && (
        <div className="absolute bottom-1.5 right-1.5 z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition">
          <select
            value={img.folderId || ''}
            onChange={(e) => {
              e.stopPropagation();
              const target = e.target.value || null;
              if (target !== (img.folderId || null)) {
                handleMoveAsset(img.id, target);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-[9px] bg-slate-900/95 border border-slate-700/80 text-slate-300 rounded px-1 py-0.5 max-w-[84px] cursor-pointer focus:outline-none"
            title="Move to folder"
          >
            <option value="">/ (Root)</option>
            {flattenedFolders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.indentPrefix}/ {f.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  const renderFolderNode = (folder) => {
    const folderAssets = visibleAssets.filter((a) => a.folderId === folder.id);
    const subtreeAssetIds = getSubtreeAssetIds(folder.id, folders, visibleAssets);
    const hasSearch = !!searchQuery.trim();
    const searchTrimmed = searchQuery.trim().toLowerCase();
    const folderNameMatches = folder.name.toLowerCase().includes(searchTrimmed);

    // When searching, hide folders that have no matches in themselves or any descendant folders
    if (hasSearch && folderAssets.length === 0 && subtreeAssetIds.length === 0 && !folderNameMatches) {
      return null;
    }

    // Auto-expand folder if active search returned matches
    const isCollapsed = hasSearch ? false : collapsedFolderIds.includes(folder.id);
    const isDragOver = dragOverFolderId === folder.id;
    const isAtMaxDepth = (folder.depth || 1) >= MAX_FOLDER_DEPTH;

    return (
      <div
        key={folder.id}
        onDragOver={(e) => handleDragOverFolder(e, folder.id)}
        onDragLeave={handleDragLeaveFolder}
        onDrop={(e) => handleDropOnFolder(e, folder.id)}
        className={`border rounded-xl overflow-hidden transition duration-150 ${
          folder.depth > 1 ? 'ml-2.5 border-l-2 border-slate-700/60' : ''
        } ${
          isDragOver
            ? 'border-sky-500 bg-sky-500/10 shadow-sm shadow-sky-500/20 ring-1 ring-sky-500/40'
            : 'border-slate-900/60 bg-slate-950/20'
        }`}
      >
        {/* Folder Header */}
        <div
          draggable="true"
          onDragStart={(e) => {
            e.stopPropagation();
            const payload = {
              type: 'folder',
              folderId: folder.id,
              sourceFolderId: folder.parentId || null
            };
            e.dataTransfer.setData('text/plain', JSON.stringify(payload));
            e.dataTransfer.setData('application/json', JSON.stringify(payload));
            e.dataTransfer.effectAllowed = 'move';
          }}
          onClick={() => toggleFolderCollapsed(folder.id)}
          className="flex items-center justify-between p-2 bg-slate-950/40 hover:bg-slate-950/70 transition cursor-pointer select-none border-b border-slate-900/40"
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Icon
              name={isCollapsed ? "chevron-right" : "chevron-down"}
              className="w-3 h-3 text-slate-500 shrink-0"
            />
            <Icon name="folder" className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            {editingFolderId === folder.id ? (
              <input
                type="text"
                maxLength={40}
                value={editingFolderName}
                onChange={(e) => setEditingFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveFolderRename(folder.id);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditingFolderId(null);
                    setEditingFolderName('');
                  }
                }}
                onBlur={() => saveFolderRename(folder.id)}
                autoFocus
                className="text-xs bg-slate-900 border border-slate-750 text-slate-200 px-1.5 py-0.5 rounded focus:outline-none focus:border-sky-500 max-w-[120px]"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-xs font-bold text-slate-300 truncate max-w-[120px]" title={folder.name}>
                {folder.name}
              </span>
            )}
            <span className="text-[10px] text-slate-500 font-bold shrink-0">
              {isCollapsed && folder.children && folder.children.length > 0
                ? `(${folderAssets.length} · ${subtreeAssetIds.length})`
                : `(${folderAssets.length})`}
            </span>
          </div>

          <div className="flex items-center gap-1 pointer-events-auto">
            {!isAtMaxDepth && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCreatingSubfolderParentId((prev) => (prev === folder.id ? null : folder.id));
                  setSubfolderName('');
                  if (collapsedFolderIds.includes(folder.id)) {
                    toggleFolderCollapsed(folder.id);
                  }
                }}
                className="text-slate-500 hover:text-sky-400 transition cursor-pointer p-0.5"
                title="Add Subfolder"
              >
                <Icon name="folder-plus" className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => startEditingFolder(e, folder)}
              className="text-slate-500 hover:text-slate-300 transition cursor-pointer p-0.5"
              title="Rename Folder"
            >
              <Icon name="pencil" className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const hasChildren = folder.children && folder.children.length > 0;
                const confirmMessage = (folderAssets.length > 0 || hasChildren)
                  ? `Are you sure you want to delete folder "${folder.name}"? Subfolders and ${folderAssets.length} asset(s) inside will be moved up to the parent level.`
                  : `Are you sure you want to delete empty folder "${folder.name}"?`;
                if (confirm(confirmMessage)) {
                  handleDeleteFolder(folder.id);
                }
              }}
              className="text-slate-500 hover:text-rose-500 transition cursor-pointer p-0.5"
              title="Delete Folder"
            >
              <Icon name="trash" className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Folder Body */}
        {!isCollapsed && (
          <div className="p-2 space-y-2">
            {/* Inline Subfolder Creation Form */}
            {creatingSubfolderParentId === folder.id && (
              <div className="p-2 rounded-lg border border-sky-500/30 bg-slate-900/60 mb-2">
                <div className="text-[10px] font-bold text-sky-400 mb-1">
                  New Subfolder in {folder.name}
                </div>
                <input
                  type="text"
                  placeholder="Subfolder name..."
                  maxLength={40}
                  value={subfolderName}
                  onChange={(e) => setSubfolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const trimmed = subfolderName.trim();
                      if (!trimmed) return;
                      const siblingConflict = (folder.children || []).some(
                        (c) => c.name.toLowerCase() === trimmed.toLowerCase()
                      );
                      if (siblingConflict) {
                        alert('A folder with that name already exists in this folder.');
                        return;
                      }
                      handleCreateFolder(trimmed, folder.id);
                      setSubfolderName('');
                      setCreatingSubfolderParentId(null);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setCreatingSubfolderParentId(null);
                      setSubfolderName('');
                    }
                  }}
                  className="w-full text-xs bg-slate-900 border border-slate-750 text-slate-200 px-2 py-1 rounded-lg focus:outline-none focus:border-sky-500 mb-1.5"
                  autoFocus
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingSubfolderParentId(null);
                      setSubfolderName('');
                    }}
                    className="px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-350 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = subfolderName.trim();
                      if (!trimmed) return;
                      const siblingConflict = (folder.children || []).some(
                        (c) => c.name.toLowerCase() === trimmed.toLowerCase()
                      );
                      if (siblingConflict) {
                        alert('A folder with that name already exists in this folder.');
                        return;
                      }
                      handleCreateFolder(trimmed, folder.id);
                      setSubfolderName('');
                      setCreatingSubfolderParentId(null);
                    }}
                    className="px-2 py-0.5 text-[10px] font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 rounded-lg transition cursor-pointer"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}

            {/* Nested Subfolders List */}
            {folder.children && folder.children.length > 0 && (
              <div className="space-y-2">
                {folder.children.map((childNode) => renderFolderNode(childNode))}
              </div>
            )}

            {/* Direct Assets Grid */}
            {folderAssets.length === 0 ? (
              (!folder.children || folder.children.length === 0) && (
                <p className="text-[10px] text-slate-500 text-center py-2.5 italic">
                  Drag custom uploads or drop files here.
                </p>
              )
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {folderAssets.map((img) => renderAssetCard(img))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

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
      className={`group fixed left-3 right-3 sm:left-6 sm:right-auto sm:w-80 top-20 sm:top-24 bottom-24 sm:bottom-28 z-40 flex flex-col bg-slate-950/80 backdrop-blur-md border border-slate-850 rounded-2xl p-4 sm:p-5 shadow-2xl overflow-hidden transition-all duration-300 ease-in-out select-none ${
        showLeftSidebar
          ? 'opacity-100 scale-100 pointer-events-auto'
          : 'opacity-0 -translate-x-10 scale-95 pointer-events-none'
      } ${
        leftPanelCollapsed ? '-translate-x-[calc(100%-12px)] opacity-40 hover:opacity-100 hover:border-sky-500/50 cursor-pointer' : 'translate-x-0'
      }`}
      onMouseEnter={leftPanelCollapsed ? () => setLeftPanelCollapsed(false) : undefined}
      onClick={leftPanelCollapsed ? () => setLeftPanelCollapsed(false) : undefined}
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
          <Icon name="x" className="w-4 h-4" />
        </button>
      </div>

      {/* Library Tabs */}
      <div className="flex rounded-xl bg-slate-900/60 p-1 border border-slate-800/80 mb-4 shrink-0">
        <button
          type="button"
          onClick={() => setLeftPanelTab('images')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
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
                    { type: 'rectangle', label: 'Rect' },
                    { type: 'circle', label: 'Circle' },
                    { type: 'triangle', label: 'Tri' },
                    { type: 'star', label: 'Star' },
                    { type: 'hexagon', label: 'Hex' },
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
                      <Icon name={`shape-${s.type}`} className="w-4 h-4" />
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
                    <Icon name="pipette" className="w-3 h-3 text-slate-400 pointer-events-none select-none" />
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
                        <Icon name="pipette" className="w-3 h-3 text-slate-400 pointer-events-none select-none" />
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
                <Icon name="plus" className="w-4 h-4" />
                <span>Spawn Shape</span>
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
                  <Icon name="search" className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search library..."
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
              {!showHiddenMode && activeFilter !== 'presets' && (
                <div className="space-y-2 border-t border-slate-900 pt-2 pb-1">
                  {showNewFolderForm ? (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
                      <input
                        type="text"
                        maxLength={40}
                        placeholder="Folder name..."
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const trimmed = newFolderName.trim();
                            if (trimmed) {
                              if (folders.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
                                alert('A folder with that name already exists.');
                                return;
                              }
                              handleCreateFolder(trimmed);
                              setNewFolderName('');
                              setShowNewFolderForm(false);
                            }
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setShowNewFolderForm(false);
                            setNewFolderName('');
                          }
                        }}
                        className="w-full text-xs bg-slate-900 border border-slate-850 text-slate-200 px-2 py-1 rounded-lg focus:outline-none focus:border-sky-500"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewFolderForm(false);
                            setNewFolderName('');
                          }}
                          className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-350 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = newFolderName.trim();
                            if (!trimmed) return;
                            if (folders.filter((f) => !f.parentId).some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
                              alert('A folder with that name already exists in this folder.');
                              return;
                            }
                            handleCreateFolder(trimmed, null);
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
                        <Icon name="folder-plus" className="w-3.5 h-3.5" />
                        <span>New Folder</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="pr-1 space-y-3">
                {/* Collapsible Folders Tree */}
                {!showHiddenMode && activeFilter !== 'presets' && folderTreeNodes.map((rootNode) => renderFolderNode(rootNode))}

                {/* Root / Uncategorized Dropzone Header */}
                {!showHiddenMode && activeFilter !== 'presets' && folders.length > 0 && (
                  <div
                    onDragOver={handleDragOverRoot}
                    onDragLeave={handleDragLeaveRoot}
                    onDrop={handleDropOnRoot}
                    className={`border border-dashed p-2.5 rounded-xl text-center select-none text-[10px] font-bold uppercase tracking-widest transition duration-150 ${
                      isOverRootDropzone
                        ? 'bg-sky-500/10 border-sky-500/50 text-sky-400'
                        : 'border-slate-800 text-slate-500 bg-slate-950/20 hover:border-slate-700'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <Icon name="folder-up" className="w-3.5 h-3.5" />
                      Drop here to move back to Root Library
                    </span>
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
                                maxLength={40}
                                value={editingAssetName}
                                onChange={(e) => setEditingAssetName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    saveAssetRename(img.id);
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setEditingAssetId(null);
                                    setEditingAssetName('');
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
                              <span className="text-[10px] font-bold text-rose-350 truncate max-w-[75%]" title={img.name}>
                                {img.name}
                              </span>
                              {!img.isPreset && (
                                <button
                                  type="button"
                                  onClick={(e) => startEditingAsset(e, img)}
                                  className="pointer-events-auto opacity-0 group-hover:opacity-100 text-slate-450 hover:text-white transition cursor-pointer ml-1 z-20"
                                  title="Rename Image"
                                >
                                  <Icon name="pencil" className="w-3 h-3" />
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
                            <Icon name="eye" className="w-3.5 h-3.5" />
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
                              <Icon name="trash" className="w-3.5 h-3.5" />
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

                    return (
                      <div
                        onDragOver={handleDragOverRoot}
                        onDragLeave={handleDragLeaveRoot}
                        onDrop={handleDropOnRoot}
                        className={`rounded-xl transition duration-150 ${
                          isOverRootDropzone ? 'ring-1 ring-sky-500/40 bg-sky-500/5 p-1' : ''
                        }`}
                      >
                        {rootAssets.length === 0 ? (
                          folders.length > 0 ? (
                            <p className="text-[10px] text-slate-500 text-center py-2.5 italic">
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
                        )}
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
                    <Icon name="upload" className="w-7 h-7 text-slate-500 group-hover:text-slate-400 transition" />
                    <span className="text-xs font-bold text-slate-400 group-hover:text-slate-350 transition">
                      Drag images here or browse
                    </span>
                    <span className="text-[10px] text-slate-650 max-w-[200px] leading-tight">PNG, JPG, GIF, WEBP up to 20MB</span>
                  </div>
                )}
              </div>
              {uploadError && (
                <p className="text-[10px] text-rose-455 font-semibold flex items-center gap-1">
                  <Icon name="alert-circle" className="w-3.5 h-3.5 shrink-0" />
                  <span>{uploadError}</span>
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
                    <div className="grid grid-cols-2 gap-2 pr-0.5">
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

                  {/* Grid Line Weight */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                      <span>Line Weight</span>
                      <span className="font-mono text-slate-200">{roomSettings.gridLineWidth || 1}px</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={roomSettings.gridLineWidth || 1}
                      onChange={(e) => handleUpdateRoomSettings({ gridLineWidth: parseInt(e.target.value, 10) })}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                  </div>

                  {/* Grid Line Color */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Line Color</span>
                      {roomSettings.gridColor && (
                        <button
                          type="button"
                          onClick={() => handleUpdateRoomSettings({ gridColor: null })}
                          className="text-[10px] text-sky-400 hover:text-sky-300 font-bold transition cursor-pointer"
                        >
                          Reset Default
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => handleUpdateRoomSettings({ gridColor: c })}
                          className={`w-6 h-6 rounded-full border transition-all duration-150 cursor-pointer hover:scale-110 active:scale-95 ${
                            roomSettings.gridColor === c
                              ? 'ring-2 ring-sky-500 border-white scale-105'
                              : 'border-slate-800'
                          }`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                      <div
                        className="relative w-6 h-6 rounded-full border border-slate-800 overflow-hidden cursor-pointer bg-slate-950 flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                        title="Custom Color Picker"
                      >
                        <input
                          type="color"
                          value={roomSettings.gridColor || '#475569'}
                          onChange={(e) => handleUpdateRoomSettings({ gridColor: e.target.value })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Icon name="pipette" className="w-3 h-3 text-slate-400 pointer-events-none select-none" />
                      </div>
                    </div>
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
              maxHeightClass=""
            />
          </div>
        )}
      </div>
    </aside>
  );
}
