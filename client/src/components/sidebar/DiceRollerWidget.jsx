import DieIcon from '../common/DieIcon.jsx';

export default function DiceRollerWidget({
  showDiceRoller,
  setShowDiceRoller,
  enable3dDice,
  setEnable3dDice,
  diceSizeMultiplier,
  setDiceSizeMultiplier,
  d20Count,
  setD20Count,
  d20Mode,
  setD20Mode,
  mixedDice,
  setMixedDice,
  rollHistory,
  setRollHistory,
  setHoveredRoll,
  handleRollDice,
}) {
  if (!showDiceRoller) return null;

  const getRollFormula = () => {
    const parts = [];
    if (d20Count > 0) {
      let modeSuffix = '';
      if (d20Mode === 'advantage') modeSuffix = ' (Adv)';
      else if (d20Mode === 'disadvantage') modeSuffix = ' (Dis)';
      parts.push(`${d20Count}d20${modeSuffix}`);
    }
    Object.entries(mixedDice).forEach(([key, val]) => {
      if (val > 0) {
        parts.push(`${val}${key}`);
      }
    });
    return parts.join(' + ');
  };
  const formula = getRollFormula();
  const isDisabled = !formula;

  return (
    <div 
      className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[360px] max-h-[70vh] bg-slate-950/90 backdrop-blur-lg border border-slate-800/80 rounded-3xl p-5 shadow-2xl z-40 flex flex-col gap-4 overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-5 fade-in duration-200 select-none"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h2 className="text-sm font-bold text-slate-205 flex items-center gap-2">
          <span>🎲 Dice Roller</span>
        </h2>
        <button
          type="button"
          onClick={() => setShowDiceRoller(false)}
          className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg bg-slate-900 border border-slate-800 transition cursor-pointer active:scale-95 flex items-center justify-center"
          title="Close Roller"
        >
          ✕
        </button>
      </div>

      {/* 3D Dice Toggle */}
      <div className="flex flex-col gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Enable 3D Dice Roll
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enable3dDice}
              onChange={(e) => setEnable3dDice(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-350 after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500 peer-checked:after:bg-white"></div>
          </label>
        </div>
        
        {enable3dDice && (
          <div className="space-y-1.5 border-t border-slate-800/40 pt-2 select-none animate-in slide-in-from-top-2 duration-200">
            <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>3D Dice Size</span>
              <span className="text-indigo-400 font-mono">{diceSizeMultiplier.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={diceSizeMultiplier}
              onChange={(e) => setDiceSizeMultiplier(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* d20 Configuration */}
      <div className="space-y-2">
        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          d20 Advantage / Disadvantage
        </label>
        <div className="grid grid-cols-4 gap-1.5 bg-slate-900/60 p-1 border border-slate-800 rounded-xl">
          {[
            { label: 'None', count: 0, mode: 'normal' },
            { label: 'Normal', count: 1, mode: 'normal' },
            { label: 'Adv', count: 1, mode: 'advantage' },
            { label: 'Dis', count: 1, mode: 'disadvantage' }
          ].map((opt) => {
            const isActive = d20Count === opt.count && (opt.count === 0 || d20Mode === opt.mode);
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  setD20Count(opt.count);
                  setD20Mode(opt.mode);
                }}
                className={`py-2 px-1 text-xs font-bold rounded-lg transition-all cursor-pointer active:scale-95 text-center ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mixed Dice Bag */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Dice Bag (Custom Pool)
          </label>
          {(d20Count > 0 || Object.values(mixedDice).some(v => v > 0)) && (
            <button
              type="button"
              onClick={() => {
                setMixedDice({ d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d100: 0 });
                setD20Count(0);
              }}
              className="text-xs text-rose-455 hover:text-rose-350 transition font-bold cursor-pointer"
            >
              Reset Bag
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {['d4', 'd6', 'd8', 'd10', 'd12', 'd100'].map((type) => {
            const count = mixedDice[type] || 0;
            return (
              <div
                key={type}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border transition ${
                  count > 0
                    ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-205'
                    : 'bg-slate-905 border-slate-800 text-slate-500'
                }`}
              >
                <span className={`text-sm font-black ${count > 0 ? 'text-indigo-400' : 'text-slate-405'}`}>
                  {type}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMixedDice((prev) => ({
                        ...prev,
                        [type]: Math.max(0, count - 1)
                      }));
                    }}
                    disabled={count === 0}
                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 transition text-[11px] font-black text-slate-350 cursor-pointer disabled:cursor-not-allowed"
                  >
                    －
                  </button>
                  <span className="text-sm font-bold w-4 text-center text-slate-205">
                    {count}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMixedDice((prev) => ({
                        ...prev,
                        [type]: Math.min(30, count + 1)
                      }));
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition text-[11px] font-black text-slate-355 cursor-pointer"
                  >
                    ＋
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Roll Button */}
      <button
        type="button"
        onClick={handleRollDice}
        disabled={isDisabled}
        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm rounded-xl shadow-xl shadow-indigo-950/40 hover:shadow-indigo-600/10 border border-indigo-500/30 transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-97 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:from-indigo-600 disabled:hover:to-violet-600"
      >
        <span>🎲</span> {isDisabled ? 'Select Dice to Roll' : `Roll ${formula}`}
      </button>

      {/* Roll History logs */}
      <div className="border-t border-slate-800/80 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            History Log
          </span>
          {rollHistory.length > 0 && (
            <button
              type="button"
              onClick={() => setRollHistory([])}
              className="text-xs text-slate-500 hover:text-slate-400 cursor-pointer font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {rollHistory.length === 0 ? (
          <p className="text-xs text-slate-600 text-center py-4 bg-slate-950/10 border border-dashed border-slate-800/60 rounded-xl">
            No rolls yet.
          </p>
        ) : (
          <div className="max-h-56 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
            {rollHistory.map((roll) => {
              const getFormulaText = (r) => {
                const parts = [];
                if (r.d20 && r.d20.count > 0) {
                  let modeSuffix = '';
                  if (r.d20.mode === 'advantage') modeSuffix = ' (Adv)';
                  else if (r.d20.mode === 'disadvantage') modeSuffix = ' (Dis)';
                  parts.push(`${r.d20.count}d20${modeSuffix}`);
                }
                if (r.dice && Array.isArray(r.dice)) {
                  r.dice.forEach((g) => {
                    parts.push(`${g.count}d${g.type}`);
                  });
                }
                return parts.join(' + ');
              };
              const form = getFormulaText(roll);
              const hasD20 = roll.d20 && roll.d20.count > 0;
              const hasCustomDice = roll.dice && roll.dice.length > 0;

              return (
                <div
                  key={roll.rollId}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredRoll({ ...roll, clientTop: rect.top });
                  }}
                  onMouseLeave={() => setHoveredRoll(null)}
                  className="text-xs p-3 rounded-xl bg-slate-900 border border-slate-800/60 hover:bg-slate-850 hover:border-slate-700 flex flex-col gap-2 transition duration-150 cursor-help"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold">
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/10"
                        style={{ backgroundColor: roll.userColor }}
                      />
                      <span className="text-slate-200 truncate max-w-[130px] font-black text-xs">{roll.userName}</span>
                    </div>
                    <span className="text-slate-500 text-[10px]">
                      {new Date(roll.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-indigo-400 font-extrabold truncate max-w-[180px] text-xs">
                      {form}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {hasD20 && (
                        <div className="flex items-center gap-1">
                          {roll.d20.rolls.map((r, idx) => (
                            <span key={idx} className="flex items-center gap-0.5">
                              <DieIcon
                                type={20}
                                value={r.kept}
                                size="w-5 h-5"
                                isKept={true}
                                userColor={roll.userColor}
                              />
                              {roll.d20.mode !== 'normal' && (
                                <DieIcon
                                  type={20}
                                  value={r.discarded}
                                  size="w-5 h-5"
                                  isKept={false}
                                  isDiscarded={true}
                                  userColor={roll.userColor}
                                />
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      {hasCustomDice && (
                        <span className="text-indigo-400 font-black ml-1 bg-indigo-500/10 px-2 py-0.5 rounded text-[11px]">
                          ={roll.totalSum}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
