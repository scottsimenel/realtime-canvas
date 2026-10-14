import { EVENTS } from '../../../shared/protocol.js';
import { createContext, useContext, useState, useCallback, useMemo, createElement } from 'react';
import { SOCKET_URL, getSocket } from '../lib/socket.js';
import { newAssetId, newFolderId } from '../lib/ids.js';
import { SAMPLE_IMAGES } from '../constants.js';

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

  const handleCreateFolder = useCallback((name) => {
    const trimmed = name ? name.trim() : '';
    if (!trimmed) return;
    if (folders.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
      setUploadError('A folder with that name already exists.');
      return;
    }
    setUploadError('');
    const socket = getSocket();
    const folderId = newFolderId();
    const newFolder = { id: folderId, name: trimmed };
    if (socket && socket.connected) {
      socket.emit(EVENTS.FOLDER_CREATE, { folder: newFolder }, (res) => {
        if (res && res.success && res.folder) {
          setFolders((prev) => [...prev.filter((f) => f.id !== res.folder.id), res.folder]);
        }
      });
    } else {
      setFolders((prev) => [...prev, newFolder]);
    }
  }, [folders]);

  const handleRenameFolder = useCallback((folderId, name) => {
    const trimmed = name ? name.trim() : '';
    if (!trimmed) return;
    const current = folders.find((f) => f.id === folderId);
    if (current && current.name === trimmed) return;
    if (folders.some((f) => f.id !== folderId && f.name.toLowerCase() === trimmed.toLowerCase())) {
      setUploadError('A folder with that name already exists.');
      return;
    }
    setUploadError('');
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit(EVENTS.FOLDER_RENAME, { folderId, name: trimmed }, (res) => {
        if (res && res.success && res.folder) {
          setFolders((prev) => prev.map((f) => (f.id === folderId ? res.folder : f)));
        }
      });
    } else {
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, name: trimmed } : f))
      );
    }
  }, [folders]);

  const handleDeleteFolder = useCallback((folderId) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit(EVENTS.FOLDER_DELETE, { folderId }, (res) => {
        if (res && res.success) {
          setFolders((prev) => prev.filter((f) => f.id !== folderId));
          setAssets((prev) =>
            prev.map((a) => (a.folderId === folderId ? { ...a, folderId: null } : a))
          );
        }
      });
    } else {
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setAssets((prev) =>
        prev.map((a) => (a.folderId === folderId ? { ...a, folderId: null } : a))
      );
    }
  }, []);

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
    const folderMap = new Map(folders.map((f) => [f.id, f.name.toLowerCase()]));

    return allImageAssets.filter((a) => {
      if (hiddenAssetUrls.includes(a.url)) return false;
      if (activeFilter === 'presets' && !a.isPreset) return false;
      if (activeFilter === 'uploads' && a.isPreset) return false;
      if (query) {
        const assetNameMatch = a.name.toLowerCase().includes(query);
        const folderName = a.folderId ? folderMap.get(a.folderId) : null;
        const folderMatch = folderName ? folderName.includes(query) : false;
        if (!assetNameMatch && !folderMatch) return false;
      }
      return true;
    });
  }, [allImageAssets, hiddenAssetUrls, activeFilter, searchQuery, folders]);

  const hiddenAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const folderMap = new Map(folders.map((f) => [f.id, f.name.toLowerCase()]));

    return allImageAssets.filter((a) => {
      if (!hiddenAssetUrls.includes(a.url)) return false;
      if (activeFilter === 'presets' && !a.isPreset) return false;
      if (activeFilter === 'uploads' && a.isPreset) return false;
      if (query) {
        const assetNameMatch = a.name.toLowerCase().includes(query);
        const folderName = a.folderId ? folderMap.get(a.folderId) : null;
        const folderMatch = folderName ? folderName.includes(query) : false;
        if (!assetNameMatch && !folderMatch) return false;
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
