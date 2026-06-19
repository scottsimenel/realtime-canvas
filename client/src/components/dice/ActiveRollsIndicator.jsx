import DieIcon from '../common/DieIcon.jsx';
import { useDiceStore } from '../../state/diceStore.js';

/**
 * ActiveRollsIndicator Component.
 * Displays floating notification cards for rolling dice and final results,
 * as well as a detailed popover card on hover.
 */
export default function ActiveRollsIndicator() {
  const { activeRolls, rollTick, hoveredRoll } = useDiceStore();

  if (activeRolls.length === 0 && !hoveredRoll) return null;

  return (
    <>
      {/* Floating Active Roll Notifications */}
      {activeRolls.length > 0 && (
        <div className="fixed top-20 right-4 z-50 flex flex-col gap-4.5 pointer-events-none max-w-sm sm:max-w-md w-full">
          {activeRolls.map((roll) => {
            const isRolling = roll.status === 'rolling';

            const allDiceToRoll = [];
            if (roll.d20 && roll.d20.count > 0) {
              const d20AnimCount = roll.d20.mode !== 'normal' ? roll.d20.count * 2 : roll.d20.count;
              for (let i = 0; i < d20AnimCount; i++) {
                allDiceToRoll.push(20);
              }
            }
            if (roll.dice && Array.isArray(roll.dice)) {
              roll.dice.forEach((g) => {
                for (let i = 0; i < g.count; i++) {
                  allDiceToRoll.push(g.type);
                }
              });
            }

            const getBroadcastFormula = () => {
              const parts = [];
              if (roll.d20 && roll.d20.count > 0) {
                let modeSuffix = '';
                if (roll.d20.mode === 'advantage') modeSuffix = ' (Adv)';
                else if (roll.d20.mode === 'disadvantage') modeSuffix = ' (Dis)';
                parts.push(`${roll.d20.count}d20${modeSuffix}`);
              }
              if (roll.dice && Array.isArray(roll.dice)) {
                roll.dice.forEach((g) => {
                  parts.push(`${g.count}d${g.type}`);
                });
              }
              return parts.join(' + ');
            };
            const formulaText = getBroadcastFormula();

            return (
              <div
                key={roll.rollId}
                className="pointer-events-auto bg-slate-900/98 border border-slate-800 backdrop-blur-md rounded-2xl p-5 shadow-2xl w-full flex flex-col gap-3 transition-all duration-300 transform scale-100 animate-in slide-in-from-right-4 fade-in"
                style={{
                  borderLeftWidth: '5px',
                  borderLeftColor: roll.userColor
                }}
              >
                {/* Card Header: User and formula */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full border border-white/10"
                      style={{ backgroundColor: roll.userColor }}
                    />
                    <span className="text-sm font-black text-slate-100">{roll.userName}</span>
                  </div>
                  <span className="text-xs bg-indigo-500/10 text-indigo-400 font-extrabold px-3 py-1 rounded-lg border border-indigo-500/25">
                    {formulaText}
                  </span>
                </div>

                {/* Rolling Animation / Final Results */}
                <div className="py-2 flex flex-col items-center justify-center min-h-[60px] relative">
                  {isRolling ? (
                    <div className="flex flex-wrap justify-center gap-2.5 animate-pulse">
                      {allDiceToRoll.map((type, idx) => (
                        <div
                          key={idx}
                          className="animate-spin"
                          style={{
                            animationDuration: `${0.4 + idx * 0.15}s`
                          }}
                        >
                          <DieIcon
                            type={type}
                            value={((rollTick + idx) % type) + 1}
                            size="w-12 h-12"
                            userColor={roll.userColor}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 w-full">
                      {roll.d20 && roll.d20.count > 0 && (
                        <div className="flex flex-col items-center gap-1.5 w-full">
                          <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                            d20 roll
                          </span>
                          <div className="flex flex-wrap justify-center gap-2.5">
                            {roll.d20.rolls.map((r, idx) => (
                              <div key={idx} className="flex items-center bg-slate-950/80 border border-slate-800/50 p-2 rounded-xl gap-2 shadow-inner">
                                {roll.d20.mode !== 'normal' ? (
                                  <>
                                    <DieIcon
                                      type={20}
                                      value={r.kept}
                                      size="w-10 h-10"
                                      isKept={true}
                                      userColor={roll.userColor}
                                    />
                                    <DieIcon
                                      type={20}
                                      value={r.discarded}
                                      size="w-10 h-10"
                                      isKept={false}
                                      isDiscarded={true}
                                      userColor={roll.userColor}
                                    />
                                  </>
                                ) : (
                                  <DieIcon
                                    type={20}
                                    value={r.kept}
                                    size="w-10 h-10"
                                    isKept={true}
                                    userColor={roll.userColor}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {roll.dice && roll.dice.length > 0 && (
                        <div className="flex flex-col items-center gap-3 w-full border-t border-slate-800/40 pt-3">
                          <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                            Dice Pool Results
                          </span>
                          <div className="flex flex-wrap justify-center gap-4">
                            {roll.dice.map((group, gIdx) => (
                              <div key={gIdx} className="flex flex-col items-center gap-1.5">
                                <span className="text-[9px] font-extrabold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/10">
                                  {group.count}d{group.type}
                                </span>
                                <div className="flex flex-wrap justify-center gap-1.5">
                                  {group.rolls.map((val, idx) => (
                                    <DieIcon
                                      key={idx}
                                      type={group.type}
                                      value={val}
                                      size="w-8 h-8"
                                      isKept={true}
                                      userColor={roll.userColor}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="text-xs font-black text-indigo-400 bg-indigo-500/10 px-4.5 py-2 rounded-full border border-indigo-500/20 animate-in zoom-in duration-300 flex items-center gap-1.5 shadow-sm mt-1">
                            Total Sum: <span className="text-white text-base font-black">{roll.totalSum}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Roll Hover Popover Card */}
      {hoveredRoll && (
        <div
          className="fixed z-50 w-80 bg-slate-900/98 border border-slate-700/80 backdrop-blur-lg rounded-2xl p-4.5 shadow-2xl flex flex-col gap-3.5 pointer-events-none animate-in fade-in slide-in-from-right-3 duration-150"
          style={{
            right: '336px',
            top: `${Math.max(80, Math.min(window.innerHeight - 260, hoveredRoll.clientTop - 60))}px`
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full border border-white/20"
                style={{ backgroundColor: hoveredRoll.userColor }}
              />
              <span className="text-xs font-black text-slate-100">{hoveredRoll.userName}</span>
            </div>
            <span className="text-[9px] text-slate-500 font-mono">
              {new Date(hoveredRoll.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {(() => {
            const getFormula = (r) => {
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
            return (
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Dice Formula
                </span>
                <span className="text-xs bg-indigo-500/10 text-indigo-400 font-black px-2.5 py-0.5 rounded border border-indigo-500/20 uppercase">
                  {getFormula(hoveredRoll)}
                </span>
              </div>
            );
          })()}

          <div className="flex flex-col gap-3.5 py-1 bg-slate-950/40 border border-slate-950/80 p-3 rounded-xl max-h-60 overflow-y-auto custom-scrollbar">
            {hoveredRoll.d20 && hoveredRoll.d20.count > 0 && (
              <div className="flex flex-col items-center gap-1.5 w-full">
                <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                  d20 roll
                </span>
                <div className="flex flex-wrap justify-center gap-2">
                  {hoveredRoll.d20.rolls.map((r, idx) => (
                    <div key={idx} className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 gap-1 shadow-inner">
                      {hoveredRoll.d20.mode !== 'normal' ? (
                        <>
                          <DieIcon
                            type={20}
                            value={r.kept}
                            size="w-9 h-9"
                            isKept={true}
                            userColor={hoveredRoll.userColor}
                          />
                          <DieIcon
                            type={20}
                            value={r.discarded}
                            size="w-9 h-9"
                            isKept={false}
                            isDiscarded={true}
                            userColor={hoveredRoll.userColor}
                          />
                        </>
                      ) : (
                        <DieIcon
                          type={20}
                          value={r.kept}
                          size="w-9 h-9"
                          isKept={true}
                          userColor={hoveredRoll.userColor}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hoveredRoll.dice && hoveredRoll.dice.length > 0 && (
              <div className="flex flex-col gap-3 w-full border-t border-slate-800/40 pt-2.5">
                {hoveredRoll.dice.map((group, gIdx) => (
                  <div key={gIdx} className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-extrabold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/10">
                      {group.count}d{group.type}
                    </span>
                    <div className="flex flex-wrap justify-center gap-1">
                      {group.rolls.map((val, idx) => (
                        <DieIcon
                          key={idx}
                          type={group.type}
                          value={val}
                          size="w-7 h-7"
                          isKept={true}
                          userColor={hoveredRoll.userColor}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {hoveredRoll.dice && hoveredRoll.dice.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Total Sum
              </span>
              <span className="text-base font-black text-indigo-400 bg-indigo-500/10 px-3.5 py-1 rounded-xl border border-indigo-500/20">
                {hoveredRoll.totalSum}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
