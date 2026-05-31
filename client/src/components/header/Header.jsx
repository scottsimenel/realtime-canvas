import { useState } from 'react';
import ActiveUsersWidget from '../sidebar/ActiveUsersWidget.jsx';

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
}) {
  const [showUsersPopover, setShowUsersPopover] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

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
          <p className="text-[10px] text-slate-500 font-mono">
            Room: <span className="text-indigo-400">{roomIdInput}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Undo button */}
        <button
          onClick={handleUndo}
          disabled={undoDisabled}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition select-none active:scale-95 ${
            undoDisabled
              ? 'bg-slate-900/20 border-slate-800/40 text-slate-650 cursor-not-allowed'
              : 'bg-slate-950/60 border-slate-800 text-slate-350 hover:bg-slate-900 hover:border-slate-700 cursor-pointer shadow-md'
          }`}
          title="Undo last action (Ctrl+Z)"
        >
          <span className="text-xs">↩️</span>
          <span>Undo</span>
        </button>

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
          onMouseEnter={() => setShowUsersPopover(true)}
          onMouseLeave={() => setShowUsersPopover(false)}
          className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-800/60 text-xs text-slate-300 relative cursor-pointer hover:bg-slate-900 transition"
        >
          👥 <span className="font-bold">{users.length}</span><span className="hidden sm:inline"> online</span>
          {showUsersPopover && (
            <div 
              onMouseEnter={() => setShowUsersPopover(true)}
              onMouseLeave={() => setShowUsersPopover(false)}
              className="absolute top-9 right-0 w-80 bg-slate-950/90 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-2xl z-50 flex flex-col gap-3 pointer-events-auto text-left animate-in fade-in duration-200"
            >
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800/80 pb-2">
                Online Room Users
              </h3>
              <ActiveUsersWidget
                users={users}
                currentUser={currentUser}
                tabs={tabs}
                handleRecolorUser={handleRecolorUser}
                isCollapsedDisabled={true}
              />
            </div>
          )}
        </div>

        {/* User profile capsule */}
        <div className="flex items-center gap-2.5 pl-2.5 sm:pl-3 border-l border-slate-800">
          <div 
            className="relative w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm shrink-0 cursor-pointer overflow-hidden group hover:scale-110 active:scale-95 transition" 
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
              className="bg-slate-900 border border-sky-500 rounded px-1.5 py-0.5 text-xs text-sky-300 font-semibold focus:outline-none w-28"
            />
          ) : (
            <div 
              className="flex items-center gap-1 group cursor-pointer"
              onClick={() => {
                setTempName(currentUser?.name || '');
                setIsEditingName(true);
              }}
              title="Click to rename"
            >
              <span className="font-semibold text-sm text-slate-200 hover:text-white transition hidden sm:inline">
                {currentUser?.name}
              </span>
              <span className="text-slate-500 hover:text-slate-350 text-[11px] opacity-0 group-hover:opacity-100 transition hidden sm:inline">
                ✏️
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
