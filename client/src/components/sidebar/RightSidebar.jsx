import InspectorWidget from './InspectorWidget.jsx';

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
}) {
  const renderElementsAndLocks = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/85 pb-2">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <span>Layers & locks</span>
          </h2>
          <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700/50 font-bold px-2 py-0.5 rounded-full">
            {elements.length} items
          </span>
        </div>

        {elements.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6 bg-slate-900/20 rounded-xl border border-dashed border-slate-800">
            No items on canvas. Use the left panel to spawn something.
          </p>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
            {[...elements].reverse().map((el) => {
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
                    <div className="flex items-center gap-2">
                      <div className="text-slate-600 hover:text-slate-400 cursor-grab text-[13px] select-none mr-0.5">
                        ⋮⋮
                      </div>
                      <div className="w-5 h-5 rounded border border-slate-750 flex items-center justify-center text-xs">
                        {el.type === 'circle' ? '⚪' : el.type === 'image' ? '🖼️' : '🟦'}
                      </div>
                      <span className="text-xs font-bold text-slate-350">
                        {shapeName}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
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
                      <span className="text-[10px] text-slate-550 font-mono ml-1">
                        X:{el.x} Y:{el.y}
                      </span>
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
                          socket.emit('element-delete', { elementId: el.id }, (response) => {
                            if (response && response.success) {
                              setElements((prev) => prev.filter((item) => item.id !== el.id));
                              setSelectedElementIds((prev) => prev.filter((id) => id !== el.id));
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
