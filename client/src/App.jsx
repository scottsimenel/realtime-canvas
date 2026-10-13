import { useState, useEffect, useRef, useCallback } from 'react';
import Lobby from './components/lobby/Lobby.jsx';
import AppContent from './app/AppContent.jsx';
import { RANDOM_NAMES, PRESET_COLORS } from './constants.js';
import { getSocket } from './lib/socket.js';
import { locksArrayToMap } from './lib/locks.js';
import { useZenModeShortcut } from './app/hooks/useZenModeShortcut.js';
import { useCanvasStore } from './state/canvasStore.js';
import { EVENTS } from '../../shared/protocol.js';

export default function App() {
  // Connection states
  const [connected, setConnected] = useState(() => getSocket().connected);
  const [joined, setJoined] = useState(false);
  const socketRef = useRef(null);

  // Register Zen Mode global shortcut
  useZenModeShortcut();

  // Lobby Inputs
  const [nameInput, setNameInput] = useState(() => {
    return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  });
  const [colorInput, setColorInput] = useState(() => {
    return PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
  });
  const [roomIdInput, setRoomIdInput] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room') || params.get('roomId');
      if (roomParam && roomParam.trim()) {
        return roomParam.trim();
      }
    } catch {
      // Ignore URL parsing errors
    }
    return 'canvas-default';
  });

  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const {
    activeTabId,
    setActiveTabId,
    setTabs
  } = useCanvasStore();

  // Connect socket and keep connection state updated for Lobby
  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on(EVENTS.CONNECT, onConnect);
    s.on(EVENTS.DISCONNECT, onDisconnect);

    return () => {
      s.off(EVENTS.CONNECT, onConnect);
      s.off(EVENTS.DISCONNECT, onDisconnect);
    };
  }, []);

  const handleJoin = useCallback(
    (e, overrideRoomId) => {
      if (e?.preventDefault) e.preventDefault();
      if (!nameInput.trim()) return;

      const targetRoom = (overrideRoomId || roomIdInput || 'canvas-default').trim();
      setRoomIdInput(targetRoom);

      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit(
          EVENTS.JOIN_ROOM,
          {
            name: nameInput,
            color: colorInput,
            roomId: targetRoom,
          },
          (res) => {
            if (res && res.success) {
              const formattedTabs = (res.tabs || []).map((tab) => ({
                ...tab,
                locks: locksArrayToMap(tab.locks),
              }));
              setTabs(formattedTabs);
              setUsers(res.users || []);

              let targetTabId = activeTabId;
              if (!formattedTabs.some((t) => t.id === targetTabId)) {
                targetTabId = res.activeTabId || 'tab-default';
              }
              setActiveTabId(targetTabId);

              if (targetTabId !== 'tab-default') {
                socket.emit(EVENTS.TAB_SWITCH, { tabId: targetTabId });
              }

              setCurrentUser({
                id: socket.id,
                name: nameInput,
                color: colorInput,
              });
              setJoined(true);

              // Reflect active room in URL without page refresh
              try {
                const url = new URL(window.location.href);
                url.searchParams.set('room', targetRoom);
                window.history.replaceState({}, '', url.toString());
              } catch {
                // Ignore URL history errors
              }
            } else {
              alert('Failed to join room.');
            }
          }
        );
      } else {
        alert('Socket server not connected. Please check if backend is running.');
      }
    },
    [nameInput, colorInput, roomIdInput, activeTabId, setTabs, setActiveTabId]
  );

  const handleLeaveRoom = useCallback(() => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit(EVENTS.LEAVE_ROOM, () => {
        setJoined(false);
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('room');
          window.history.replaceState({}, '', url.toString());
        } catch {
          // Ignore
        }
      });
    } else {
      setJoined(false);
    }
  }, []);

  if (!joined) {
    return (
      <Lobby
        connected={connected}
        nameInput={nameInput}
        setNameInput={setNameInput}
        colorInput={colorInput}
        setColorInput={setColorInput}
        roomIdInput={roomIdInput}
        setRoomIdInput={setRoomIdInput}
        handleJoin={handleJoin}
      />
    );
  }

  return (
    <AppContent
      connected={connected}
      setConnected={setConnected}
      joined={joined}
      socketRef={socketRef}
      currentUser={currentUser}
      setCurrentUser={setCurrentUser}
      users={users}
      setUsers={setUsers}
      roomIdInput={roomIdInput}
      handleLeaveRoom={handleLeaveRoom}
    />
  );
}
