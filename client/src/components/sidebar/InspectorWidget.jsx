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

        {/* Layer Order Controls */}
        <div className="border-t border-slate-800/85 pt-3 space-y-2">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
            Layer Order
          </span>
          <div className="grid grid-cols-2 gap-2">
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
          </div>
        </div>

        {/* Delete Button */}
        <button
          type="button"
          onClick={handleDeleteSelected}
          className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/35 hover:border-rose-500/60 text-xs text-rose-455 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
        >
          🗑️ Delete Selected
        </button>
      </div>

      {selectedElementIds.length === 1 && selectedEl && ['rectangle', 'circle', 'image'].includes(selectedEl.type) && (
        <TooltipInspector
          element={selectedEl}
          onChange={handleInspectorChange}
        />
      )}
    </div>
  );
}
