import { useState } from 'react';
import InspectorWidget from './InspectorWidget.jsx';
import { EVENTS } from '../../../../shared/protocol.js';
import { getFullUrl } from '../../lib/url.js';

export default function RightSidebar({
  showRightSidebar,
  setShowRightSidebar,
  rightPanelCollapsed,
  setRightPanelCollapsed,
  selectedElementIds,
  setSelectedElementIds,
  elements,
  setElements,
  locks,
  currentUser,
  users,
  draggedElementId,
  dragOverElementId,
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
  adjustElementLayer,
  handleToggleSelectionLock,
  handleDragStart,
  handleDragOver,
  handleDragLeave,
  handleDragEnd,
  handleDrop,
  socketRef,
  pushHistoryAction,
  setLocateElementTrigger,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'selected', 'images', 'shapes'

  const renderElementsAndLocks = () => {
    const filteredElements = elements.filter((el) => {
      // 1. Filter by category
      if (activeFilter === 'selected') {
        if (!selectedElementIds.includes(el.id)) return false;
      } else if (activeFilter === 'images') {
        if (el.type !== 'image') return false;
      } else if (activeFilter === 'shapes') {
        if (el.type === 'image') return false;
      }

      // 2. Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const typeMatch = el.type.toLowerCase().includes(q);
        const titleMatch = el.properties?.tooltip?.title?.toLowerCase().includes(q);
        const textMatch = el.properties?.text?.toLowerCase().includes(q);
        
        const shapeName = (el.type.charAt(0).toUpperCase() + el.type.slice(1)).toLowerCase();
        const shapeMatch = shapeName.includes(q);

        if (!typeMatch && !titleMatch && !textMatch && !shapeMatch) {
          return false;
        }
      }

      return true;
    });

    return (
      <div className="space-y-4">
        {/* Title & Count */}
        <div className="flex items-center justify-between border-b border-slate-800/85 pb-2">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <span>Layers & locks</span>
          </h2>
          <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700/50 font-bold px-2 py-0.5 rounded-full">
            {elements.length} items
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search elements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 pl-9 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-205 placeholder-slate-650 focus:outline-none focus:border-sky-500 transition"
          />
          <span className="absolute left-3 top-2.5 text-slate-500 text-xs">🔍</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2 text-slate-400 hover:text-slate-200 text-xs"
              title="Clear Search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-1.5 pb-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'selected', label: 'Selected' },
            { id: 'images', label: 'Images' },
            { id: 'shapes', label: 'Shapes' },
          ].map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold border transition duration-150 active:scale-95 cursor-pointer ${
                  isActive
                    ? 'bg-sky-500/15 border-sky-500/50 text-sky-400'
                    : 'bg-slate-900 border-slate-800 text-slate-450 hover:bg-slate-850 hover:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {filteredElements.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6 bg-slate-900/20 rounded-xl border border-dashed border-slate-800">
            {elements.length === 0
              ? "No items on canvas. Use the left panel to spawn something."
              : "No items match your search or filter."}
          </p>
        ) : (
          <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1 custom-scrollbar">
            {[...filteredElements].reverse().map((el) => {
              const lockHolderId = locks[el.id];
              const isLocked = !!lockHolderId;
              const lockHolder = isLocked ? users.find((u) => u.id === lockHolderId) : null;
              const isLockedByOther = isLocked && lockHolderId !== currentUser?.id;
              const isSelected = selectedElementIds.includes(el.id);
              const shapeName = el.type.charAt(0).toUpperCase() + el.type.slice(1);

              const originalIndex = elements.findIndex((item) => item.id === el.id);
              const isFirst = originalIndex === elements.length - 1; // front-most (top of stack)
              const isLast = originalIndex === 0; // back-most (bottom of stack)

              const isDragging = draggedElementId === el.id;
              const isDragOver = dragOverElementId === el.id;

              const tooltipTitle = el.properties?.tooltip?.title;
              const customName = tooltipTitle ? `"${tooltipTitle}"` : '';
              
              const textSnippet = el.type === 'text' && el.properties?.text
                ? `"${el.properties.text.length > 15 ? el.properties.text.slice(0, 15) + '...' : el.properties.text}"`
                : '';
              
              const displayName = el.type === 'text' && textSnippet
                ? `Text: ${textSnippet}`
                : `${shapeName}${customName ? `: ${customName}` : ''}`;

              const renderPreview = () => {
                if (el.type === 'image') {
                  return (
                    <img
                      src={getFullUrl(el.properties?.url)}
                      alt=""
                      className="w-6 h-6 rounded object-cover border border-slate-750 flex-shrink-0"
                    />
                  );
                }

                // Draw colored shape swatch
                const fill = el.type === 'path'
                  ? (el.properties?.stroke || '#3b82f6')
                  : (el.properties?.fill || '#3b82f6');
                
                return (
                  <div
                    className="w-5 h-5 border border-slate-700/50 flex-shrink-0"
                    style={{
                      backgroundColor: fill,
                      borderRadius: el.type === 'circle' ? '50%' : '4px',
                    }}
                  />
                );
              };

              return (
                <div
                  key={el.id}
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, el.id)}
                  onDragOver={(e) => handleDragOver(e, el.id)}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, el.id)}
                  onClick={(e) => {
                    if (e.shiftKey) {
                      setSelectedElementIds((prev) =>
                        prev.includes(el.id)
                          ? prev.filter((id) => id !== el.id)
                          : [...prev, el.id]
                      );
                    } else {
                      setSelectedElementIds([el.id]);
                    }
                  }}
                  className={`p-3 rounded-xl flex flex-col gap-2 transition cursor-grab active:cursor-grabbing select-none ${
                    isSelected
                      ? 'bg-sky-500/10 border border-sky-500/80 shadow-md shadow-sky-500/5'
                      : 'bg-slate-900/40 border border-slate-800/50 hover:border-slate-800'
                  } ${isDragging ? 'opacity-40' : ''} ${
                    isDragOver ? 'border-dashed border-sky-400 bg-sky-500/5 scale-[1.02]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-slate-600 hover:text-slate-400 cursor-grab text-[13px] select-none mr-0.5 flex-shrink-0">
                        ⋮⋮
                      </div>
                      {renderPreview()}
                      <span className="text-xs font-bold text-slate-350 truncate">
                        {displayName}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustElementLayer(el.id, 'front');
                        }}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] border transition active:scale-95 cursor-pointer ${
                          isFirst
                            ? 'border-slate-800 text-slate-750 cursor-not-allowed bg-slate-950/20'
                            : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-800'
                        }`}
                        title="Bring to Front"
                        draggable="false"
                      >
                        ⏫
                      </button>
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustElementLayer(el.id, 'forward');
                        }}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs border transition active:scale-95 cursor-pointer ${
                          isFirst
                            ? 'border-slate-800 text-slate-700 cursor-not-allowed bg-slate-950/20'
                            : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-800'
                        }`}
                        title="Bring Forward"
                        draggable="false"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustElementLayer(el.id, 'backward');
                        }}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs border transition active:scale-95 cursor-pointer ${
                          isLast
                            ? 'border-slate-800 text-slate-700 cursor-not-allowed bg-slate-950/20'
                            : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-800'
                        }`}
                        title="Send Backward"
                        draggable="false"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustElementLayer(el.id, 'back');
                        }}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] border transition active:scale-95 cursor-pointer ${
                          isLast
                            ? 'border-slate-800 text-slate-750 cursor-not-allowed bg-slate-950/20'
                            : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-800'
                        }`}
                        title="Send to Back"
                        draggable="false"
                      >
                        ⏬
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementIds([el.id]);
                          if (setLocateElementTrigger) {
                            setLocateElementTrigger(el.id);
                          }
                        }}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-xs border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-800 transition active:scale-95 cursor-pointer"
                        title="Locate on Canvas"
                        draggable="false"
                      >
                        👁️
                      </button>
                      <button
                        type="button"
                        disabled={isLockedByOther}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelectionLock(el.id);
                        }}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs border transition active:scale-95 cursor-pointer ${
                          isLockedByOther
                            ? 'border-slate-800/40 text-slate-700 cursor-not-allowed bg-slate-950/10'
                            : el.properties?.locked
                            ? 'border-amber-500/35 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 shadow-sm shadow-amber-500/5'
                            : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-800'
                        }`}
                        title={isLockedByOther ? "Cannot lock/unlock: currently being edited" : el.properties?.locked ? "Click to unlock selection on canvas" : "Click to lock selection on canvas (Sidebar only)"}
                        draggable="false"
                      >
                        {el.properties?.locked ? '🔒' : '🔓'}
                      </button>
                    </div>
                  </div>

                  {/* Lock Status Bar */}
                  {isLocked ? (
                    <div
                      style={{
                        borderColor: lockHolder?.color ? `${lockHolder.color}20` : '#38bdf820',
                        backgroundColor: lockHolder?.color ? `${lockHolder.color}08` : '#38bdf808',
                      }}
                      className="flex items-center justify-between border rounded-lg px-2.5 py-1 text-xs"
                    >
                      <span className="text-slate-400 flex items-center gap-1.5">
                        🔒 Editing: Locked by{' '}
                        <span
                          style={{ color: lockHolder?.color }}
                          className="font-extrabold"
                        >
                          {lockHolder?.name || 'Unknown'}
                        </span>
                      </span>
                    </div>
                  ) : el.properties?.locked ? (
                    <div className="flex items-center justify-between border border-amber-500/25 bg-amber-500/5 rounded-lg px-2.5 py-1 text-xs text-amber-400">
                      <span className="flex items-center gap-1">
                        🔒 Canvas Selection Locked
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between border border-slate-800/80 bg-slate-950/20 rounded-lg px-2.5 py-1 text-xs text-slate-500">
                      <span>🔓 Unlocked & Editable</span>
                    </div>
                  )}

                  {/* Delete Element Button */}
                  {isSelected && !isLockedByOther && !el.properties?.locked && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const socket = socketRef.current;
                        if (socket && socket.connected) {
                          const elementToDelete = JSON.parse(JSON.stringify(el));
                          socket.emit(EVENTS.ELEMENT_DELETE, { elementId: el.id }, (response) => {
                            if (response && response.success) {
                              setElements((prev) => prev.filter((item) => item.id !== el.id));
                              setSelectedElementIds((prev) => prev.filter((id) => id !== el.id));
                              if (pushHistoryAction) {
                                pushHistoryAction({
                                  type: 'delete',
                                  elements: [elementToDelete],
                                  tabId: 'tab-default',
                                });
                              }
                            }
                          });
                        }
                      }}
                      className="mt-1 w-full py-2 px-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-xs text-rose-400 font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                      draggable="false"
                    >
                      🗑️ Delete Element
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside 
      className={`group fixed right-6 top-24 bottom-28 w-80 z-40 flex flex-col bg-slate-950/80 backdrop-blur-md border border-slate-850 rounded-2xl p-5 shadow-2xl overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out select-none ${
        showRightSidebar
          ? 'opacity-100 scale-100 pointer-events-auto'
          : 'opacity-0 translate-x-10 scale-95 pointer-events-none'
      } ${
        rightPanelCollapsed ? 'translate-x-[calc(100%+12px)] opacity-40 hover:opacity-100 hover:border-sky-500/50 cursor-pointer' : 'translate-x-0'
      }`}
      onMouseEnter={rightPanelCollapsed ? () => setRightPanelCollapsed(false) : undefined}
    >
      {/* Collapsed Indicator Strip */}
      {rightPanelCollapsed && (
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-sky-500/50 group-hover:bg-sky-500 transition-colors" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0 border-b border-slate-800/85 pb-2">
        <h2 className="text-sm font-bold text-slate-355 uppercase tracking-widest">
          {selectedElementIds.length > 0 ? 'Properties' : 'Inspector'}
        </h2>
        <button
          type="button"
          onClick={() => { setShowRightSidebar(false); setRightPanelCollapsed(false); }}
          className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg bg-slate-900 border border-slate-800 transition cursor-pointer active:scale-95 flex items-center justify-center animate-in duration-200"
          title="Close Panel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-5 custom-scrollbar">
        {selectedElementIds.length > 0 ? (
          <div className="space-y-5 animate-in fade-in duration-200">
            <InspectorWidget
              selectedElementIds={selectedElementIds}
              elements={elements}
              locks={locks}
              currentUser={currentUser}
              inputWidth={inputWidth}
              setInputWidth={setInputWidth}
              inputHeight={inputHeight}
              setInputHeight={setInputHeight}
              inputRotation={inputRotation}
              setInputRotation={setInputRotation}
              handleStartInspectorTransform={handleStartInspectorTransform}
              handleEndInspectorTransform={handleEndInspectorTransform}
              handleInspectorChange={handleInspectorChange}
              adjustSelectedElementsLayer={adjustSelectedElementsLayer}
              handleDeleteSelected={handleDeleteSelected}
            />
            <hr className="border-slate-850" />
            {renderElementsAndLocks()}
          </div>
        ) : (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-col justify-center items-center text-center p-6 text-slate-550">
              <span className="text-3xl mb-3">🔍</span>
              <p className="text-sm font-semibold text-slate-400">No Selection</p>
              <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed mt-1">
                Select an element on the canvas or from the layers list below to inspect.
              </p>
            </div>
            <hr className="border-slate-850" />
            {renderElementsAndLocks()}
          </div>
        )}
      </div>
    </aside>
  );
}
