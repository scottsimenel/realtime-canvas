import { EVENTS } from '../../../../shared/protocol.js';
import { useEffect } from 'react';
import { getSocket } from '../../lib/socket.js';
import { useCanvasStore } from '../../state/canvasStore.js';
import { useDiceStore } from '../../state/diceStore.js';

/**
 * Hook to listen to user-related socket events and update local user/canvas/dice states.
 */
export function useUserEvents({ setUsers, setCurrentUser }) {
  const { setTabs } = useCanvasStore();
  const { setRollHistory, setActiveRolls } = useDiceStore();

  useEffect(() => {
    const s = getSocket();

    const onUserJoined = (user) => {
      setUsers((prev) => [...prev.filter((u) => u.id !== user.id), user]);
    };

    const onUserRenamed = ({ userId, name }) => {
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
    };

    const onUserRecolored = ({ userId, color }) => {
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
    };

    const onUserLeft = ({ userId }) => {
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
    };

    const onCursorUpdate = ({ userId, x, y }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, x, y } : u))
      );
    };

    const onTabSwitched = ({ userId, tabId }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, activeTabId: tabId } : u))
      );
    };

    s.on(EVENTS.USER_JOINED, onUserJoined);
    s.on(EVENTS.USER_RENAMED, onUserRenamed);
    s.on(EVENTS.USER_RECOLORED, onUserRecolored);
    s.on(EVENTS.USER_LEFT, onUserLeft);
    s.on(EVENTS.CURSOR_UPDATE, onCursorUpdate);
    s.on(EVENTS.TAB_SWITCHED, onTabSwitched);

    return () => {
      s.off(EVENTS.USER_JOINED, onUserJoined);
      s.off(EVENTS.USER_RENAMED, onUserRenamed);
      s.off(EVENTS.USER_RECOLORED, onUserRecolored);
      s.off(EVENTS.USER_LEFT, onUserLeft);
      s.off(EVENTS.CURSOR_UPDATE, onCursorUpdate);
      s.off(EVENTS.TAB_SWITCHED, onTabSwitched);
    };
  }, [setUsers, setCurrentUser, setTabs, setRollHistory, setActiveRolls]);
}
