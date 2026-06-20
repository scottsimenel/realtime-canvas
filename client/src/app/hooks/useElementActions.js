import { EVENTS } from '../../../../shared/protocol.js';
import { useCallback } from 'react';
import { getSocket } from '../../lib/socket.js';
import { newElementId } from '../../lib/ids.js';
import { useCanvasStore } from '../../state/canvasStore.js';
import { useHistoryStore } from '../../state/historyStore.js';
import { useSelectionStore } from '../../state/selectionStore.js';
import { useUploadStore } from '../../state/uploadStore.js';

/**
 * Hook to manage element spawning, layer ordering, and drag-reordering.
 * @returns {object} The action handlers.
 */
export function useElementActions() {
  const { setElements, activeTabId } = useCanvasStore();
  const { pushHistoryAction } = useHistoryStore();
  const { selectedElementIds } = useSelectionStore();
  const {
    draggedElementId,
    setDraggedElementId,
    setDragOverElementId
  } = useUploadStore();

  const handleSpawnShape = useCallback(
    (type, fill, stroke, additionalProps = {}) => {
      const socket = getSocket();
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

      socket.emit(EVENTS.ELEMENT_CREATE, { element, tabId: activeTabId }, (response) => {
        if (!response || !response.success) {
          // Rollback
          setElements((prev) => prev.filter((el) => el.id !== id));
          console.error('Failed to create shape element:', response?.error);
        } else {
          pushHistoryAction({
            type: 'create',
            elements: [element],
            tabId: activeTabId,
          });
        }
      });
    },
    [setElements, pushHistoryAction, activeTabId]
  );

  const handleSpawnImage = useCallback(
    (url, customX, customY) => {
      const socket = getSocket();
      if (!socket || !socket.connected) return;

      const img = new Image();
      img.src = url;

      const spawnWithDimensions = (w, h) => {
        const id = newElementId();
        let spawnX, spawnY;

        if (customX !== undefined && customY !== undefined) {
          spawnX = customX - w / 2;
          spawnY = customY - h / 2;
        } else {
          spawnX = Math.floor(Math.random() * 200) + 120;
          spawnY = Math.floor(Math.random() * 200) + 120;
        }

        const element = {
          id,
          type: 'image',
          x: spawnX,
          y: spawnY,
          width: w,
          height: h,
          properties: {
            url,
          },
        };

        setElements((prev) => [...prev, element]);

        socket.emit(EVENTS.ELEMENT_CREATE, { element, tabId: activeTabId }, (response) => {
          if (!response || !response.success) {
            // Rollback
            setElements((prev) => prev.filter((el) => el.id !== id));
            console.error('Failed to create image element:', response?.error);
          } else {
            pushHistoryAction({
              type: 'create',
              elements: [element],
              tabId: activeTabId,
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
    [setElements, pushHistoryAction, activeTabId]
  );

  const adjustElementLayer = useCallback((elementId, direction) => {
    setElements((prev) => {
      const next = [...prev];
      const index = next.findIndex((el) => el.id === elementId);
      if (index === -1) return prev;

      if (direction === 'front') {
        const temp = next[index];
        next.splice(index, 1);
        next.push(temp);
      } else if (direction === 'back') {
        const temp = next[index];
        next.splice(index, 1);
        next.unshift(temp);
      } else if (direction === 'forward' && index < next.length - 1) {
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

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit(EVENTS.ELEMENTS_REORDER, { orderedIds: next.map((el) => el.id), tabId: activeTabId });
      }

      pushHistoryAction({
        type: 'reorder',
        orderedIdsBefore: prev.map((el) => el.id),
        orderedIdsAfter: next.map((el) => el.id),
        tabId: activeTabId,
      });

      return next;
    });
  }, [setElements, pushHistoryAction, activeTabId]);

  const adjustSelectedElementsLayer = useCallback((direction) => {
    if (selectedElementIds.length === 0) return;

    setElements((prev) => {
      const next = [...prev];
      const selectedIndices = selectedElementIds
        .map((id) => next.findIndex((el) => el.id === id))
        .filter((idx) => idx !== -1)
        .sort((a, b) => a - b);

      if (direction === 'front') {
        const unselected = next.filter((el) => !selectedElementIds.includes(el.id));
        const selected = next.filter((el) => selectedElementIds.includes(el.id));
        next.length = 0;
        next.push(...unselected, ...selected);
      } else if (direction === 'back') {
        const unselected = next.filter((el) => !selectedElementIds.includes(el.id));
        const selected = next.filter((el) => selectedElementIds.includes(el.id));
        next.length = 0;
        next.push(...selected, ...unselected);
      } else if (direction === 'forward') {
        for (let i = selectedIndices.length - 1; i >= 0; i--) {
          const idx = selectedIndices[i];
          if (idx < next.length - 1) {
            const temp = next[idx];
            next[idx] = next[idx + 1];
            next[idx + 1] = temp;
          }
        }
      } else if (direction === 'backward') {
        for (let i = 0; i < selectedIndices.length; i++) {
          const idx = selectedIndices[i];
          if (idx > 0) {
            const temp = next[idx];
            next[idx] = next[idx - 1];
            next[idx - 1] = temp;
          }
        }
      } else {
        return prev;
      }

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit(EVENTS.ELEMENTS_REORDER, { orderedIds: next.map((el) => el.id), tabId: activeTabId });
      }

      pushHistoryAction({
        type: 'reorder',
        orderedIdsBefore: prev.map((el) => el.id),
        orderedIdsAfter: next.map((el) => el.id),
        tabId: activeTabId,
      });

      return next;
    });
  }, [selectedElementIds, setElements, pushHistoryAction, activeTabId]);

  const handleDragStart = useCallback((e, id) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedElementId(id);
  }, [setDraggedElementId]);

  const handleDragOver = useCallback((e, id) => {
    e.preventDefault();
    if (draggedElementId && draggedElementId !== id) {
      setDragOverElementId(id);
    }
  }, [draggedElementId, setDragOverElementId]);

  const handleDragLeave = useCallback(() => {
    setDragOverElementId(null);
  }, [setDragOverElementId]);

  const handleDragEnd = useCallback(() => {
    setDraggedElementId(null);
    setDragOverElementId(null);
  }, [setDraggedElementId, setDragOverElementId]);

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

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit(EVENTS.ELEMENTS_REORDER, { orderedIds: next.map((el) => el.id), tabId: activeTabId });
      }

      pushHistoryAction({
        type: 'reorder',
        orderedIdsBefore: prev.map((el) => el.id),
        orderedIdsAfter: next.map((el) => el.id),
        tabId: activeTabId,
      });

      return next;
    });
  }, [draggedElementId, setElements, pushHistoryAction, activeTabId, setDraggedElementId, setDragOverElementId]);

  return {
    handleSpawnShape,
    handleSpawnImage,
    adjustElementLayer,
    adjustSelectedElementsLayer,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDragEnd,
    handleDrop
  };
}
