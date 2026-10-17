import { EVENTS } from '../../../../shared/protocol.js';
import { useCallback, useEffect } from 'react';
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
    isInspectorFocused,
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
            (before.properties?.rotation || 0) !== (after.properties?.rotation || 0) ||
            before.type !== after.type ||
            JSON.stringify(before.properties) !== JSON.stringify(after.properties)
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

      const elementsBefore = !inspectorLockRef.current
        ? activeIds
            .map((id) => elements.find((item) => item.id === id))
            .filter(Boolean)
            .map((el) => JSON.parse(JSON.stringify(el)))
        : null;

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

      if (!inspectorLockRef.current && elementsBefore && elementsBefore.length > 0) {
        const elementsAfter = elementsBefore.map((before) => {
          const match = batch.find((b) => b.elementId === before.id);
          return match ? mergeElement(before, match.updates) : before;
        });

        const hasChanged = elementsBefore.some((before) => {
          const after = elementsAfter.find((a) => a.id === before.id);
          if (!after) return true;
          return (
            before.type !== after.type ||
            before.width !== after.width ||
            before.height !== after.height ||
            JSON.stringify(before.properties) !== JSON.stringify(after.properties)
          );
        });

        if (hasChanged) {
          pushHistoryAction({
            type: 'transform',
            elementsBefore,
            elementsAfter,
            tabId: activeTabId,
          });
        }
      }
    },
    [selectedElementIds, elements, locks, currentUser, setTabs, activeTabId, inspectorLockRef, pushHistoryAction]
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
      .map((id) => {
        const el = elements.find((item) => item.id === id);
        if (!el) return null;
        const index = elements.findIndex((item) => item.id === id);
        return {
          ...JSON.parse(JSON.stringify(el)),
          _layerIndex: index !== -1 ? index : undefined,
        };
      })
      .filter(Boolean);

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
    const unlockableDrawingElements = elements
      .filter((el) => el.type === 'path' && !el.properties?.locked)
      .filter((el) => {
        const lockHolderId = locks[el.id];
        return !lockHolderId || lockHolderId === currentUser?.id;
      });

    if (unlockableDrawingElements.length === 0) return;

    if (!window.confirm('Are you sure you want to clear all unlocked drawings on this canvas?')) {
      return;
    }

    const socket = getSocket();
    if (socket && socket.connected) {
      const unlockableDrawingIds = unlockableDrawingElements.map((el) => el.id);
      const elementsToDelete = unlockableDrawingElements.map((el) => {
        const index = elements.findIndex((item) => item.id === el.id);
        return {
          ...JSON.parse(JSON.stringify(el)),
          _layerIndex: index !== -1 ? index : undefined,
        };
      });

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

  // Cleanup inspector locks on unmount
  useEffect(() => {
    return () => {
      if (inspectorLockRef.current) {
        handleEndInspectorTransform();
      }
    };
  }, [handleEndInspectorTransform, inspectorLockRef]);

  // Global pointerup to release slider drags if mouse leaves slider
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (inspectorLockRef.current && !isInspectorFocused) {
        handleEndInspectorTransform();
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [handleEndInspectorTransform, inspectorLockRef, isInspectorFocused]);

  return {
    handleStartInspectorTransform,
    handleEndInspectorTransform,
    handleInspectorChange,
    handleToggleSelectionLock,
    handleDeleteSelected,
    handleClearDrawings
  };
}
