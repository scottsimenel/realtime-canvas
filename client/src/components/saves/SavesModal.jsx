import { useState } from 'react';

export default function SavesModal({
  saves,
  onClose,
  onCreateSave,
  onLoadSave,
  onDeleteSave,
}) {
  const [saveName, setSaveName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!saveName.trim()) return;
    onCreateSave(saveName.trim());
    setSaveName('');
  };

  const formatDate = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 pointer-events-auto">
      {/* Modal Card */}
      <div className="w-full max-w-lg backdrop-blur-xl bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4.5 text-slate-100 animate-in zoom-in-95 duration-200 select-none">
        
        {/* Header Title */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">💾</span>
            <h2 className="text-sm sm:text-base font-bold text-slate-200">
              Saved Canvas States
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition cursor-pointer text-lg font-bold"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Create Save Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Save Current State
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Castle Map Layout, Pre-battle..."
              maxLength={40}
              className="flex-1 bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 transition"
            />
            <button
              type="submit"
              disabled={!saveName.trim()}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer shadow-md select-none active:scale-95 ${
                saveName.trim()
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-indigo-500/10'
                  : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              Save State
            </button>
          </div>
        </form>

        {/* Saves List */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Available Sessions ({saves.length})
          </h3>
          
          <div className="max-h-60 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
            {saves.length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-8 border border-dashed border-slate-800/80 rounded-xl bg-slate-950/20">
                No saved states found. State is auto-saved periodically in the background.
              </div>
            ) : (
              saves.map((save) => (
                <div
                  key={save.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-850 hover:bg-slate-950/70 hover:border-slate-850 transition group"
                >
                  <div className="flex flex-col gap-0.5 text-left overflow-hidden mr-3">
                    <span className="text-xs font-semibold text-slate-200 line-clamp-1">
                      {save.name}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {formatDate(save.timestamp)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onLoadSave(save.id)}
                      className="px-3 py-1.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg text-[11px] font-bold transition active:scale-95 cursor-pointer"
                      title="Load this save state"
                    >
                      Load
                    </button>
                    
                    {save.id !== 'autosave' && (
                      <button
                        onClick={() => onDeleteSave(save.id)}
                        className="p-1.5 bg-slate-900 border border-slate-800/80 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 rounded-lg text-xs transition active:scale-95 cursor-pointer"
                        title="Delete this save state"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
