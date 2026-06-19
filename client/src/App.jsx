import { useState, useEffect, useRef, useCallback } from 'react';
import Lobby from './components/lobby/Lobby.jsx';
import AppContent from './app/AppContent.jsx';
import { RANDOM_NAMES, PRESET_COLORS } from './constants.js';
import { getSocket } from './lib/socket.js';
import { locksArrayToMap } from './lib/locks.js';
import { newTabId } from './lib/ids.js';
import { useZenModeShortcut } from './app/hooks/useZenModeShortcut.js';
import { SelectionProvider } from './state/selectionStore.js';
import { HistoryProvider } from './state/historyStore.js';
import { ClipboardProvider } from './state/clipboardStore.js';

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

  // Shared board state
  const [users, setUsers] = useState([]);
  const [tabs, setTabs] = useState([
    {
      id: 'tab-default',
      name: 'Canvas 1',
      elements: [],
      locks: {},
      roomSettings: {
        backgroundImageUrl: null,
        showBackground: true,
        showGrid: true,
        gridSnapping: false,
        gridType: 'square',
        gridSize: 40,
        customBackgroundWidth: null,
        customBackgroundHeight: null,
        gridScaleNumber: 5,
        gridScaleUnit: 'ft',
      },
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-default');
  const [currentUser, setCurrentUser] = useState(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const elements = activeTab ? activeTab.elements : [];
  const locks = activeTab ? activeTab.locks : {};

  const setElements = useCallback((updater) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              elements:
                typeof updater === 'function' ? updater(t.elements) : updater,
            }
          : t
      )
    );
  }, [activeTabId]);

  const setLocks = useCallback((updater) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              locks: typeof updater === 'function' ? updater(t.locks) : updater,
            }
          : t
      )
    );
  }, [activeTabId]);

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

  const handleSwitchTab = useCallback((tabId) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    socket.emit('tab-switch', { tabId }, (res) => {
      if (res && res.success) {
        setActiveTabId(tabId);
        setUsers((prev) =>
          prev.map((u) => (u.id === socket.id ? { ...u, activeTabId: tabId } : u))
        );
      }
    });
  }, []);

  const handleUpdateRoomSettings = useCallback((updates) => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, roomSettings: { ...t.roomSettings, ...updates } }
            : t
        )
      );
      socket.emit('room-settings-update', { updates, tabId: activeTabId }, (res) => {
        if (res && res.success && res.roomSettings) {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === activeTabId
                ? { ...t, roomSettings: res.roomSettings }
                : t
            )
          );
        }
      });
    }
  }, [activeTabId]);

  const handleCreateTab = useCallback(() => {
    const socket = socketRef.current;
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
  }, [tabs.length, handleSwitchTab]);

  const handleDeleteTab = useCallback((tabId) => {
    const socket = socketRef.current;
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
  }, [tabs.length]);

  const handleRenameTab = useCallback((tabId, name) => {
    const socket = socketRef.current;
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
    [nameInput, colorInput, roomIdInput, activeTabId]
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
    <SelectionProvider elements={elements}>
      <HistoryProvider
        setTabs={setTabs}
        handleSwitchTab={handleSwitchTab}
        activeTabId={activeTabId}
      >
        <ClipboardProvider
          elements={elements}
          setElements={setElements}
          activeTabId={activeTabId}
          locks={locks}
          currentUser={currentUser}
        >
          <AppContent
            connected={connected}
            setConnected={setConnected}
            joined={joined}
            socketRef={socketRef}
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            users={users}
            setUsers={setUsers}
            tabs={tabs}
            setTabs={setTabs}
            activeTabId={activeTabId}
            setActiveTabId={setActiveTabId}
            locks={locks}
            setLocks={setLocks}
            roomIdInput={roomIdInput}
            handleSwitchTab={handleSwitchTab}
            handleUpdateRoomSettings={handleUpdateRoomSettings}
            handleCreateTab={handleCreateTab}
            handleDeleteTab={handleDeleteTab}
            handleRenameTab={handleRenameTab}
          />
        </ClipboardProvider>
      </HistoryProvider>
    </SelectionProvider>
  );
}
