import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Canvas from '../components/canvas/Canvas.jsx';
import DiceEffects from '../components/dice/DiceEffects.jsx';
import Header from '../components/header/Header.jsx';
import LeftSidebar from '../components/sidebar/LeftSidebar.jsx';
import RightSidebar from '../components/sidebar/RightSidebar.jsx';
import DiceRollerWidget from '../components/sidebar/DiceRollerWidget.jsx';
import TabButton from '../components/common/TabButton.jsx';
import DieIcon from '../components/common/DieIcon.jsx';
import SavesModal from '../components/saves/SavesModal.jsx';
import { SAMPLE_IMAGES } from '../constants.js';
import { SOCKET_URL, getSocket } from '../lib/socket.js';
import { getFullUrl } from '../lib/url.js';
import { locksArrayToMap } from '../lib/locks.js';
import { newElementId, newAssetId } from '../lib/ids.js';
import { mergeElement } from '../lib/mergeElement.js';
import { useUiStore } from '../state/uiStore.js';
import { useDiceStore } from '../state/diceStore.js';
import { useSelectionStore } from '../state/selectionStore.js';
import { useHistoryStore } from '../state/historyStore.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';

/**
 * AppContent Component.
 * Contains the main collaborative rendering context, socket listeners, and panels.
 */
