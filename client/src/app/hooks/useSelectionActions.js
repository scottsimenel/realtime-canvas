import { EVENTS } from '../../../../shared/protocol.js';
import { useCallback } from 'react';
import { getSocket } from '../../lib/socket.js';
import { mergeElement } from '../../lib/mergeElement.js';
import { useCanvasStore } from '../../state/canvasStore.js';
import { useSelectionStore } from '../../state/selectionStore.js';
import { useHistoryStore } from '../../state/historyStore.js';

/**
 * Hook to manage element selections, transformations, deletions, and lock toggles.
 * @param {object} currentUser - The current logged in user object.
 * @returns {object} Action handlers for selection.
 */
export function useSelectionActions(currentUser) {
  const {
    setTabs,
    activeTabId,
    elements,
    locks,
    setLocks
  } = useCanvasStore();

  const {
    selectedElementIds,
    setSelectedElementIds,
    setIsInspectorFocused,
    inspectorLockRef,
    originalInspectorElementsRef
  } = useSelectionStore();

  const { pushHistoryAction } = useHistoryStore();

  const handleStartInspectorTransform = useCallback(() => {
    const socket = getSocket();
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

    socket.emit(EVENTS.ELEMENT_LOCK, { elementIds: unlockedIds, tabId: activeTabId }, (res) => {
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
  }, [selectedElementIds, locks, currentUser, elements, setLocks, setIsInspectorFocused, activeTabId, inspectorLockRef, originalInspectorElementsRef]);

  const handleEndInspectorTransform = useCallback(() => {
    setIsInspectorFocused(false);
    if (!inspectorLockRef.current) return;
    const socket = getSocket();
    if (socket && socket.connected) {
      const activeIds = selectedElementIds.filter((id) => locks[id] === currentUser?.id);
      socket.emit(EVENTS.ELEMENT_UNLOCK, { elementIds: activeIds, tabId: activeTabId });
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
            tabId: activeTabId,
          });
        }
      }
    }
    inspectorLockRef.current = false;
    originalInspectorElementsRef.current = [];
  }, [selectedElementIds, locks, currentUser, elements, pushHistoryAction, setLocks, setIsInspectorFocused, activeTabId, inspectorLockRef, originalInspectorElementsRef]);

  const handleInspectorChange = useCallback(
    (updatesMap) => {
      const socket = getSocket();
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
          if (t.id !== activeTabId) return t;
          return {
            ...t,
            elements: t.elements.map((el) => {
              const match = batch.find((b) => b.elementId === el.id);
              return match ? mergeElement(el, match.updates) : el;
            })
          };
        })
      );

      socket.emit(EVENTS.ELEMENT_UPDATE, { batch, tabId: activeTabId });
    },
    [selectedElementIds, elements, locks, currentUser, setTabs, activeTabId]
  );

  const handleToggleSelectionLock = useCallback((elementId) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;

    const el = elements.find((item) => item.id === elementId);
    if (!el) return;

    const currentlyLocked = !!el.properties?.locked;
    const nextLocked = !currentlyLocked;

    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;
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
    socket.emit(EVENTS.ELEMENT_UPDATE, {
      batch: [{ elementId, updates }],
      tabId: activeTabId,
    });
  }, [elements, setSelectedElementIds, setTabs, activeTabId]);

  const handleDeleteSelected = useCallback(() => {
    const socket = getSocket();
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

    socket.emit(EVENTS.ELEMENT_DELETE, { elementIds: unlockedIds, tabId: activeTabId }, (res) => {
      if (res && res.success) {
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id !== activeTabId) return t;
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
          tabId: activeTabId,
        });
      }
    });
  }, [selectedElementIds, elements, locks, currentUser, pushHistoryAction, setSelectedElementIds, setTabs, activeTabId]);

  const handleClearDrawings = useCallback(() => {
    const drawingElementIds = elements
      .filter((el) => el.type === 'path')
      .map((el) => el.id);

    if (drawingElementIds.length === 0) return;

    const socket = getSocket();
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

      socket.emit(EVENTS.ELEMENT_DELETE, { elementIds: unlockableDrawingIds, tabId: activeTabId }, (res) => {
        if (res && res.success) {
          setTabs((prev) =>
            prev.map((t) => {
              if (t.id !== activeTabId) return t;
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
            tabId: activeTabId,
          });
        }
      });
    }
  }, [elements, locks, currentUser, setSelectedElementIds, pushHistoryAction, setTabs, activeTabId]);

  return {
    handleStartInspectorTransform,
    handleEndInspectorTransform,
    handleInspectorChange,
    handleToggleSelectionLock,
    handleDeleteSelected,
    handleClearDrawings
  };
}
