import { useUiStore } from '../../state/uiStore.js';
import { useSelectionStore } from '../../state/selectionStore.js';
import Icon from '../common/Icon.jsx';

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
    leftPanelCollapsed, setLeftPanelCollapsed,
    rightPanelCollapsed, setRightPanelCollapsed,
    isZenMode, handleToggleZenMode,
    activeTool, setActiveTool,
    penColor, setPenColor,
    penSize, setPenSize,
    eraserSize, setEraserSize
  } = useUiStore();

  const { selectedElementIds } = useSelectionStore();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 max-w-[calc(100vw-1rem)] select-none">
      {/* Slide-out sub-toolbar when Pen Tool is active */}
      {activeTool === 'pen' && (
        <div className="backdrop-blur-md bg-slate-900/70 border border-slate-800 rounded-2xl px-3 sm:px-4 py-2 shadow-2xl flex items-center gap-2 sm:gap-4 max-w-full overflow-x-auto no-scrollbar transition-all duration-300 animate-in fade-in slide-in-from-top-2">
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
              <Icon name="plus" className="w-2.5 h-2.5 text-slate-400 pointer-events-none" />
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
        <div className="backdrop-blur-md bg-slate-900/70 border border-slate-800 rounded-2xl px-3 sm:px-4 py-2 shadow-2xl flex items-center gap-4 max-w-full overflow-x-auto no-scrollbar transition-all duration-300 animate-in fade-in slide-in-from-top-2">
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
      <div className="backdrop-blur-lg bg-slate-950/80 border border-slate-800/80 rounded-2xl p-1 sm:p-1.5 shadow-2xl flex items-center gap-1 sm:gap-1.5 max-w-full overflow-x-auto no-scrollbar">
        {/* 1. Tool Selectors */}
        <button
          type="button"
          onClick={() => setActiveTool('select')}
          className={`p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            activeTool === 'select'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Select Tool"
        >
          <Icon name="mouse-pointer" className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('pan')}
          className={`p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            activeTool === 'pan'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Pan Tool (Hand)"
        >
          <Icon name="hand" className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('pen')}
          className={`p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            activeTool === 'pen'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Pen Tool"
        >
          <Icon name="pencil" className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('eraser')}
          className={`p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            activeTool === 'eraser'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Eraser Tool"
        >
          <Icon name="eraser" className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('measure')}
          className={`p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            activeTool === 'measure'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Measurement Tool (Ruler)"
        >
          <Icon name="ruler" className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-slate-800 self-center mx-1 shrink-0" />

        {/* 2. Actions */}
        <button
          type="button"
          onClick={handleDeleteSelected}
          disabled={selectedElementIds.length === 0}
          className={`p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            selectedElementIds.length === 0
              ? 'text-slate-600 cursor-not-allowed opacity-35'
              : 'text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 active:scale-95'
          }`}
          title="Delete Selected Elements (Delete/Backspace)"
        >
          <Icon name="trash" className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleClearDrawings}
          className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all cursor-pointer active:scale-95 shrink-0"
          title="Clear All Drawings"
        >
          <Icon name="sparkles" className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-slate-800 self-center mx-1 shrink-0" />

        {/* 3. Panel Toggles */}
        {/* Library Toggle */}
        <button
          type="button"
          onClick={() => {
            const next = !showLeftSidebar;
            setShowLeftSidebar(next);
            setLeftPanelCollapsed(false);
            if (next && typeof window !== 'undefined' && window.innerWidth < 1024) {
              setShowRightSidebar(false);
            }
          }}
          className={`p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer border shrink-0 ${
            showLeftSidebar && !leftPanelCollapsed
              ? 'bg-sky-500 border-sky-400 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 border-transparent hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Toggle Library Panel"
        >
          <Icon name="shapes" className="w-5 h-5" />
        </button>

        {/* Dice Toggle */}
        <button
          type="button"
          onClick={() => setShowDiceRoller(!showDiceRoller)}
          className={`p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer border shrink-0 ${
            showDiceRoller
              ? 'bg-indigo-650 border-indigo-500 text-white shadow-md shadow-indigo-650/20'
              : 'text-slate-400 border-transparent hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Toggle Dice Roller Panel"
        >
          <Icon name="dices" className="w-5 h-5" />
        </button>

        {/* Properties Toggle */}
        <button
          type="button"
          onClick={() => {
            const next = !showRightSidebar;
            setShowRightSidebar(next);
            setRightPanelCollapsed(false);
            if (next && typeof window !== 'undefined' && window.innerWidth < 1024) {
              setShowLeftSidebar(false);
            }
          }}
          className={`p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer border shrink-0 ${
            showRightSidebar && !rightPanelCollapsed
              ? 'bg-sky-500 border-sky-400 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 border-transparent hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Toggle Inspector Panel"
        >
          <Icon name="sliders" className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-slate-800 self-center mx-1 shrink-0" />

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
          <Icon name={isZenMode ? "minimize" : "maximize"} className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
