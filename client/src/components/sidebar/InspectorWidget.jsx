import TooltipInspector from './TooltipInspector.jsx';

export default function InspectorWidget({
  selectedElementIds,
  elements,
  inputWidth,
  setInputWidth,
  inputHeight,
  setInputHeight,
  inputRotation,
  setInputRotation,
  handleStartInspectorTransform,
  handleEndInspectorTransform,
  handleInspectorChange,
  adjustSelectedElementsLayer,
  handleDeleteSelected,
}) {
  if (selectedElementIds.length === 0) return null;
  const selectedEl = elements.find((el) => el.id === selectedElementIds[0]);
  if (!selectedEl) return null;

  const shapesSelected = elements.filter(
    (el) => selectedElementIds.includes(el.id) && ['rectangle', 'circle', 'triangle', 'star', 'hexagon'].includes(el.type)
  );

  return (
    <div className="space-y-5">
      <div className="p-4.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest">
            Inspector
          </h2>
          <span className="text-xs bg-sky-500/10 text-sky-400 font-bold px-2.5 py-0.5 rounded-full border border-sky-500/25">
            {selectedElementIds.length} Selected
          </span>
        </div>

        {/* Width & Height Inputs */}
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 select-none">
              Width (px)
            </label>
            <input
              type="number"
              min="10"
              max="2000"
              value={inputWidth}
              placeholder={selectedElementIds.length > 1 && inputWidth === '' ? 'Mixed' : 'Width'}
              onFocus={handleStartInspectorTransform}
              onBlur={() => {
                handleEndInspectorTransform();
                const selectedElements = elements.filter((el) => selectedElementIds.includes(el.id));
                if (selectedElements.length > 0) {
                  const firstWidth = selectedElements[0].width;
                  const allSameWidth = selectedElements.every((el) => el.width === firstWidth);
                  setInputWidth(allSameWidth ? String(firstWidth) : '');
                }
              }}
              onChange={(e) => {
                setInputWidth(e.target.value);
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  handleInspectorChange({ width: val });
                }
              }}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-205 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 select-none">
              Height (px)
            </label>
            <input
              type="number"
              min="10"
              max="2000"
              value={inputHeight}
              placeholder={selectedElementIds.length > 1 && inputHeight === '' ? 'Mixed' : 'Height'}
              onFocus={handleStartInspectorTransform}
              onBlur={() => {
                handleEndInspectorTransform();
                const selectedElements = elements.filter((el) => selectedElementIds.includes(el.id));
                if (selectedElements.length > 0) {
                  const firstHeight = selectedElements[0].height;
                  const allSameHeight = selectedElements.every((el) => el.height === firstHeight);
                  setInputHeight(allSameHeight ? String(firstHeight) : '');
                }
              }}
              onChange={(e) => {
                setInputHeight(e.target.value);
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  handleInspectorChange({ height: val });
                }
              }}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-205 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
            />
          </div>
        </div>

        {/* Rotation Control */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
              Rotation
            </label>
            <span className="text-xs font-mono text-slate-400">
              {(() => {
                if (inputRotation !== '') {
                  return `${inputRotation}°`;
                }
                const firstEl = elements.find((el) => el.id === selectedElementIds[0]);
                const rotRad = firstEl?.properties?.rotation || 0;
                const deg = Math.round((rotRad * 180) / Math.PI) % 360;
                return `${deg < 0 ? deg + 360 : deg}°`;
              })()}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="360"
              value={(() => {
                if (inputRotation !== '') {
                  const deg = parseInt(inputRotation, 10);
                  if (!isNaN(deg)) return deg;
                }
                const firstEl = elements.find((el) => el.id === selectedElementIds[0]);
                const rotRad = firstEl?.properties?.rotation || 0;
                const deg = Math.round((rotRad * 180) / Math.PI) % 360;
                return deg < 0 ? deg + 360 : deg;
              })()}
              onMouseDown={handleStartInspectorTransform}
              onTouchStart={handleStartInspectorTransform}
              onMouseUp={handleEndInspectorTransform}
              onTouchEnd={handleEndInspectorTransform}
              onChange={(e) => {
                const deg = parseInt(e.target.value, 10);
                setInputRotation(String(deg));
                const rad = (deg * Math.PI) / 180;
                handleInspectorChange((el) => ({
                  properties: {
                    ...(el.properties || {}),
                    rotation: rad,
                  },
                }));
              }}
              className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
            <input
              type="number"
              min="0"
              max="360"
              value={inputRotation}
              placeholder={selectedElementIds.length > 1 && inputRotation === '' ? 'Mixed' : '0'}
              onFocus={handleStartInspectorTransform}
              onBlur={() => {
                handleEndInspectorTransform();
                const selectedElements = elements.filter((el) => selectedElementIds.includes(el.id));
                if (selectedElements.length > 0) {
                  const firstRot = selectedElements[0].properties?.rotation || 0;
                  const deg = Math.round((firstRot * 180) / Math.PI) % 360;
                  const normalizedDeg = deg < 0 ? deg + 360 : deg;
                  const allSameRot = selectedElements.every((el) => {
                    const r = el.properties?.rotation || 0;
                    const d = Math.round((r * 180) / Math.PI) % 360;
                    const nd = d < 0 ? d + 360 : d;
                    return nd === normalizedDeg;
                  });
                  setInputRotation(allSameRot ? String(normalizedDeg) : '');
                }
              }}
              onChange={(e) => {
                setInputRotation(e.target.value);
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  const deg = val % 360;
                  const rad = (deg * Math.PI) / 180;
                  handleInspectorChange((el) => ({
                    properties: {
                      ...(el.properties || {}),
                      rotation: rad,
                    },
                  }));
                }
              }}
              className="w-16 px-2 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-center text-slate-205 focus:outline-none focus:border-sky-500 transition"
            />
          </div>
        </div>

        {/* Snapping Control */}
        <div className="flex items-center justify-between border-t border-slate-800/85 pt-3 select-none">
          <div className="flex flex-col gap-0.5 text-left">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Snap to Grid
            </span>
            <span className="text-[9px] text-slate-500">
              Align center to nearest grid center
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const currentSnap = selectedEl.properties?.snapToGrid !== false;
              handleInspectorChange({
                properties: {
                  snapToGrid: !currentSnap
                }
              });
            }}
            className={`w-10 h-6.5 rounded-full p-1 border transition-colors duration-200 cursor-pointer flex items-center ${
              selectedEl.properties?.snapToGrid !== false
                ? 'bg-sky-500 border-sky-600 justify-end'
                : 'bg-slate-950/80 border-slate-800 justify-start'
            }`}
            title="Toggle snapping to grid for selected element"
          >
            <span className="w-4.5 h-4.5 rounded-full shadow-md bg-white" />
          </button>
        </div>

        {/* Layer Order Controls */}
        <div className="border-t border-slate-800/85 pt-3 space-y-2">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
            Layer Order
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => adjustSelectedElementsLayer('front')}
              className="py-2 px-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="Bring to Front"
            >
              ⏫ Bring to Front
            </button>
            <button
              type="button"
              onClick={() => adjustSelectedElementsLayer('forward')}
              className="py-2 px-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="Bring Forward"
            >
              ▲ Bring Forward
            </button>
            <button
              type="button"
              onClick={() => adjustSelectedElementsLayer('backward')}
              className="py-2 px-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="Send Backward"
            >
              ▼ Send Backward
            </button>
            <button
              type="button"
              onClick={() => adjustSelectedElementsLayer('back')}
              className="py-2 px-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="Send to Back"
            >
              ⏬ Send to Back
            </button>
          </div>
        </div>

        {/* Dynamic Appearance & Style Controls */}
        {shapesSelected.length > 0 && (
          <div className="border-t border-slate-800/85 pt-4 space-y-4">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest select-none">
              Appearance & Style
            </h3>

            {/* Shape Type Selector */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider select-none">
                Shape Type
              </label>
              <select
                value={shapesSelected.every(el => el.type === shapesSelected[0].type) ? shapesSelected[0].type : ''}
                onChange={(e) => {
                  const newType = e.target.value;
                  handleInspectorChange({ type: newType });
                }}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-205 focus:outline-none focus:border-sky-500 transition cursor-pointer"
              >
                <option value="" disabled>-- Mixed Shapes --</option>
                <option value="rectangle">Rectangle ⬜</option>
                <option value="circle">Circle ⚪</option>
                <option value="triangle">Triangle 🔺</option>
                <option value="star">Star ⭐</option>
                <option value="hexagon">Hexagon ⬢</option>
              </select>
            </div>

            {/* Fill Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider select-none">
                  Fill Color & Opacity
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(() => {
                    const firstFillOpacity = shapesSelected[0].properties?.fillOpacity;
                    const allSameOpacity = shapesSelected.every(el => el.properties?.fillOpacity === firstFillOpacity);
                    return allSameOpacity ? `${Math.round((firstFillOpacity !== undefined ? firstFillOpacity : 1) * 100)}%` : 'Mixed';
                  })()}
                </span>
              </div>

              {/* Preset Row + Picker */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  '#3b82f6', '#ef4444', '#10b981', '#8b5cf6', '#f59e0b',
                  '#ec4899', '#14b8a6', '#64748b', '#ffffff', '#000000'
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      handleInspectorChange({
                        properties: {
                          fill: c
                        }
                      });
                    }}
                    className="w-5.5 h-5.5 rounded-full border border-slate-800 hover:scale-110 active:scale-95 transition cursor-pointer"
                    style={{ backgroundColor: c }}
                  />
                ))}
                <div className="relative w-5.5 h-5.5 rounded-full border border-slate-800 overflow-hidden cursor-pointer bg-slate-950 flex items-center justify-center">
                  <input
                    type="color"
                    value={shapesSelected[0].properties?.fill || '#3b82f6'}
                    onChange={(e) => {
                      handleInspectorChange({
                        properties: {
                          fill: e.target.value
                        }
                      });
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <span className="text-[9px] pointer-events-none select-none text-slate-400">🎨</span>
                </div>
              </div>

              {/* Fill Opacity Slider */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={(() => {
                  const firstFillOpacity = shapesSelected[0].properties?.fillOpacity;
                  const allSameOpacity = shapesSelected.every(el => el.properties?.fillOpacity === firstFillOpacity);
                  return allSameOpacity ? (firstFillOpacity !== undefined ? firstFillOpacity : 1) : 1;
                })()}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  handleInspectorChange({
                    properties: {
                      fillOpacity: val
                    }
                  });
                }}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            {/* Outline Controls */}
            <div className="space-y-2 border-t border-slate-800/60 pt-3">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider select-none">
                  Enable Outline
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const firstStrokeEnabled = shapesSelected[0].properties?.strokeEnabled !== false;
                    handleInspectorChange({
                      properties: {
                        strokeEnabled: !firstStrokeEnabled
                      }
                    });
                  }}
                  className={`w-9 h-5.5 rounded-full p-0.5 border transition-colors duration-200 cursor-pointer flex items-center ${
                    shapesSelected.every(el => el.properties?.strokeEnabled !== false)
                      ? 'bg-sky-500 border-sky-600 justify-end'
                      : 'bg-slate-950/80 border-slate-800/85 justify-start'
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              {shapesSelected.some(el => el.properties?.strokeEnabled !== false) && (
                <div className="space-y-3 pt-1.5 animate-in fade-in duration-200">
                  {/* Outline Color */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      '#3b82f6', '#ef4444', '#10b981', '#8b5cf6', '#f59e0b',
                      '#ec4899', '#14b8a6', '#64748b', '#ffffff', '#000000'
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          handleInspectorChange({
                            properties: {
                              stroke: c
                            }
                          });
                        }}
                        className="w-5.5 h-5.5 rounded-full border border-slate-800 hover:scale-110 active:scale-95 transition cursor-pointer"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <div className="relative w-5.5 h-5.5 rounded-full border border-slate-800 overflow-hidden cursor-pointer bg-slate-950 flex items-center justify-center">
                      <input
                        type="color"
                        value={shapesSelected[0].properties?.stroke || '#2563eb'}
                        onChange={(e) => {
                          handleInspectorChange({
                            properties: {
                              stroke: e.target.value
                            }
                          });
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <span className="text-[9px] pointer-events-none select-none text-slate-400">🎨</span>
                    </div>
                  </div>

                  {/* Outline Width Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                      <span>Outline Width</span>
                      <span>
                        {(() => {
                          const firstStrokeWidth = shapesSelected[0].properties?.strokeWidth;
                          const allSameWidth = shapesSelected.every(el => el.properties?.strokeWidth === firstStrokeWidth);
                          return allSameWidth ? `${firstStrokeWidth !== undefined ? firstStrokeWidth : 2}px` : 'Mixed';
                        })()}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="1"
                      value={(() => {
                        const firstStrokeWidth = shapesSelected[0].properties?.strokeWidth;
                        const allSameWidth = shapesSelected.every(el => el.properties?.strokeWidth === firstStrokeWidth);
                        return allSameWidth ? (firstStrokeWidth !== undefined ? firstStrokeWidth : 2) : 2;
                      })()}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        handleInspectorChange({
                          properties: {
                            strokeWidth: val
                          }
                        });
                      }}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                  </div>

                  {/* Outline Opacity Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                      <span>Outline Opacity</span>
                      <span>
                        {(() => {
                          const firstStrokeOpacity = shapesSelected[0].properties?.strokeOpacity;
                          const allSameOpacity = shapesSelected.every(el => el.properties?.strokeOpacity === firstStrokeOpacity);
                          return allSameOpacity ? `${Math.round((firstStrokeOpacity !== undefined ? firstStrokeOpacity : 1) * 100)}%` : 'Mixed';
                        })()}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={(() => {
                        const firstStrokeOpacity = shapesSelected[0].properties?.strokeOpacity;
                        const allSameOpacity = shapesSelected.every(el => el.properties?.strokeOpacity === firstStrokeOpacity);
                        return allSameOpacity ? (firstStrokeOpacity !== undefined ? firstStrokeOpacity : 1) : 1;
                      })()}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        handleInspectorChange({
                          properties: {
                            strokeOpacity: val
                          }
                        });
                      }}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delete Button */}
        <button
          type="button"
          onClick={handleDeleteSelected}
          className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/35 hover:border-rose-500/60 text-xs text-rose-455 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
        >
          🗑️ Delete Selected
        </button>
      </div>

      {selectedElementIds.length === 1 && selectedEl && ['rectangle', 'circle', 'triangle', 'star', 'hexagon', 'image'].includes(selectedEl.type) && (
        <TooltipInspector
          element={selectedEl}
          onChange={handleInspectorChange}
        />
      )}
    </div>
  );
}
