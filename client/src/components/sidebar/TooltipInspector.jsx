import { useState } from 'react';

export default function TooltipInspector({ element, onChange }) {
  const tooltip = element.properties?.tooltip || {
    enabled: false,
    title: '',
    trackers: [],
    stats: [],
  };

  const [prevElementId, setPrevElementId] = useState(element.id);
  const [prevTitle, setPrevTitle] = useState(tooltip.title);
  const [localTitle, setLocalTitle] = useState(tooltip.title || '');

  if (element.id !== prevElementId || tooltip.title !== prevTitle) {
    setPrevElementId(element.id);
    setPrevTitle(tooltip.title);
    setLocalTitle(tooltip.title || '');
  }

  const [quickAdjustValues, setQuickAdjustValues] = useState({}); // trackerId -> string

  const updateTooltip = (updatedFields) => {
    const newTooltip = {
      ...tooltip,
      ...updatedFields,
    };
    onChange({
      properties: {
        ...element.properties,
        tooltip: newTooltip,
      },
    });
  };

  const handleTitleBlur = () => {
    if (localTitle !== tooltip.title) {
      updateTooltip({ title: localTitle });
    }
  };

  const handleToggleEnabled = (e) => {
    updateTooltip({ enabled: e.target.checked });
  };

  const handleAddTracker = () => {
    const newTracker = {
      id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: 'HP',
      value: 10,
      max: 10,
      color: 'red',
      showOnCanvas: true,
    };
    updateTooltip({
      trackers: [...(tooltip.trackers || []), newTracker],
    });
  };

  const handleUpdateTracker = (trackerId, updates) => {
    const updatedTrackers = (tooltip.trackers || []).map((t) => {
      if (t.id === trackerId) {
        return { ...t, ...updates };
      }
      return t;
    });
    updateTooltip({ trackers: updatedTrackers });
  };

  const handleRemoveTracker = (trackerId) => {
    const updatedTrackers = (tooltip.trackers || []).filter((t) => t.id !== trackerId);
    updateTooltip({ trackers: updatedTrackers });
  };

  const handleQuickAdjust = (trackerId, type) => {
    const adjustStr = quickAdjustValues[trackerId] || '';
    const adjustVal = parseInt(adjustStr, 10);
    if (isNaN(adjustVal)) return;

    const tracker = (tooltip.trackers || []).find((t) => t.id === trackerId);
    if (!tracker) return;

    let newValue = tracker.value;
    if (type === 'damage') {
      newValue = Math.max(0, tracker.value - adjustVal);
    } else if (type === 'heal') {
      newValue = Math.min(tracker.max, tracker.value + adjustVal);
    }

    handleUpdateTracker(trackerId, { value: newValue });
    setQuickAdjustValues((prev) => ({ ...prev, [trackerId]: '' }));
  };

  const handleAddStat = () => {
    const newStat = {
      id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: 'AC',
      value: '10',
    };
    updateTooltip({
      stats: [...(tooltip.stats || []), newStat],
    });
  };

  const handleUpdateStat = (statId, updates) => {
    const updatedStats = (tooltip.stats || []).map((s) => {
      if (s.id === statId) {
        return { ...s, ...updates };
      }
      return s;
    });
    updateTooltip({ stats: updatedStats });
  };

  const handleRemoveStat = (statId) => {
    const updatedStats = (tooltip.stats || []).filter((s) => s.id !== statId);
    updateTooltip({ stats: updatedStats });
  };

  return (
    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 select-none">
          <span>💬</span> Tooltip & Stats
        </h2>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={tooltip.enabled}
            onChange={handleToggleEnabled}
            className="sr-only peer"
          />
          <div className="w-7 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-500 peer-checked:after:bg-white"></div>
        </label>
      </div>

      {tooltip.enabled && (
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 select-none">
              Tooltip Title / Character Name
            </label>
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="e.g. Grog the Barbarian"
              className="w-full px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
            />
          </div>

          <hr className="border-slate-800/40" />

          <div className="space-y-2">
            <div className="flex items-center justify-between select-none">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Numerical Trackers (e.g. HP)
              </label>
              <button
                type="button"
                onClick={handleAddTracker}
                className="text-[10px] text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 transition cursor-pointer"
              >
                ＋ Add Bar
              </button>
            </div>

            <div className="space-y-3">
              {(tooltip.trackers || []).map((tracker) => {
                const colors = ['red', 'green', 'blue', 'amber', 'purple', 'rose'];
                return (
                  <div key={tracker.id} className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={tracker.label}
                        onChange={(e) => handleUpdateTracker(tracker.id, { label: e.target.value })}
                        placeholder="Label (e.g. HP)"
                        className="w-20 px-2 py-1 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={tracker.value}
                          onChange={(e) => handleUpdateTracker(tracker.id, { value: parseInt(e.target.value, 10) || 0 })}
                          className="w-12 px-1 py-1 bg-slate-900 border border-slate-800 rounded-md text-xs text-center text-slate-200 focus:outline-none focus:border-sky-500"
                          placeholder="Val"
                        />
                        <span className="text-slate-600 text-xs select-none">/</span>
                        <input
                          type="number"
                          value={tracker.max}
                          onChange={(e) => handleUpdateTracker(tracker.id, { max: parseInt(e.target.value, 10) || 0 })}
                          className="w-12 px-1 py-1 bg-slate-900 border border-slate-800 rounded-md text-xs text-center text-slate-200 focus:outline-none focus:border-sky-500"
                          placeholder="Max"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTracker(tracker.id)}
                        className="text-slate-600 hover:text-rose-400 transition cursor-pointer text-xs"
                        title="Remove Tracker"
                      >
                        🗑️
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        {colors.map((c) => {
                          const colorMap = {
                            red: 'bg-red-500',
                            green: 'bg-emerald-500',
                            blue: 'bg-blue-500',
                            amber: 'bg-amber-500',
                            purple: 'bg-purple-500',
                            rose: 'bg-rose-500',
                          };
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleUpdateTracker(tracker.id, { color: c })}
                              className={`w-3.5 h-3.5 rounded-full ${colorMap[c]} border transition cursor-pointer hover:scale-110 ${
                                tracker.color === c ? 'border-white scale-110' : 'border-transparent'
                              }`}
                              title={c}
                            />
                          );
                        })}
                      </div>
                      
                      <label className="flex items-center gap-1 text-slate-400 cursor-pointer hover:text-slate-300 select-none">
                        <input
                          type="checkbox"
                          checked={!!tracker.showOnCanvas}
                          onChange={(e) => handleUpdateTracker(tracker.id, { showOnCanvas: e.target.checked })}
                          className="rounded border-slate-800 bg-slate-900 text-sky-500 focus:ring-0 focus:ring-offset-0"
                        />
                        <span>On Canvas</span>
                      </label>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-900/60 select-none">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Quick Adjust</span>
                        <input
                          type="number"
                          min="1"
                          value={quickAdjustValues[tracker.id] || ''}
                          onChange={(e) => setQuickAdjustValues((prev) => ({ ...prev, [tracker.id]: e.target.value }))}
                          placeholder="Qty"
                          className="w-16 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] text-center text-slate-200 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickAdjust(tracker.id, 'damage')}
                          className="flex-1 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold transition cursor-pointer active:scale-95 text-center"
                        >
                          Damage (-)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAdjust(tracker.id, 'heal')}
                          className="flex-1 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold transition cursor-pointer active:scale-95 text-center"
                        >
                          Heal (+)
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-800/40" />

          <div className="space-y-2">
            <div className="flex items-center justify-between select-none">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Attributes (e.g. AC, Status)
              </label>
              <button
                type="button"
                onClick={handleAddStat}
                className="text-[10px] text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 transition cursor-pointer"
              >
                ＋ Add Stat
              </button>
            </div>

            <div className="space-y-2">
              {(tooltip.stats || []).map((stat) => (
                <div key={stat.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={stat.label}
                    onChange={(e) => handleUpdateStat(stat.id, { label: e.target.value })}
                    placeholder="Stat (e.g. AC)"
                    className="flex-1 min-w-0 px-2 py-1 bg-slate-950/80 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition"
                  />
                  <input
                    type="text"
                    value={stat.value}
                    onChange={(e) => handleUpdateStat(stat.id, { value: e.target.value })}
                    placeholder="Value (e.g. 16)"
                    className="flex-1 min-w-0 px-2 py-1 bg-slate-950/80 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveStat(stat.id)}
                    className="text-slate-600 hover:text-rose-400 transition cursor-pointer text-xs"
                    title="Remove Stat"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
