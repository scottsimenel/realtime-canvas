import { useEffect, useRef } from 'react';
import { getSocket } from '../../lib/socket.js';
import { locksArrayToMap } from '../../lib/locks.js';
import { useCanvasStore } from '../../state/canvasStore.js';
import { useUploadStore } from '../../state/uploadStore.js';

/**
 * Hook to manage socket connection events and room rejoin lifecycle.
 */
export function useSocketConnection({
  joined,
  currentUser,
  roomIdInput,
  setConnected,
  setUsers,
  setCurrentUser
}) {
  const { setTabs, activeTabId, setActiveTabId } = useCanvasStore();
  const { setAssets } = useUploadStore();

  const joinedRef = useRef(joined);
  const userRef = useRef(currentUser);
  const roomIdRef = useRef(roomIdInput);
  const activeTabIdRef = useRef(activeTabId);

  useEffect(() => {
    joinedRef.current = joined;
    userRef.current = currentUser;
    roomIdRef.current = roomIdInput;
    activeTabIdRef.current = activeTabId;
  }, [joined, currentUser, roomIdInput, activeTabId]);

  useEffect(() => {
    const s = getSocket();

    const onConnect = () => {
      setConnected(true);
      if (joinedRef.current) {
        s.emit(
          'join-room',
          {
            name: userRef.current?.name || '',
            color: userRef.current?.color || '',
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
                name: userRef.current?.name || '',
                color: userRef.current?.color || '',
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

    if (s.connected) {
      onConnect();
    }

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, [setConnected, setTabs, setUsers, setAssets, setActiveTabId, setCurrentUser]);
}
