import { useEffect } from 'react';
import { getSocket } from '../../lib/socket.js';
import { locksArrayToMap } from '../../lib/locks.js';
import { useCanvasStore } from '../../state/canvasStore.js';
import { useSelectionStore } from '../../state/selectionStore.js';

/**
 * Hook to listen to tab-related socket events and update canvas state store.
 */
export function useTabEvents({ setUsers }) {
  const { setTabs, setActiveTabId } = useCanvasStore();
  const { setSelectedElementIds } = useSelectionStore();

  useEffect(() => {
    const s = getSocket();

    const onTabCreated = ({ tab }) => {
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
    };

    const onTabDeleted = ({ tabId, fallbackTabId, users: updatedUsers }) => {
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
    };

    const onTabRenamed = ({ tabId, name }) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, name } : t))
      );
    };

    s.on('tab-created', onTabCreated);
    s.on('tab-deleted', onTabDeleted);
    s.on('tab-renamed', onTabRenamed);

    return () => {
      s.off('tab-created', onTabCreated);
      s.off('tab-deleted', onTabDeleted);
      s.off('tab-renamed', onTabRenamed);
    };
  }, [setTabs, setActiveTabId, setSelectedElementIds, setUsers]);
}
