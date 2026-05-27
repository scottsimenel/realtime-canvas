import { useState, useEffect, useRef } from 'react';

export default function TabButton({ tab, isActive, tabUsers, onSwitch, onDelete, onRename, isDeleteDisabled }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(tab.name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    setIsEditing(false);
    if (editName.trim() && editName !== tab.name) {
      onRename(tab.id, editName.trim());
    } else {
      setEditName(tab.name);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(tab.name);
    }
  };

  return (
    <div
      onClick={() => !isEditing && onSwitch(tab.id)}
      onDoubleClick={() => setIsEditing(true)}
      className={`group flex items-center gap-3 px-4 py-2 rounded-xl transition duration-200 border cursor-pointer select-none relative shrink-0 ${
        isActive
          ? 'bg-sky-500/10 border-sky-500/30 text-sky-400 font-bold shadow-md'
          : 'bg-slate-950/20 border-slate-900 text-slate-400 hover:bg-slate-900/40 hover:text-slate-300'
      }`}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          className="bg-slate-950/80 border border-sky-500 rounded px-1.5 py-0.5 text-xs text-sky-300 focus:outline-none w-24 font-semibold"
        />
      ) : (
        <span className="text-xs truncate max-w-[100px] font-semibold">{tab.name}</span>
      )}

      {/* Users Avatars indicator */}
      {tabUsers.length > 0 && (
        <div className="flex items-center -space-x-1.5 ml-1">
          {tabUsers.map((u) => (
            <div
              key={u.id}
              style={{ backgroundColor: u.color }}
              className="w-4 h-4 rounded-full border border-slate-900 flex items-center justify-center text-[8px] font-black text-white shadow-sm"
              title={u.name}
            >
              {u.name.substring(0, 1).toUpperCase()}
            </div>
          ))}
        </div>
      )}

      {/* Delete button (shows on hover or active, hidden if disabled) */}
      {!isDeleteDisabled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(tab.id);
          }}
          className="w-3.5 h-3.5 rounded-md flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 transition opacity-0 group-hover:opacity-100 cursor-pointer"
          title="Delete Canvas"
        >
          ✕
        </button>
      )}
    </div>
  );
}
