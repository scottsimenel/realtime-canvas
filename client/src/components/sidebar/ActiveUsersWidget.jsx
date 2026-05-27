import { useState } from 'react';

export default function ActiveUsersWidget({
  users,
  currentUser,
  tabs,
  handleRecolorUser,
  isCollapsedDisabled = false,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const listContent = (
    <div className="space-y-2 pt-1 max-h-72 overflow-y-auto custom-scrollbar animate-in fade-in duration-200">
      {users.map((user) => {
        const isMe = user.id === currentUser?.id;
        const isUserActive = user.x !== 0 || user.y !== 0;

        return (
          <div
            key={user.id}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-900/60 hover:border-slate-800 transition"
          >
            <div className="flex items-center gap-2.5">
              {isMe ? (
                <div 
                  className="relative w-3.5 h-3.5 rounded-full border border-white/20 cursor-pointer overflow-hidden group hover:scale-110 active:scale-95 transition shrink-0 shadow-sm" 
                  style={{ backgroundColor: user.color }} 
                  title="Change your cursor color"
                >
                  <input
                    type="color"
                    value={user.color || '#3b82f6'}
                    onChange={(e) => handleRecolorUser(e.target.value)}
                    className="absolute inset-0 w-full h-full p-0 border-0 opacity-0 cursor-pointer"
                  />
                </div>
              ) : (
                <span
                  className="w-3 h-3 rounded-full border border-white/10 shrink-0"
                  style={{ backgroundColor: user.color }}
                />
              )}
              <span className="text-sm font-semibold text-slate-300 truncate max-w-[120px]">
                {user.name}
                {isMe && <span className="text-xs font-normal text-slate-500 ml-1">(you)</span>}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-medium truncate max-w-[80px]" title={`On ${(() => {
                const userTabId = user.activeTabId || 'tab-default';
                const tab = tabs.find((t) => t.id === userTabId);
                return tab ? tab.name : 'Canvas';
              })()}`}>
                {(() => {
                  const userTabId = user.activeTabId || 'tab-default';
                  const tab = tabs.find((t) => t.id === userTabId);
                  return tab ? tab.name : 'Canvas';
                })()}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isUserActive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {isUserActive ? 'Active' : 'Idle'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (isCollapsedDisabled) {
    return listContent;
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between pb-1 text-left cursor-pointer select-none focus:outline-none"
      >
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <span>👥 Active Users</span>
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/25">
            {users.length}
          </span>
          <span className="text-slate-500 text-xs">
            {isCollapsed ? '➕' : '➖'}
          </span>
        </div>
      </button>
      {!isCollapsed && listContent}
    </div>
  );
}
