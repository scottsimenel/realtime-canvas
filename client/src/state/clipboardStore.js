import { createContext, useContext, useRef, useCallback, createElement, useMemo } from 'react';
import { getSocket } from '../lib/socket.js';
import { newElementId } from '../lib/ids.js';
import { useHistoryStore } from './historyStore.js';
import { useSelectionStore } from './selectionStore.js';
import { useCanvasStore } from './canvasStore.js';

const ClipboardContext = createContext(null);

/**
 * Clipboard State Store Provider.
 * Manages element copying, cutting, and pasting operations.
 */
export function ClipboardProvider({
  children
}) {
  const { pushHistoryAction } = useHistoryStore();
  const { selectedElementIds, setSelectedElementIds } = useSelectionStore();
  const { elements, setElements, activeTabId, locks } = useCanvasStore();
  const clipboardRef = useRef([]);
  const pasteOffsetRef = useRef(20);

  const handleCopy = useCallback(() => {
    if (selectedElementIds.length === 0) return;
    const elementsToCopy = selectedElementIds
      .map((id) => elements.find((item) => item.id === id))
      .filter(Boolean)
      .map((el) => JSON.parse(JSON.stringify(el)));

    clipboardRef.current = elementsToCopy;
    pasteOffsetRef.current = 20;
  }, [selectedElementIds, elements]);

  const handleCut = useCallback(() => {
    const socket = getSocket();
    if (!socket || !socket.connected || selectedElementIds.length === 0) return;

    const unlockedIds = selectedElementIds.filter((id) => {
      const el = elements.find((item) => item.id === id);
      if (!el || el.properties?.locked) return false;
      const lockHolderId = locks[id];
      return !lockHolderId || lockHolderId === socket.id;
    });

    if (unlockedIds.length === 0) return;

    const elementsToCut = unlockedIds
      .map((id) => elements.find((item) => item.id === id))
      .filter(Boolean)
      .map((el) => JSON.parse(JSON.stringify(el)));

    clipboardRef.current = elementsToCut;
    pasteOffsetRef.current = 20;

    socket.emit('element-delete', { elementIds: unlockedIds, tabId: activeTabId }, (res) => {
      if (res && res.success) {
        setElements((prev) => prev.filter((el) => !unlockedIds.includes(el.id)));
        setSelectedElementIds((prev) => prev.filter((id) => !unlockedIds.includes(id)));
        pushHistoryAction({
          type: 'delete',
          elements: elementsToCut,
          tabId: activeTabId,
        });
      }
    });
  }, [selectedElementIds, elements, locks, pushHistoryAction, setElements, setSelectedElementIds, activeTabId]);

  const handlePaste = useCallback(() => {
    const socket = getSocket();
    if (!socket || !socket.connected || clipboardRef.current.length === 0) return;

    const offset = pasteOffsetRef.current;
    pasteOffsetRef.current += 20;

    const newElements = clipboardRef.current.map((el) => {
      const cloned = JSON.parse(JSON.stringify(el));
      cloned.id = `${newElementId()}_${cloned.id.substring(3, 8)}`;
      cloned.x += offset;
      cloned.y += offset;
      if (cloned.properties) {
        delete cloned.properties.locked;
      }
      return cloned;
    });

    setElements((prev) => [...prev, ...newElements]);
    setSelectedElementIds(newElements.map((el) => el.id));

    newElements.forEach((element) => {
      socket.emit('element-create', { element, tabId: activeTabId }, (res) => {
        if (!res || !res.success) {
          console.error('Failed to create pasted element:', res?.error);
        }
      });
    });

    pushHistoryAction({
      type: 'create',
      elements: newElements,
      tabId: activeTabId,
    });
  }, [setElements, setSelectedElementIds, pushHistoryAction, activeTabId]);

  const value = useMemo(() => ({
    handleCopy,
    handleCut,
    handlePaste
  }), [handleCopy, handleCut, handlePaste]);

  // eslint-disable-next-line react-hooks/refs
  return createElement(ClipboardContext.Provider, { value }, children);
}

/**
 * Hook to consume the Clipboard state store context.
 * @returns {object} The Clipboard state store values.
 */
export function useClipboardStore() {
  const context = useContext(ClipboardContext);
  if (!context) {
    throw new Error('useClipboardStore must be used within a ClipboardProvider');
  }
  return context;
}
