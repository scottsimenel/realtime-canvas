import { useEffect, useState, useCallback } from 'react';
import { getSocket } from '../../lib/socket.js';
import { locksArrayToMap } from '../../lib/locks.js';
import { useCanvasStore } from '../../state/canvasStore.js';
import { useSelectionStore } from '../../state/selectionStore.js';
import { useUploadStore } from '../../state/uploadStore.js';
import { useHistoryStore } from '../../state/historyStore.js';

/**
 * Hook to manage collaborative room save list operations and state loading events.
 */
export function useSaveEvents() {
  const { setTabs, setActiveTabId } = useCanvasStore();
  const { setAssets } = useUploadStore();
  const { setSelectedElementIds } = useSelectionStore();
  const { setHistory, setRedoStack } = useHistoryStore();

  const [saves, setSaves] = useState([]);

  const fetchSaves = useCallback(() => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;

    socket.emit('save-list', (res) => {
      if (res && res.success) {
        setSaves(res.saves || []);
      } else {
        console.error('Failed to fetch saves:', res?.error);
      }
    });
  }, []);

  const handleCreateSave = useCallback((name) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;

    socket.emit('save-create', { name }, (res) => {
      if (res && res.success) {
        fetchSaves();
      } else {
        alert(`Failed to create save: ${res?.error || 'Unknown error'}`);
      }
    });
  }, [fetchSaves]);

  const handleLoadSave = useCallback((saveId, onLoadSuccess) => {
    if (!confirm('Are you sure you want to load this save? This will overwrite the current canvas state for all connected users.')) {
      return;
    }

    const socket = getSocket();
    if (!socket || !socket.connected) return;

    socket.emit('save-load', { saveId }, (res) => {
      if (res && res.success) {
        if (onLoadSuccess) onLoadSuccess();
      } else {
        alert(`Failed to load save: ${res?.error || 'Unknown error'}`);
      }
    });
  }, []);

  const handleDeleteSave = useCallback((saveId) => {
    if (!confirm('Are you sure you want to delete this save?')) {
      return;
    }

    const socket = getSocket();
    if (!socket || !socket.connected) return;

    socket.emit('save-delete', { saveId }, (res) => {
      if (res && res.success) {
        fetchSaves();
      } else {
        alert(`Failed to delete save: ${res?.error || 'Unknown error'}`);
      }
    });
  }, [fetchSaves]);

  useEffect(() => {
    const s = getSocket();

    const onRoomStateLoaded = ({ tabs, assets }) => {
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
    };

    s.on('room-state-loaded', onRoomStateLoaded);

    return () => {
      s.off('room-state-loaded', onRoomStateLoaded);
    };
  }, [setTabs, setAssets, setActiveTabId, setHistory, setRedoStack, setSelectedElementIds]);

  return {
    saves,
    fetchSaves,
    handleCreateSave,
    handleLoadSave,
    handleDeleteSave,
  };
}
