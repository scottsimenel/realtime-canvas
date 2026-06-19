import { useCallback } from 'react';
import { getSocket } from '../../lib/socket.js';
import { useCanvasStore } from '../../state/canvasStore.js';
import { newTabId } from '../../lib/ids.js';
import { locksArrayToMap } from '../../lib/locks.js';

/**
 * Hook to manage collaborative tab CRUD operations.
 * @param {function} setUsers State setter for active user list.
 * @returns {object} Tab handlers.
 */
export function useTabs(setUsers) {
  const {
    tabs,
    setTabs,
    setActiveTabId
  } = useCanvasStore();

  const handleSwitchTab = useCallback((tabId) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;

    socket.emit('tab-switch', { tabId }, (res) => {
      if (res && res.success) {
        setActiveTabId(tabId);
        setUsers((prev) =>
          prev.map((u) => (u.id === socket.id ? { ...u, activeTabId: tabId } : u))
        );
      }
    });
  }, [setActiveTabId, setUsers]);

  const handleCreateTab = useCallback(() => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;

    const createdTabId = newTabId();
    const newName = `Canvas ${tabs.length + 1}`;

    socket.emit('tab-create', { tabId: createdTabId, name: newName }, (res) => {
      if (res && res.success && res.tab) {
        const formattedTab = {
          ...res.tab,
          locks: locksArrayToMap(res.tab.locks),
        };
        setTabs((prev) => [...prev, formattedTab]);
        handleSwitchTab(createdTabId);
      }
    });
  }, [tabs.length, setTabs, handleSwitchTab]);

  const handleDeleteTab = useCallback((tabId) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;

    if (tabs.length <= 1) return;

    socket.emit('tab-delete', { tabId }, (res) => {
      if (res && res.success) {
        setTabs((prev) => prev.filter((t) => t.id !== tabId));
        if (res.users) {
          setUsers(res.users);
        }
        if (res.fallbackTabId) {
          setActiveTabId((currentActiveTabId) => {
            if (currentActiveTabId === tabId) {
              return res.fallbackTabId;
            }
            return currentActiveTabId;
          });
        }
      }
    });
  }, [tabs.length, setTabs, setActiveTabId, setUsers]);

  const handleRenameTab = useCallback((tabId, name) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;

    const trimmedName = name.trim();
    if (!trimmedName) return;

    socket.emit('tab-rename', { tabId, name: trimmedName }, (res) => {
      if (res && res.success) {
        setTabs((prev) =>
          prev.map((t) => (t.id === tabId ? { ...t, name: trimmedName } : t))
        );
      }
    });
  }, [setTabs]);

  return {
    handleSwitchTab,
    handleCreateTab,
    handleDeleteTab,
    handleRenameTab
  };
}
