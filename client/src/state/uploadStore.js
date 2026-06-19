import { EVENTS } from '../../../shared/protocol.js';
import { createContext, useContext, useState, useCallback, useMemo, createElement } from 'react';
import { SOCKET_URL, getSocket } from '../lib/socket.js';
import { newAssetId } from '../lib/ids.js';
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

  const handleImageUpload = useCallback(async (files) => {
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

    try {
      const response = await fetch(`${SOCKET_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success && data.files) {
        data.files.forEach((uploadedFile) => {
          const assetId = newAssetId();
          const originalName = uploadedFile.originalname || uploadedFile.filename;
          const assetName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
          const newAsset = { id: assetId, name: assetName, url: uploadedFile.url };

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
  }, []);

  const allImageAssets = useMemo(() => {
    const list = [];
    SAMPLE_IMAGES.forEach((url) => {
      const name = url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('.')) || url;
      list.push({ id: `preset_${name}`, name, url, isPreset: true });
    });
    assets.forEach((a) => {
      list.push({ ...a, isPreset: false });
    });
    return list;
  }, [assets]);

  const visibleAssets = useMemo(() => {
    return allImageAssets.filter((a) => !hiddenAssetUrls.includes(a.url));
  }, [allImageAssets, hiddenAssetUrls]);

  const hiddenAssets = useMemo(() => {
    return allImageAssets.filter((a) => hiddenAssetUrls.includes(a.url));
  }, [allImageAssets, hiddenAssetUrls]);

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
    hiddenAssets
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
    hiddenAssets
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
