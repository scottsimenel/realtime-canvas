import { useState, useRef, useEffect } from 'react';
import ActiveUsersWidget from '../sidebar/ActiveUsersWidget.jsx';
import Icon from '../common/Icon.jsx';

export default function Header({
  showHeader,
  roomIdInput,
  connected,
  users,
  currentUser,
  tabs,
  handleRecolorUser,
  handleRenameUser,
  handleUndo,
  undoDisabled,
  handleRedo,
  redoDisabled,
  onOpenSaves,
  onLeaveRoom,
}) {
  const [showUsersPopover, setShowUsersPopover] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [copied, setCopied] = useState(false);
  const usersPopoverRef = useRef(null);

  useEffect(() => {
    if (!showUsersPopover) return;
    const handleOutsideClick = (e) => {
      if (usersPopoverRef.current && !usersPopoverRef.current.contains(e.target)) {
        setShowUsersPopover(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [showUsersPopover]);

  const handleCopyInvite = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomIdInput);
      navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  };

  return (
    <header className={`transition-all duration-300 ease-in-out flex items-center justify-between z-50 ${
      showHeader
        ? 'h-16 px-4 sm:px-6 border-b border-slate-800/80 bg-slate-900/30 backdrop-blur-md opacity-100 overflow-visible'
        : 'h-0 py-0 px-6 border-b-0 opacity-0 pointer-events-none overflow-hidden'
    }`}>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20 shrink-0">
          AG
        </div>
        <div>
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-200 line-clamp-1">
            Antigravity Canvas
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-slate-500 font-mono">
              Room: <span className="text-indigo-400 font-semibold">{roomIdInput}</span>
            </p>
            <button
              onClick={handleCopyInvite}
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition flex items-center gap-1 cursor-pointer select-none active:scale-95 ${
                copied
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-indigo-300 hover:border-indigo-500/50'
              }`}
              title="Copy room invite link"
            >
              <Icon name={copied ? "check" : "link"} className="w-3 h-3" />
              <span>{copied ? 'Copied' : 'Invite'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Undo / Redo Actions Group */}
        <div className="flex items-center gap-1.5">
          {/* Undo button */}
          <button
            onClick={handleUndo}
            disabled={undoDisabled}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold border transition select-none active:scale-95 ${
              undoDisabled
                ? 'bg-slate-900/20 border-slate-800/40 text-slate-650 cursor-not-allowed'
                : 'bg-slate-950/60 border-slate-800 text-slate-350 hover:bg-slate-900 hover:border-slate-700 cursor-pointer shadow-md'
            }`}
            title="Undo last action (Ctrl+Z)"
          >
            <Icon name="undo" className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Undo</span>
          </button>

          {/* Redo button */}
          <button
            onClick={handleRedo}
            disabled={redoDisabled}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold border transition select-none active:scale-95 ${
              redoDisabled
                ? 'bg-slate-900/20 border-slate-800/40 text-slate-650 cursor-not-allowed'
                : 'bg-slate-950/60 border-slate-800 text-slate-350 hover:bg-slate-900 hover:border-slate-700 cursor-pointer shadow-md'
            }`}
            title="Redo last action (Ctrl+Shift+Z)"
          >
            <Icon name="redo" className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Redo</span>
          </button>

          {/* Saves button */}
          <button
            onClick={onOpenSaves}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold border transition select-none active:scale-95 bg-slate-950/60 border-slate-800 text-slate-350 hover:bg-slate-900 hover:border-slate-700 cursor-pointer shadow-md"
            title="Manage saved states"
          >
            <Icon name="save" className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Saves</span>
          </button>

          {/* Switch Room / Lobby button */}
          {onLeaveRoom && (
            <button
              onClick={onLeaveRoom}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold border transition select-none active:scale-95 bg-slate-950/60 border-slate-800 text-slate-350 hover:bg-slate-900 hover:border-slate-700 hover:text-indigo-300 cursor-pointer shadow-md"
              title="Return to room browser lobby"
            >
              <Icon name="log-out" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lobby</span>
            </button>
          )}
        </div>

        {/* Connection status badge */}
        <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-800/60 text-xs">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="font-semibold text-slate-300 hidden sm:inline">
            {connected ? 'Live Syncing' : 'Reconnecting'}
          </span>
        </div>

        {/* User count badge */}
        <div 
          ref={usersPopoverRef}
          className="relative"
          onMouseEnter={() => setShowUsersPopover(true)}
          onMouseLeave={() => setShowUsersPopover(false)}
        >
          <button
            type="button"
            onClick={() => setShowUsersPopover((prev) => !prev)}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-800/60 text-xs text-slate-300 cursor-pointer hover:bg-slate-900 transition"
            title="Toggle online users list"
          >
            <Icon name="users" className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-bold">{users.length}</span>
            <span className="hidden sm:inline"> online</span>
          </button>
          {showUsersPopover && (
            <div 
              className="absolute top-full pt-2 right-0 z-50 animate-in fade-in duration-200"
            >
              <div className="w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-slate-950/95 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 text-left">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800/80 pb-2">
                  Online Room Users
                </h3>
                <ActiveUsersWidget
                  users={users}
                  currentUser={currentUser}
                  tabs={tabs}
                  handleRecolorUser={handleRecolorUser}
                  isCollapsedDisabled={true}
                  maxHeightClass="max-h-[50vh]"
                />
              </div>
            </div>
          )}
        </div>

        {/* User profile capsule */}
        <div className="flex items-center gap-2 sm:gap-2.5 pl-2 sm:pl-3 border-l border-slate-800">
          <div 
            className="relative w-4 h-4 rounded-full border border-white/20 shadow-sm shrink-0 cursor-pointer overflow-hidden group hover:scale-110 active:scale-95 transition" 
            style={{ backgroundColor: currentUser?.color }}
            title="Change your cursor color"
          >
            <input
              type="color"
              value={currentUser?.color || '#3b82f6'}
              onChange={(e) => handleRecolorUser(e.target.value)}
              className="absolute inset-0 w-full h-full p-0 border-0 opacity-0 cursor-pointer"
            />
          </div>
          {isEditingName ? (
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={() => {
                setIsEditingName(false);
                if (tempName.trim() && tempName.trim() !== currentUser?.name) {
                  handleRenameUser(tempName.trim());
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingName(false);
                  if (tempName.trim() && tempName.trim() !== currentUser?.name) {
                     handleRenameUser(tempName.trim());
                  }
                } else if (e.key === 'Escape') {
                  setIsEditingName(false);
                  setTempName(currentUser?.name || '');
                }
              }}
              autoFocus
              className="bg-slate-900 border border-sky-500 rounded px-1.5 py-0.5 text-xs text-sky-300 font-semibold focus:outline-none w-20 sm:w-28"
            />
          ) : (
            <div 
              className="flex items-center gap-1 group cursor-pointer max-w-[90px] sm:max-w-[140px]"
              onClick={() => {
                setTempName(currentUser?.name || '');
                setIsEditingName(true);
              }}
              title="Click to rename"
            >
              <span className="font-semibold text-xs sm:text-sm text-slate-200 hover:text-white transition truncate">
                {currentUser?.name}
              </span>
              <span className="text-slate-500 hover:text-slate-350 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition shrink-0">
                <Icon name="pencil" className="w-2.5 h-2.5" />
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