export default function AppContent({
  connected,
  setConnected,
  joined,
  socketRef,
  currentUser,
  setCurrentUser,
  users,
  setUsers,
  tabs,
  setTabs,
  activeTabId,
  setActiveTabId,
  locks,
  setLocks,
  roomIdInput,
  handleSwitchTab,
  handleUpdateRoomSettings,
  handleCreateTab,
  handleDeleteTab,
  handleRenameTab
}) {
  const [showSavesModal, setShowSavesModal] = useState(false);
  const [saves, setSaves] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
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
  const [activeVirtualDimensions, setActiveVirtualDimensions] = useState({ width: 1920, height: 1080 });

  // States for collaborative drawing tool
  const [activeTool, setActiveTool] = useState('select'); // 'select', 'pan', 'pen', 'eraser', 'measure'
  const [penColor, setPenColor] = useState('#3b82f6');
  const [penSize, setPenSize] = useState(4);
  const [eraserSize, setEraserSize] = useState(20);

  const [showCursorNames, setShowCursorNames] = useState(() => {
    try {
      const saved = localStorage.getItem('canvas_show_cursor_names');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const {
    selectedElementIds,
    setSelectedElementIds,
    inputWidth, setInputWidth,
    inputHeight, setInputHeight,
    inputRotation, setInputRotation,
    isInspectorFocused, setIsInspectorFocused
  } = useSelectionStore();

  const {
    history,
    redoStack,
    pushHistoryAction,
    handleUndo,
    handleRedo,
    setHistory,
    setRedoStack
  } = useHistoryStore();

  // Register keyboard shortcuts hook
  useKeyboardShortcuts();

  // Clear selection when active tab changes
  useEffect(() => {
    setSelectedElementIds([]);
  }, [activeTabId, setSelectedElementIds]);

  const {
    showHeader,
    showLeftSidebar, setShowLeftSidebar,
    showRightSidebar, setShowRightSidebar,
    showTabsBar,
    leftPanelTab, setLeftPanelTab,
    showDiceRoller, setShowDiceRoller,
    leftPanelCollapsed, setLeftPanelCollapsed,
    rightPanelCollapsed, setRightPanelCollapsed,
    isZenMode, handleToggleZenMode, handleCanvasInteraction
  } = useUiStore();

  const {
    mixedDice, setMixedDice,
    d20Count, setD20Count,
    d20Mode, setD20Mode,
    activeRolls, setActiveRolls,
    rollHistory, setRollHistory,
    enable3dDice, setEnable3dDice,
    hoveredRoll, setHoveredRoll,
    shakeClass,
    rollTick, diceSizeMultiplier, setDiceSizeMultiplier,
    handleCriticalRoll, handleRollDice: storeRollDice
  } = useDiceStore();

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const elements = useMemo(() => activeTab ? activeTab.elements : [], [activeTab]);
  const roomSettings = activeTab ? activeTab.roomSettings : {};

  const nameRef = useRef('');
  const colorRef = useRef('');
  const roomIdRef = useRef('');
  const joinedRef = useRef(false);

  // Sync refs with latest state from props
  useEffect(() => {
    nameRef.current = currentUser?.name || '';
    colorRef.current = currentUser?.color || '';
    roomIdRef.current = roomIdInput;
    joinedRef.current = joined;
  }, [currentUser, roomIdInput, joined]);

  const activeTabIdRef = useRef('tab-default');
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    try {
      localStorage.setItem('canvas_show_cursor_names', JSON.stringify(showCursorNames));
    } catch (e) {
      console.error(e);
    }
  }, [showCursorNames]);

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
  }, [setTabs]);

  const handleRenameUser = useCallback((newName) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    if (!newName.trim()) return;

    socket.emit('user-rename', { name: newName.trim() }, (res) => {
      if (res && res.success) {
        nameRef.current = newName.trim();
      } else {
        alert(res?.error || 'Failed to rename user.');
      }
    });
  }, [socketRef]);

  const handleRecolorUser = useCallback((newColor) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    if (!newColor) return;

    // Optimistically update local states immediately
    setCurrentUser((prev) => (prev ? { ...prev, color: newColor } : null));
    setUsers((prev) =>
      prev.map((u) => (u.id === socket.id ? { ...u, color: newColor } : u))
    );
    setRollHistory((prev) =>
      prev.map((r) => (r.userId === socket.id ? { ...r, userColor: newColor } : r))
    );
    setActiveRolls((prev) =>
      prev.map((r) => (r.userId === socket.id ? { ...r, userColor: newColor } : r))
    );
    colorRef.current = newColor;

    socket.emit('user-recolor', { color: newColor }, (res) => {
      if (res && res.success) {
        // Optimistic update succeeded
      } else {
        console.error(res?.error || 'Failed to update color.');
      }
    });
  }, [setCurrentUser, setUsers, setActiveRolls, setRollHistory, socketRef]);

  const fetchSaves = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    socket.emit('save-list', (res) => {
      if (res && res.success) {
        setSaves(res.saves || []);
      } else {
        console.error('Failed to fetch saves:', res?.error);
      }
    });
  }, [socketRef]);

  const handleCreateSave = useCallback((name) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    socket.emit('save-create', { name }, (res) => {
      if (res && res.success) {
        fetchSaves();
      } else {
        alert(`Failed to create save: ${res?.error || 'Unknown error'}`);
      }
    });
  }, [fetchSaves, socketRef]);

  const handleLoadSave = useCallback((saveId) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    if (!confirm('Are you sure you want to load this save? This will overwrite the current canvas state for all connected users.')) {
      return;
    }

    socket.emit('save-load', { saveId }, (res) => {
      if (res && res.success) {
        setShowSavesModal(false);
      } else {
        alert(`Failed to load save: ${res?.error || 'Unknown error'}`);
      }
    });
  }, [socketRef]);

  const handleDeleteSave = useCallback((saveId) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    if (!confirm('Are you sure you want to delete this save?')) {
      return;
    }

    socket.emit('save-delete', { saveId }, (res) => {
      if (res && res.success) {
        fetchSaves();
      } else {
        alert(`Failed to delete save: ${res?.error || 'Unknown error'}`);
      }
    });
  }, [fetchSaves, socketRef]);

  const handleSpawnShape = useCallback(
    (type, fill, stroke, additionalProps = {}) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return;

      const id = newElementId();
      const element = {
        id,
        type,
        x: Math.floor(Math.random() * 200) + 120,
        y: Math.floor(Math.random() * 200) + 120,
        width: (type === 'circle' || type === 'star' || type === 'hexagon') ? 100 : 120,
        height: 100,
        properties: {
          fill,
          stroke,
          strokeWidth: additionalProps.strokeWidth !== undefined ? additionalProps.strokeWidth : 2,
          fillOpacity: additionalProps.fillOpacity !== undefined ? additionalProps.fillOpacity : 1,
          strokeOpacity: additionalProps.strokeOpacity !== undefined ? additionalProps.strokeOpacity : 1,
          strokeEnabled: additionalProps.strokeEnabled !== undefined ? additionalProps.strokeEnabled : true,
          rotation: 0,
        },
      };

      setElements((prev) => [...prev, element]);

      socket.emit('element-create', { element, tabId: activeTabIdRef.current }, (response) => {
        if (!response || !response.success) {
          // Rollback
          setElements((prev) => prev.filter((el) => el.id !== id));
          console.error('Failed to create shape element:', response?.error);
        } else {
          pushHistoryAction({
            type: 'create',
            elements: [element],
            tabId: activeTabIdRef.current,
          });
        }
      });
    },
    [setElements, pushHistoryAction, socketRef]
  );

  const handleSpawnImage = useCallback(
    (url) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return;

      const img = new Image();
      img.src = url;

      const spawnWithDimensions = (w, h) => {
        const id = newElementId();
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

        setElements((prev) => [...prev, element]);

        socket.emit('element-create', { element, tabId: activeTabIdRef.current }, (response) => {
          if (!response || !response.success) {
            // Rollback
            setElements((prev) => prev.filter((el) => el.id !== id));
            console.error('Failed to create image element:', response?.error);
          } else {
            pushHistoryAction({
              type: 'create',
              elements: [element],
              tabId: activeTabIdRef.current,
            });
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
        console.error('Failed to load image native dimensions:', url);
        spawnWithDimensions(Math.round(160 * (150 / 110)), 150);
      };
    },
    [setElements, pushHistoryAction, socketRef]
  );

  const handleImageUpload = useCallback(
    async (files) => {
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
    [socketRef]
  );

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

      pushHistoryAction({
        type: 'reorder',
        orderedIdsBefore: prev.map((el) => el.id),
        orderedIdsAfter: next.map((el) => el.id),
        tabId: activeTabIdRef.current,
      });

      return next;
    });
  }, [setElements, pushHistoryAction, socketRef]);

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

      pushHistoryAction({
        type: 'reorder',
        orderedIdsBefore: prev.map((el) => el.id),
        orderedIdsAfter: next.map((el) => el.id),
        tabId: activeTabIdRef.current,
      });

      return next;
    });
  }, [selectedElementIds, setElements, pushHistoryAction, socketRef]);

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

      pushHistoryAction({
        type: 'reorder',
        orderedIdsBefore: prev.map((el) => el.id),
        orderedIdsAfter: next.map((el) => el.id),
        tabId: activeTabIdRef.current,
      });

      return next;
    });
  }, [draggedElementId, setElements, pushHistoryAction, socketRef]);

  const inspectorLockRef = useRef(false);
  const originalInspectorElementsRef = useRef([]);

  const handleStartInspectorTransform = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const unlockedIds = selectedElementIds.filter((id) => {
      const lockHolderId = locks[id];
      return !lockHolderId || lockHolderId === currentUser?.id;
    });

    if (unlockedIds.length === 0) return;

    originalInspectorElementsRef.current = unlockedIds
      .map((id) => elements.find((item) => item.id === id))
      .filter(Boolean)
      .map((el) => JSON.parse(JSON.stringify(el)));

    socket.emit('element-lock', { elementIds: unlockedIds, tabId: activeTabIdRef.current }, (res) => {
      if (res && res.success) {
        inspectorLockRef.current = true;
        setIsInspectorFocused(true);
        setLocks((prev) => {
          const next = { ...prev };
          unlockedIds.forEach((id) => {
            next[id] = currentUser.id;
          });
          return next;
        });
      }
    });
  }, [selectedElementIds, locks, currentUser, elements, setLocks, socketRef, setIsInspectorFocused]);

  const handleEndInspectorTransform = useCallback(() => {
    setIsInspectorFocused(false);
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

      if (originalInspectorElementsRef.current.length > 0) {
        const currentElements = originalInspectorElementsRef.current
          .map((orig) => elements.find((item) => item.id === orig.id))
          .filter(Boolean)
          .map((el) => JSON.parse(JSON.stringify(el)));

        const changed = originalInspectorElementsRef.current.some((before) => {
          const after = currentElements.find((a) => a.id === before.id);
          if (!after) return true;
          return (
            before.x !== after.x ||
            before.y !== after.y ||
            before.width !== after.width ||
            before.height !== after.height ||
            (before.properties?.rotation || 0) !== (after.properties?.rotation || 0)
          );
        });

        if (changed) {
          pushHistoryAction({
            type: 'transform',
            elementsBefore: originalInspectorElementsRef.current,
            elementsAfter: currentElements,
            tabId: activeTabIdRef.current,
          });
        }
      }
    }
    inspectorLockRef.current = false;
    originalInspectorElementsRef.current = [];
  }, [selectedElementIds, locks, currentUser, elements, pushHistoryAction, setLocks, socketRef, setIsInspectorFocused]);

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

      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeTabIdRef.current) return t;
          return {
            ...t,
            elements: t.elements.map((el) => {
              const match = batch.find((b) => b.elementId === el.id);
              return match ? mergeElement(el, match.updates) : el;
            })
          };
        })
      );

      socket.emit('element-update', { batch, tabId: activeTabIdRef.current });
    },
    [selectedElementIds, elements, locks, currentUser, setTabs, socketRef]
  );

  const handleToggleSelectionLock = useCallback((elementId) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const el = elements.find((item) => item.id === elementId);
    if (!el) return;

    const currentlyLocked = !!el.properties?.locked;
    const nextLocked = !currentlyLocked;

    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        return {
          ...t,
          elements: t.elements.map((item) =>
            item.id === elementId
              ? mergeElement(item, { properties: { locked: nextLocked } })
              : item
          )
        };
      })
    );

    if (nextLocked) {
      setSelectedElementIds((prev) => prev.filter((id) => id !== elementId));
    }

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
  }, [elements, socketRef, setSelectedElementIds, setTabs]);

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

    const elementsToDelete = unlockedIds
      .map((id) => elements.find((item) => item.id === id))
      .filter(Boolean)
      .map((el) => JSON.parse(JSON.stringify(el)));

    socket.emit('element-delete', { elementIds: unlockedIds, tabId: activeTabIdRef.current }, (res) => {
      if (res && res.success) {
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id !== activeTabIdRef.current) return t;
            return {
              ...t,
              elements: t.elements.filter((el) => !unlockedIds.includes(el.id)),
            };
          })
        );
        setSelectedElementIds((prev) => prev.filter((id) => !unlockedIds.includes(id)));
        pushHistoryAction({
          type: 'delete',
          elements: elementsToDelete,
          tabId: activeTabIdRef.current,
        });
      }
    });
  }, [selectedElementIds, elements, locks, currentUser, pushHistoryAction, setSelectedElementIds, setTabs, socketRef]);

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

      const elementsToDelete = unlockableDrawingIds
        .map((id) => elements.find((item) => item.id === id))
        .filter(Boolean)
        .map((el) => JSON.parse(JSON.stringify(el)));

      socket.emit('element-delete', { elementIds: unlockableDrawingIds, tabId: activeTabIdRef.current }, (res) => {
        if (res && res.success) {
          setTabs((prev) =>
            prev.map((t) => {
              if (t.id !== activeTabIdRef.current) return t;
              return {
                ...t,
                elements: t.elements.filter((el) => !unlockableDrawingIds.includes(el.id)),
              };
            })
          );
          setSelectedElementIds((prev) => prev.filter((id) => !unlockableDrawingIds.includes(id)));
          pushHistoryAction({
            type: 'delete',
            elements: elementsToDelete,
            tabId: activeTabIdRef.current,
          });
        }
      });
    }
  }, [elements, locks, currentUser, setSelectedElementIds, pushHistoryAction, setTabs, socketRef]);

  const handleRollDice = useCallback(() => {
    storeRollDice(currentUser?.color);
  }, [storeRollDice, currentUser]);

  // Connect socket and register general listeners
  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;

    const onConnect = () => {
      setConnected(true);
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
              const formattedTabs = (res.tabs || []).map((tab) => ({
                ...tab,
                locks: locksArrayToMap(tab.locks),
              }));
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
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    s.on('user-joined', (user) => {
      setUsers((prev) => [...prev.filter((u) => u.id !== user.id), user]);
    });

    s.on('user-renamed', ({ userId, name }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, name } : u))
      );
      if (userId === s.id) {
        setCurrentUser((prev) => (prev ? { ...prev, name } : null));
      }
      setRollHistory((prev) =>
        prev.map((r) => (r.userId === userId ? { ...r, userName: name } : r))
      );
      setActiveRolls((prev) =>
        prev.map((r) => (r.userId === userId ? { ...r, userName: name } : r))
      );
    });

    s.on('user-recolored', ({ userId, color }) => {
      if (userId !== s.id) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, color } : u))
        );
      }
      setRollHistory((prev) =>
        prev.map((r) => (r.userId === userId ? { ...r, userColor: color } : r))
      );
      setActiveRolls((prev) =>
        prev.map((r) => (r.userId === userId ? { ...r, userColor: color } : r))
      );
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
            elements: t.elements.map((el) =>
              el.id === elementId ? mergeElement(el, updates) : el
            ),
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
              return match ? mergeElement(el, match.updates) : el;
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
        return [
          ...prev,
          {
            ...tab,
            locks: locksArrayToMap(tab.locks),
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

    s.on('room-state-loaded', ({ tabs, assets }) => {
      const formattedTabs = (tabs || []).map((tab) => ({
        ...tab,
        locks: locksArrayToMap(tab.locks),
      }));
      setTabs(formattedTabs);
      setAssets(assets || []);
      
      setActiveTabId((prev) => {
        if (formattedTabs.some((t) => t.id === prev)) {
          return prev;
        }
        return formattedTabs.length > 0 ? formattedTabs[0].id : 'tab-default';
      });

      setHistory([]);
      setRedoStack([]);
      setSelectedElementIds([]);
    });

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('user-joined');
      s.off('user-renamed');
      s.off('user-recolored');
      s.off('user-left');
      s.off('cursor-update');
      s.off('tab-switched');
      s.off('element-locked');
      s.off('element-unlocked');
      s.off('element-updated');
      s.off('element-updated-batch');
      s.off('element-created');
      s.off('element-deleted');
      s.off('asset-created');
      s.off('elements-reordered');
      s.off('room-settings-updated');
      s.off('tab-created');
      s.off('tab-deleted');
      s.off('tab-renamed');
      s.off('dice-rolled');
      s.off('room-state-loaded');
    };
  }, [setActiveRolls, setRollHistory, setTabs, setUsers, setAssets, setCurrentUser, setActiveTabId, setLocks, setSelectedElementIds, setHistory, setRedoStack, socketRef, activeTabId, setConnected]);

  return (
    <div className={`flex-1 flex flex-col bg-[#070b13] overflow-hidden text-slate-100 h-full ${shakeClass}`}>
      {/* Header */}
      <Header
        showHeader={showHeader}
        roomIdInput={roomIdInput}
        connected={connected}
        users={users}
        currentUser={currentUser}
        tabs={tabs}
        handleRecolorUser={handleRecolorUser}
        handleRenameUser={handleRenameUser}
        handleUndo={handleUndo}
        undoDisabled={history.length === 0}
        handleRedo={handleRedo}
        redoDisabled={redoStack.length === 0}
        onOpenSaves={() => {
          fetchSaves();
          setShowSavesModal(true);
        }}
      />

      {/* Main Workspace Panels */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Library Sidebar */}
        <LeftSidebar
          showLeftSidebar={showLeftSidebar}
          setShowLeftSidebar={setShowLeftSidebar}
          leftPanelCollapsed={leftPanelCollapsed}
          setLeftPanelCollapsed={setLeftPanelCollapsed}
          leftPanelTab={leftPanelTab}
          setLeftPanelTab={setLeftPanelTab}
          visibleAssets={visibleAssets}
          hiddenAssets={hiddenAssets}
          showHiddenMode={showHiddenMode}
          setShowHiddenMode={setShowHiddenMode}
          roomSettings={roomSettings}
          allImageAssets={allImageAssets}
          activeVirtualDimensions={activeVirtualDimensions}
          showCursorNames={showCursorNames}
          setShowCursorNames={setShowCursorNames}
          users={users}
          currentUser={currentUser}
          tabs={tabs}
          isUploading={isUploading}
          uploadError={uploadError}
          handleSpawnShape={handleSpawnShape}
          handleSpawnImage={handleSpawnImage}
          handleUpdateRoomSettings={handleUpdateRoomSettings}
          handleImageUpload={handleImageUpload}
          toggleHideAsset={toggleHideAsset}
          hiddenAssetUrls={hiddenAssetUrls}
          setHiddenAssetUrls={setHiddenAssetUrls}
          handleRecolorUser={handleRecolorUser}
          getFullUrl={getFullUrl}
        />

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
                <button
                  type="button"
                  onClick={() => setActiveTool('measure')}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    activeTool === 'measure'
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                  title="Measurement Tool (Ruler)"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
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
                      ? 'bg-indigo-650 border-indigo-500 text-white shadow-md shadow-indigo-650/20'
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
              pushHistoryAction={pushHistoryAction}
            />
          </div>
        </main>

        {/* Right Sidebar Inspector Floating Panel */}
        <RightSidebar
          showRightSidebar={showRightSidebar}
          setShowRightSidebar={setShowRightSidebar}
          rightPanelCollapsed={rightPanelCollapsed}
          setRightPanelCollapsed={setRightPanelCollapsed}
          users={users}
          currentUser={currentUser}
          elements={elements}
          setElements={setElements}
          locks={locks}
          selectedElementIds={selectedElementIds}
          setSelectedElementIds={setSelectedElementIds}
          activeTabId={activeTabId}
          tabs={tabs}
          socketRef={socketRef}
          inputWidth={inputWidth}
          setInputWidth={setInputWidth}
          inputHeight={inputHeight}
          setInputHeight={setInputHeight}
          inputRotation={inputRotation}
          setInputRotation={setInputRotation}
          isInspectorFocused={isInspectorFocused}
          setIsInspectorFocused={setIsInspectorFocused}
          handleStartInspectorTransform={handleStartInspectorTransform}
          handleEndInspectorTransform={handleEndInspectorTransform}
          handleInspectorChange={handleInspectorChange}
          adjustSelectedElementsLayer={adjustSelectedElementsLayer}
          handleDeleteSelected={handleDeleteSelected}
          adjustElementLayer={adjustElementLayer}
          handleToggleSelectionLock={handleToggleSelectionLock}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          handleDragEnd={handleDragEnd}
          handleDrop={handleDrop}
          draggedElementId={draggedElementId}
          dragOverElementId={dragOverElementId}
          pushHistoryAction={pushHistoryAction}
        />
      </div>

      {/* Floating Dice Roller Card Popover */}
      <DiceRollerWidget
        showDiceRoller={showDiceRoller}
        setShowDiceRoller={setShowDiceRoller}
        enable3dDice={enable3dDice}
        setEnable3dDice={setEnable3dDice}
        diceSizeMultiplier={diceSizeMultiplier}
        setDiceSizeMultiplier={setDiceSizeMultiplier}
        d20Count={d20Count}
        setD20Count={setD20Count}
        d20Mode={d20Mode}
        setD20Mode={setD20Mode}
        mixedDice={mixedDice}
        setMixedDice={setMixedDice}
        rollHistory={rollHistory}
        setRollHistory={setRollHistory}
        hoveredRoll={hoveredRoll}
        setHoveredRoll={setHoveredRoll}
        handleRollDice={handleRollDice}
        currentUser={currentUser}
      />

      {/* Dice Roll Broadcast Overlay Notifications */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-4.5 pointer-events-none max-w-sm sm:max-w-md w-full">
        {activeRolls.map((roll) => {
          const isRolling = roll.status === 'rolling';
          
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
                          userColor={roll.userColor}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 w-full">
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
                                    userColor={roll.userColor}
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

          <div className="flex flex-col gap-3.5 py-1 bg-slate-950/40 border border-slate-950/80 p-3 rounded-xl max-h-60 overflow-y-auto custom-scrollbar">
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
                            userColor={hoveredRoll.userColor}
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
        <DiceEffects activeRolls={activeRolls} onCriticalRoll={handleCriticalRoll} diceSizeMultiplier={diceSizeMultiplier} />
      )}

      {showSavesModal && (
        <SavesModal
          saves={saves}
          onClose={() => setShowSavesModal(false)}
          onCreateSave={handleCreateSave}
          onLoadSave={handleLoadSave}
          onDeleteSave={handleDeleteSave}
        />
      )}
    </div>
  );
}
