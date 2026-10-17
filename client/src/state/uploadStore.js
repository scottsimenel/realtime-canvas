import { EVENTS } from '../../../shared/protocol.js';
import { createContext, useContext, useState, useCallback, useMemo, createElement } from 'react';
import { SOCKET_URL, getSocket } from '../lib/socket.js';
import { newAssetId, newFolderId } from '../lib/ids.js';
import { SAMPLE_IMAGES } from '../constants.js';
import {
  MAX_FOLDER_DEPTH,
  getFolderDepth,
  canMoveFolder,
  resolveUniqueSiblingName,
  getAncestorFolderIds
} from '../lib/folderTree.js';

const UploadContext = createContext(null);

/**
 * Upload State Store Provider.
 * Manages images/assets list, hidden/visible filters, and upload states.
 */
export function UploadProvider({ children }) {
  const [assets, setAssets] = useState([]);
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'presets' | 'uploads'
  const [folders, setFolders] = useState([]);
  const [currentRoomId, setCurrentRoomId] = useState('canvas-default');

  const toggleHideAsset = useCallback((url) => {
    setHiddenAssetUrls((prev) => {
      const next = prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url];
      localStorage.setItem('canvas_hidden_assets', JSON.stringify(next));
      if (next.length === 0) {
        setShowHiddenMode(false);
      }
      return next;
    });
  }, []);

  const handleImageUpload = useCallback(async (files, targetRoomId, targetFolderId = null) => {
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    const filesToUpload = filesArray.slice(0, 50);

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

    const room = (targetRoomId || currentRoomId || 'canvas-default').trim();

    try {
      const response = await fetch(`${SOCKET_URL}/api/upload?roomId=${encodeURIComponent(room)}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success && data.files) {
        data.files.forEach((uploadedFile) => {
          const assetId = newAssetId();
          const originalName = uploadedFile.originalname || uploadedFile.filename;
          const assetName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
          const newAsset = {
            id: assetId,
            name: assetName,
            url: uploadedFile.url,
            folderId: targetFolderId || null,
          };

          const socket = getSocket();
          if (socket && socket.connected) {
            socket.emit(EVENTS.ASSET_CREATE, { asset: newAsset }, (res) => {
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
  }, [currentRoomId]);

  const handleRenameAsset = useCallback((assetId, newName) => {
    if (!newName || !newName.trim()) return;
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit(EVENTS.ASSET_RENAME, { assetId, name: newName.trim() }, (res) => {
        if (res && res.success && res.asset) {
          setAssets((prev) => prev.map((a) => (a.id === assetId ? res.asset : a)));
        }
      });
    } else {
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, name: newName.trim() } : a))
      );
    }
  }, []);

  const handleDeleteAsset = useCallback((assetId) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit(EVENTS.ASSET_DELETE, { assetId }, (res) => {
        if (res && res.success) {
          setAssets((prev) => prev.filter((a) => a.id !== assetId));
        }
      });
    } else {
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    }
  }, []);

  const handleCreateFolder = useCallback((name, parentId = null) => {
    const trimmed = name ? name.trim() : '';
    if (!trimmed) return;
    const safeParentId = parentId || null;

    if (safeParentId) {
      const depth = getFolderDepth(safeParentId, folders);
      if (depth >= MAX_FOLDER_DEPTH) {
        setUploadError(`Maximum folder nesting limit of ${MAX_FOLDER_DEPTH} levels reached.`);
        return;
      }
    }

    if (folders.some((f) => (f.parentId || null) === safeParentId && f.name.toLowerCase() === trimmed.toLowerCase())) {
      setUploadError('A folder with that name already exists in this folder.');
      return;
    }
    setUploadError('');

    const socket = getSocket();
    const folderId = newFolderId();
    const newFolder = { id: folderId, name: trimmed, parentId: safeParentId };

    // Optimistic update
    setFolders((prev) => [...prev.filter((f) => f.id !== folderId), newFolder]);

    if (socket && socket.connected) {
      socket.emit(EVENTS.FOLDER_CREATE, { folder: newFolder }, (res) => {
        if (res && res.success && res.folder) {
          setFolders((prev) => [...prev.filter((f) => f.id !== res.folder.id), res.folder]);
        } else {
          // Rollback on failure
          setFolders((prev) => prev.filter((f) => f.id !== folderId));
          if (res?.error) setUploadError(res.error);
        }
      });
    }
  }, [folders]);

  const handleRenameFolder = useCallback((folderId, name) => {
    const trimmed = name ? name.trim() : '';
    if (!trimmed) return;
    const current = folders.find((f) => f.id === folderId);
    if (!current || current.name === trimmed) return;

    const safeParentId = current.parentId || null;
    if (folders.some((f) => f.id !== folderId && (f.parentId || null) === safeParentId && f.name.toLowerCase() === trimmed.toLowerCase())) {
      setUploadError('A folder with that name already exists in this folder.');
      return;
    }
    setUploadError('');

    const previousFolders = folders;
    // Optimistic update
    setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, name: trimmed } : f)));

    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit(EVENTS.FOLDER_RENAME, { folderId, name: trimmed }, (res) => {
        if (res && res.success && res.folder) {
          setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, ...res.folder } : f)));
        } else {
          // Rollback on failure
          setFolders(previousFolders);
          if (res?.error) setUploadError(res.error);
        }
      });
    }
  }, [folders]);

  const handleMoveFolder = useCallback((folderId, targetParentId = null) => {
    const safeTargetParentId = targetParentId || null;
    const validation = canMoveFolder(folderId, safeTargetParentId, folders);
    if (!validation.valid) {
      if (validation.error) setUploadError(validation.error);
      return;
    }
    setUploadError('');

    const previousFolders = folders;
    // Optimistic update
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, parentId: safeTargetParentId } : f))
    );

    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit(EVENTS.FOLDER_MOVE, { folderId, parentId: safeTargetParentId }, (res) => {
        if (res && res.success && res.folder) {
          setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, ...res.folder } : f)));
        } else {
          // Rollback on failure
          setFolders(previousFolders);
          if (res?.error) setUploadError(res.error);
        }
      });
    }
  }, [folders]);

  const handleDeleteFolder = useCallback((folderId) => {
    const target = folders.find((f) => f.id === folderId);
    if (!target) return;
    const fallbackParentId = target.parentId || null;

    const previousFolders = folders;
    const previousAssets = assets;

    // Optimistic non-cascading promotion of child folders and assets
    const childFolders = folders.filter((f) => f.parentId === folderId);
    const remainingFolders = folders.filter((f) => f.id !== folderId);

    const promotedChildren = childFolders.map((child) => {
      const uniqueName = resolveUniqueSiblingName(
        child.name,
        fallbackParentId,
        remainingFolders,
        child.id
      );
      return { ...child, name: uniqueName, parentId: fallbackParentId };
    });

    const nextFolders = [
      ...remainingFolders.filter((f) => f.parentId !== folderId),
      ...promotedChildren
    ];

    setFolders(nextFolders);
    setAssets((prev) =>
      prev.map((a) => (a.folderId === folderId ? { ...a, folderId: fallbackParentId } : a))
    );

    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit(EVENTS.FOLDER_DELETE, { folderId }, (res) => {
        if (res && res.success) {
          if (Array.isArray(res.promotedFolders)) {
            setFolders((prev) => {
              const promotedMap = new Map(res.promotedFolders.map((p) => [p.id, p]));
              return prev.map((f) => promotedMap.get(f.id) || f);
            });
          }
        } else {
          // Rollback on failure
          setFolders(previousFolders);
          setAssets(previousAssets);
          if (res?.error) setUploadError(res.error);
        }
      });
    }
  }, [folders, assets]);

  const handleMoveAsset = useCallback((assetId, folderId) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit(EVENTS.ASSET_MOVE, { assetId, folderId }, (res) => {
        if (res && res.success && res.asset) {
          setAssets((prev) =>
            prev.map((a) => (a.id === assetId ? { ...a, folderId: res.asset.folderId } : a))
          );
        }
      });
    } else {
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, folderId: folderId || null } : a))
      );
    }
  }, []);

  const allImageAssets = useMemo(() => {
    const list = [];
    SAMPLE_IMAGES.forEach((item) => {
      const { name, url } = item || {};
      if (url && name) {
        list.push({ id: `preset_${name}`, name, url, isPreset: true, folderId: null });
      }
    });
    assets.forEach((a) => {
      list.push({ ...a, isPreset: false, folderId: a.folderId || null });
    });
    return list;
  }, [assets]);

  const visibleAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const folderMap = new Map(folders.map((f) => [f.id, f]));

    return allImageAssets.filter((a) => {
      if (hiddenAssetUrls.includes(a.url)) return false;
      if (activeFilter === 'presets' && !a.isPreset) return false;
      if (activeFilter === 'uploads' && a.isPreset) return false;
      if (query) {
        const assetNameMatch = a.name.toLowerCase().includes(query);
        if (assetNameMatch) return true;

        if (a.folderId) {
          const selfFolder = folderMap.get(a.folderId);
          if (selfFolder && selfFolder.name.toLowerCase().includes(query)) {
            return true;
          }
          const ancestorIds = getAncestorFolderIds(a.folderId, folders);
          const ancestorMatch = ancestorIds.some((ancId) => {
            const anc = folderMap.get(ancId);
            return anc && anc.name.toLowerCase().includes(query);
          });
          if (ancestorMatch) return true;
        }
        return false;
      }
      return true;
    });
  }, [allImageAssets, hiddenAssetUrls, activeFilter, searchQuery, folders]);

  const hiddenAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const folderMap = new Map(folders.map((f) => [f.id, f]));

    return allImageAssets.filter((a) => {
      if (!hiddenAssetUrls.includes(a.url)) return false;
      if (activeFilter === 'presets' && !a.isPreset) return false;
      if (activeFilter === 'uploads' && a.isPreset) return false;
      if (query) {
        const assetNameMatch = a.name.toLowerCase().includes(query);
        if (assetNameMatch) return true;

        if (a.folderId) {
          const selfFolder = folderMap.get(a.folderId);
          if (selfFolder && selfFolder.name.toLowerCase().includes(query)) {
            return true;
          }
          const ancestorIds = getAncestorFolderIds(a.folderId, folders);
          const ancestorMatch = ancestorIds.some((ancId) => {
            const anc = folderMap.get(ancId);
            return anc && anc.name.toLowerCase().includes(query);
          });
          if (ancestorMatch) return true;
        }
        return false;
      }
      return true;
    });
  }, [allImageAssets, hiddenAssetUrls, activeFilter, searchQuery, folders]);

  const value = useMemo(() => ({
    assets,
    setAssets,
    hiddenAssetUrls,
    setHiddenAssetUrls,
    showHiddenMode,
    setShowHiddenMode,
    draggedElementId,
    setDraggedElementId,
    dragOverElementId,
    setDragOverElementId,
    isUploading,
    setIsUploading,
    uploadError,
    setUploadError,
    toggleHideAsset,
    handleImageUpload,
    allImageAssets,
    visibleAssets,
    hiddenAssets,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    handleRenameAsset,
    handleDeleteAsset,
    folders,
    setFolders,
    handleCreateFolder,
    handleRenameFolder,
    handleMoveFolder,
    handleDeleteFolder,
    handleMoveAsset,
    currentRoomId,
    setCurrentRoomId
  }), [
    assets,
    hiddenAssetUrls,
    showHiddenMode,
    draggedElementId,
    dragOverElementId,
    isUploading,
    uploadError,
    toggleHideAsset,
    handleImageUpload,
    allImageAssets,
    visibleAssets,
    hiddenAssets,
    searchQuery,
    activeFilter,
    handleRenameAsset,
    handleDeleteAsset,
    folders,
    handleCreateFolder,
    handleRenameFolder,
    handleMoveFolder,
    handleDeleteFolder,
    handleMoveAsset,
    currentRoomId
  ]);

  return createElement(UploadContext.Provider, { value }, children);
}

/**
 * Hook to consume the Upload state store context.
 * @returns {object} The Upload state store values and setters.
 */
export function useUploadStore() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUploadStore must be used within an UploadProvider');
  }
  return context;
}
