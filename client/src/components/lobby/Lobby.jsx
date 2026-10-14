import { useState, useEffect, useMemo, useCallback } from 'react';
import { PRESET_COLORS, RANDOM_NAMES, generateRandomRoomId } from '../../constants.js';
import { SOCKET_URL, getSocket } from '../../lib/socket.js';
import { EVENTS } from '../../../../shared/protocol.js';

/**
 * Formats a lastActive ISO timestamp into human-readable relative time.
 * @param {string} isoString 
 * @returns {string}
 */
function formatLastActive(isoString) {
  if (!isoString) return 'Just now';
  const diffMs = Math.max(0, Date.now() - new Date(isoString).getTime());
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

/**
 * Lobby Component.
 * Full room discovery portal featuring live room stats, 1-click joining,
 * customizable user identity, and random room generation.
 */
export default function Lobby({
  connected,
  nameInput,
  setNameInput,
  colorInput,
  setColorInput,
  roomIdInput,
  setRoomIdInput,
  handleJoin
}) {
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roomFilter, setRoomFilter] = useState('all'); // 'all' | 'active' | 'saved'
  const [inviteRoom] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room') || params.get('roomId');
      if (urlRoom && urlRoom.trim()) {
        return urlRoom.trim();
      }
    } catch {
      // Ignore URL parsing errors
    }
    return null;
  });

  // Manual refresh callback
  const handleManualRefresh = useCallback(async () => {
    setLoadingRooms(true);
    const socket = getSocket();

    try {
      const res = await fetch(`${SOCKET_URL}/api/rooms`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.rooms)) {
          setRooms(data.rooms);
          setLoadingRooms(false);
          return;
        }
      }
    } catch {
      // Fallback to socket event if REST fails
    }

    if (socket && socket.connected) {
      socket.emit(EVENTS.ROOMS_LIST, (res) => {
        if (res && res.success && Array.isArray(res.rooms)) {
          setRooms(res.rooms);
        }
        setLoadingRooms(false);
      });
    } else {
      setLoadingRooms(false);
    }
  }, []);

  // Fetch available rooms via REST API and sync via WebSockets
  useEffect(() => {
    const socket = getSocket();
    let isMounted = true;

    const loadRooms = async () => {
      try {
        const res = await fetch(`${SOCKET_URL}/api/rooms`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.rooms) && isMounted) {
            setRooms(data.rooms);
            setLoadingRooms(false);
            return;
          }
        }
      } catch {
        // Fallback to socket event if REST fails
      }

      if (socket && socket.connected) {
        socket.emit(EVENTS.ROOMS_LIST, (res) => {
          if (isMounted) {
            if (res && res.success && Array.isArray(res.rooms)) {
              setRooms(res.rooms);
            }
            setLoadingRooms(false);
          }
        });
      } else if (isMounted) {
        setLoadingRooms(false);
      }
    };

    loadRooms();

    const handleRoomsUpdated = (updatedRooms) => {
      if (Array.isArray(updatedRooms) && isMounted) {
        setRooms(updatedRooms);
        setLoadingRooms(false);
      }
    };

    socket.on(EVENTS.ROOMS_UPDATED, handleRoomsUpdated);
    socket.on(EVENTS.CONNECT, loadRooms);

    return () => {
      isMounted = false;
      socket.off(EVENTS.ROOMS_UPDATED, handleRoomsUpdated);
      socket.off(EVENTS.CONNECT, loadRooms);
    };
  }, []);

  // Filtered rooms based on search query and active filter tabs
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // Search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = room.id.toLowerCase().includes(q);
        const matchesName = room.name && room.name.toLowerCase().includes(q);
        if (!matchesId && !matchesName) return false;
      }

      // Filter matching
      if (roomFilter === 'active') {
        return room.activeUsers > 0;
      }
      if (roomFilter === 'saved') {
        return room.hasSave;
      }

      return true;
    });
  }, [rooms, searchQuery, roomFilter]);

  // Random generators
  const handleRandomizeName = () => {
    const random = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    setNameInput(random);
  };

  const handleGenerateRoomId = () => {
    const newRoom = generateRandomRoomId();
    setRoomIdInput(newRoom);
  };

  const handle1ClickJoin = (targetId) => {
    setRoomIdInput(targetId);
    handleJoin(null, targetId);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-[#070b13] relative overflow-y-auto min-h-full">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-[450px] h-[450px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-5xl backdrop-blur-2xl bg-slate-900/50 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 my-auto">
        {/* Header Title & Status */}
        <div className="flex flex-col sm:flex-row items-center justify-between pb-6 mb-6 border-b border-slate-800/80 gap-4">
          <div className="text-center sm:text-left">
            <div className="flex items-center gap-3 justify-center sm:justify-start">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/25">
                AG
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                Antigravity Canvas
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Real-time vector workspaces. Multi-room collaboration and isolated canvases.
            </p>
          </div>

          {/* Server Connection Badge */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/80 border border-slate-800 text-xs">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="font-semibold text-slate-300">
              {connected ? 'Server Connected' : 'Connecting to Server...'}
            </span>
          </div>
        </div>

        {/* Invite Banner if joining from link */}
        {inviteRoom && (
          <div className="mb-6 p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-700/50 flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-indigo-200">
              <span className="text-base">✉️</span>
              <span>
                You were invited to join room: <span className="font-mono font-bold text-indigo-300">{inviteRoom}</span>
              </span>
            </div>
            <button
              onClick={() => handle1ClickJoin(inviteRoom)}
              disabled={!connected}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition active:scale-95 cursor-pointer"
            >
              Join Now
            </button>
          </div>
        )}

        {/* Main Dual-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          {/* Left Column: User Profile & Custom Room Join */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <form onSubmit={handleJoin} className="space-y-6">
              {/* Profile Card */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Your Identity</span>
                  <span className="text-[10px] text-slate-500 font-normal">Customizable</span>
                </h2>

                {/* Display Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Display Name
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      maxLength={20}
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full pr-10 pl-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/50 transition text-sm"
                      placeholder="Enter your name..."
                    />
                    <button
                      type="button"
                      onClick={handleRandomizeName}
                      title="Generate random name"
                      className="absolute right-2.5 text-slate-400 hover:text-white transition p-1 cursor-pointer"
                    >
                      🎲
                    </button>
                  </div>
                </div>

                {/* Cursor Color */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">
                    Cursor Color
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2.5">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setColorInput(color)}
                        style={{ backgroundColor: color }}
                        className={`w-6 h-6 rounded-full transition-transform duration-150 cursor-pointer ${
                          colorInput === color
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950 scale-110'
                            : 'hover:scale-105'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorInput}
                      onChange={(e) => setColorInput(e.target.value)}
                      className="w-8 h-6 bg-transparent border-0 cursor-pointer rounded"
                    />
                    <span className="text-xs text-slate-400 font-mono">{colorInput}</span>
                  </div>
                </div>
              </div>

              {/* Target Room Card */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Target Workspace</span>
                  <button
                    type="button"
                    onClick={handleGenerateRoomId}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-normal flex items-center gap-1 cursor-pointer"
                  >
                    <span>🎲</span>
                    <span>Random ID</span>
                  </button>
                </h2>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Room Identifier
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={32}
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/50 transition font-mono text-sm"
                    placeholder="e.g. canvas-default or realm-42"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Rooms isolate canvas elements, uploaded images, and saves.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!connected}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-white shadow-lg transition-all duration-300 cursor-pointer ${
                    connected
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-blue-500/10 hover:shadow-blue-500/25 active:scale-[0.98]'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {connected ? 'Enter Workspace' : 'Connecting to Server...'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Available Rooms Browser */}
          <div className="lg:col-span-7 flex flex-col p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 min-h-[460px]">
            {/* Browser Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Available Canvases
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {filteredRooms.length}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Browse public rooms or join an active session
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Search Bar */}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter rooms..."
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 w-full sm:w-36"
                />
                {/* Refresh Button */}
                <button
                  onClick={handleManualRefresh}
                  title="Refresh room list"
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
                >
                  🔄
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 py-3 border-b border-slate-800/40 text-xs">
              <button
                onClick={() => setRoomFilter('all')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer font-medium ${
                  roomFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                All Canvases
              </button>
              <button
                onClick={() => setRoomFilter('active')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer font-medium flex items-center gap-1.5 ${
                  roomFilter === 'active'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Active Online</span>
              </button>
              <button
                onClick={() => setRoomFilter('saved')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer font-medium flex items-center gap-1.5 ${
                  roomFilter === 'saved'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>💾</span>
                <span>Has Saves</span>
              </button>
            </div>

            {/* Room Cards List */}
            <div className="flex-1 overflow-y-auto max-h-[540px] lg:max-h-[620px] pt-3 pr-1 space-y-2.5 custom-scrollbar">
              {loadingRooms ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
                  <span className="animate-spin text-xl mb-2">🌀</span>
                  <span>Discovering available canvases...</span>
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs text-center p-4">
                  <span className="text-2xl mb-2">🔍</span>
                  <p className="font-semibold text-slate-400">No rooms found</p>
                  <p className="text-[11px] mt-1 text-slate-600">
                    No canvases matched your filter. You can create a new room using the form on the left.
                  </p>
                </div>
              ) : (
                filteredRooms.map((room) => {
                  const isSelected = roomIdInput === room.id;
                  const isOnline = room.activeUsers > 0;

                  return (
                    <div
                      key={room.id}
                      onClick={() => setRoomIdInput(room.id)}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-950/30 border-blue-500/70 shadow-lg shadow-blue-500/10'
                          : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {/* Room Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-200 truncate">
                            {room.name || room.id}
                          </h3>
                          <span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 shrink-0">
                            #{room.id}
                          </span>
                        </div>

                        {/* Room stats & badges */}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                          {/* Online status badge */}
                          <span
                            className={`px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                              isOnline
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                              }`}
                            />
                            <span>{room.activeUsers} online</span>
                          </span>

                          {/* Save status badge */}
                          {room.hasSave && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
                              <span>💾</span>
                              <span>Saved</span>
                            </span>
                          )}

                          {/* Canvas items info */}
                          <span className="text-slate-500">
                            {room.tabCount || 1} tab{room.tabCount === 1 ? '' : 's'} • {room.elementsCount || 0} item{room.elementsCount === 1 ? '' : 's'}
                          </span>

                          {/* Last active relative time */}
                          <span className="text-slate-600 text-[10px]">
                            • {formatLastActive(room.lastActive)}
                          </span>
                        </div>

                        {/* Active users avatar preview */}
                        {room.users && room.users.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            <span className="text-[10px] text-slate-500">Users:</span>
                            <div className="flex items-center -space-x-1.5 overflow-hidden">
                              {room.users.slice(0, 5).map((u) => (
                                <div
                                  key={u.id}
                                  title={u.name}
                                  style={{ backgroundColor: u.color }}
                                  className="w-4 h-4 rounded-full border border-slate-900 flex items-center justify-center text-[8px] font-bold text-white shadow-sm"
                                >
                                  {u.name ? u.name.charAt(0).toUpperCase() : '?'}
                                </div>
                              ))}
                            </div>
                            {room.users.length > 5 && (
                              <span className="text-[9px] text-slate-500 ml-1">
                                +{room.users.length - 5}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Join Action Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handle1ClickJoin(room.id);
                        }}
                        disabled={!connected}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition active:scale-95 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                        }`}
                      >
                        Join Room
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
