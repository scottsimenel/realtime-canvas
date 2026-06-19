import { useState, useEffect, useRef, useCallback } from 'react';
import Lobby from './components/lobby/Lobby.jsx';
import AppContent from './app/AppContent.jsx';
import { RANDOM_NAMES, PRESET_COLORS } from './constants.js';
import { getSocket } from './lib/socket.js';
import { locksArrayToMap } from './lib/locks.js';
import { useZenModeShortcut } from './app/hooks/useZenModeShortcut.js';
import { useCanvasStore } from './state/canvasStore.js';

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
  const [roomIdInput, setRoomIdInput] = useState('canvas-default');

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

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  const handleJoin = useCallback(
    (e) => {
      e.preventDefault();
      if (!nameInput.trim()) return;

      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit(
          'join-room',
          {
            name: nameInput,
            color: colorInput,
            roomId: roomIdInput,
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
                socket.emit('tab-switch', { tabId: targetTabId });
              }

              setCurrentUser({
                id: socket.id,
                name: nameInput,
                color: colorInput,
              });
              setJoined(true);
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
    />
  );
}
