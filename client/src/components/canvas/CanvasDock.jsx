import { useUiStore } from '../../state/uiStore.js';
import { useSelectionStore } from '../../state/selectionStore.js';

/**
 * CanvasDock Component.
 * Contains the bottom toolbar dock, including tool selectors (select, pan, pen, eraser, measure),
 * actions (delete element, clear drawings), and sidebar toggles.
 */
export default function CanvasDock({ handleDeleteSelected, handleClearDrawings }) {
  const {
    showLeftSidebar, setShowLeftSidebar,
    showRightSidebar, setShowRightSidebar,
    showDiceRoller, setShowDiceRoller,
    setLeftPanelCollapsed,
    setRightPanelCollapsed,
    isZenMode, handleToggleZenMode,
    activeTool, setActiveTool,
    penColor, setPenColor,
    penSize, setPenSize,
    eraserSize, setEraserSize
  } = useUiStore();

  const { selectedElementIds } = useSelectionStore();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 w-max select-none">
      {/* Slide-out sub-toolbar when Pen Tool is active */}
      {activeTool === 'pen' && (
        <div className="backdrop-blur-md bg-slate-900/70 border border-slate-800 rounded-2xl px-4 py-2 shadow-2xl flex items-center gap-4 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
          {/* Pen Color presets */}
          <div className="flex items-center gap-1.5">
            {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ffffff'].map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setPenColor(color)}
                style={{ backgroundColor: color }}
                className={`w-5 h-5 rounded-full transition-all border border-black/10 cursor-pointer ${
                  penColor === color
                    ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-900 scale-110'
                    : 'hover:scale-105'
                }`}
              />
            ))}
            {/* Custom color picker */}
            <div className="relative w-5 h-5 rounded-full overflow-hidden border border-slate-700 cursor-pointer flex items-center justify-center">
              <input
                type="color"
                value={penColor}
                onChange={(e) => setPenColor(e.target.value)}
                className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer opacity-0"
              />
              <span className="text-[10px] text-slate-400 font-bold select-none">+</span>
            </div>
          </div>

          <div className="w-px h-4 bg-slate-800" />

          {/* Pen size selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400 select-none">Size</span>
            <input
              type="range"
              min="2"
              max="24"
              value={penSize}
              onChange={(e) => setPenSize(parseInt(e.target.value, 10))}
              className="w-20 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
            <span className="text-[10px] font-mono text-slate-400 select-none w-5 text-right">
              {penSize}px
            </span>
          </div>
        </div>
      )}

      {/* Slide-out sub-toolbar when Eraser Tool is active */}
      {activeTool === 'eraser' && (
        <div className="backdrop-blur-md bg-slate-900/70 border border-slate-800 rounded-2xl px-4 py-2 shadow-2xl flex items-center gap-4 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400 select-none">Eraser Size</span>
            <input
              type="range"
              min="5"
              max="100"
              value={eraserSize}
              onChange={(e) => setEraserSize(parseInt(e.target.value, 10))}
              className="w-24 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
            <span className="text-[10px] font-mono text-slate-400 select-none w-8 text-right">
              {eraserSize}px
            </span>
          </div>
        </div>
      )}

      {/* Main Dock bar */}
      <div className="backdrop-blur-lg bg-slate-950/80 border border-slate-800/80 rounded-2xl p-1.5 shadow-2xl flex items-center gap-1.5">
        {/* 1. Tool Selectors */}
        <button
          type="button"
          onClick={() => setActiveTool('select')}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            activeTool === 'select'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Select Tool"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.303.197-1.593 1.593M21.75 12h-2.25m-.197 5.303-1.593-1.593M3.071 6.25 4.664 4.664M12 19.75v2.25M6.25 3.071 4.664 4.664M4.5 12H2.25" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('pan')}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            activeTool === 'pan'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Pan Tool (Hand)"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a2 2 0 114 0v4m0 0V5a2 2 0 114 0v6m0 0V3a2 2 0 114 0v8m0 0V9a2 2 0 114 0v10a7 7 0 01-7 7H9a7 7 0 01-7-7V11a2 2 0 114 0v4m0 0v-4" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('pen')}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            activeTool === 'pen'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Pen Tool"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('eraser')}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            activeTool === 'eraser'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Eraser Tool"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('measure')}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            activeTool === 'measure'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Measurement Tool (Ruler)"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
          </svg>
        </button>

        <div className="w-px h-6 bg-slate-800 self-center mx-1" />

        {/* 2. Actions */}
        <button
          type="button"
          onClick={handleDeleteSelected}
          disabled={selectedElementIds.length === 0}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            selectedElementIds.length === 0
              ? 'text-slate-600 cursor-not-allowed opacity-35'
              : 'text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 active:scale-95'
          }`}
          title="Delete Selected Elements (Delete/Backspace)"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleClearDrawings}
          className="p-2.5 rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all cursor-pointer active:scale-95"
          title="Clear All Drawings"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16M7 16h10M9 12h6M11 8h2M12 4v4" />
          </svg>
        </button>

        <div className="w-px h-6 bg-slate-800 self-center mx-1" />

        {/* 3. Panel Toggles */}
        {/* Library Toggle */}
        <button
          type="button"
          onClick={() => { setShowLeftSidebar(!showLeftSidebar); setLeftPanelCollapsed(false); }}
          className={`p-2.5 rounded-xl transition-all cursor-pointer border ${
            showLeftSidebar
              ? 'bg-sky-500 border-sky-400 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 border-transparent hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Toggle Library Panel (🎨)"
        >
          <span className="text-base leading-none">🎨</span>
        </button>

        {/* Dice Toggle */}
        <button
          type="button"
          onClick={() => setShowDiceRoller(!showDiceRoller)}
          className={`p-2.5 rounded-xl transition-all cursor-pointer border ${
            showDiceRoller
              ? 'bg-indigo-650 border-indigo-500 text-white shadow-md shadow-indigo-650/20'
              : 'text-slate-400 border-transparent hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Toggle Dice Roller Panel (🎲)"
        >
          <span className="text-base leading-none">🎲</span>
        </button>

        {/* Properties Toggle */}
        <button
          type="button"
          onClick={() => { setShowRightSidebar(!showRightSidebar); setRightPanelCollapsed(false); }}
          className={`p-2.5 rounded-xl transition-all cursor-pointer border ${
            showRightSidebar
              ? 'bg-sky-500 border-sky-400 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 border-transparent hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Toggle Inspector Panel (⚙️)"
        >
          <span className="text-base leading-none">⚙️</span>
        </button>

        <div className="w-px h-6 bg-slate-800 self-center mx-1" />

        {/* 4. Zen Mode */}
        <button
          type="button"
          onClick={handleToggleZenMode}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            isZenMode
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Toggle Zen Mode (Press \)"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            {isZenMode ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3 3m12 6V4.5m0 4.5h4.5M15 9l6-6m-6 12v4.5m0-4.5h4.5m-4.5 0l6 6m-6-12v4.5m0-4.5H4.5M9 15l-6 6" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 0v4.5m0-4.5h-4.5m4.5 0l-6-6" />
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}
