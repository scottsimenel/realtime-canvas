import { EVENTS } from '../../../shared/protocol.js';
import { useEffect, useRef, useCallback } from 'react';
import Canvas from '../components/canvas/Canvas.jsx';
import DiceEffects from '../components/dice/DiceEffects.jsx';
import Header from '../components/header/Header.jsx';
import LeftSidebar from '../components/sidebar/LeftSidebar.jsx';
import RightSidebar from '../components/sidebar/RightSidebar.jsx';
import DiceRollerWidget from '../components/sidebar/DiceRollerWidget.jsx';
import SavesModal from '../components/saves/SavesModal.jsx';
import CanvasDock from '../components/canvas/CanvasDock.jsx';
import CanvasTabsBar from '../components/canvas/CanvasTabsBar.jsx';
import ActiveRollsIndicator from '../components/dice/ActiveRollsIndicator.jsx';
import { getSocket } from '../lib/socket.js';
import { getFullUrl } from '../lib/url.js';
import { useUploadStore } from '../state/uploadStore.js';
import { useElementActions } from './hooks/useElementActions.js';
import { useSelectionActions } from './hooks/useSelectionActions.js';
import { useSocketConnection } from './hooks/useSocketConnection.js';
import { useUserEvents } from './hooks/useUserEvents.js';
import { useElementEvents } from './hooks/useElementEvents.js';
import { useTabEvents } from './hooks/useTabEvents.js';
import { useDiceEvents } from './hooks/useDiceEvents.js';
import { useSaveEvents } from './hooks/useSaveEvents.js';
import { useUiStore } from '../state/uiStore.js';
import { useDiceStore } from '../state/diceStore.js';
import { useSelectionStore } from '../state/selectionStore.js';
import { useHistoryStore } from '../state/historyStore.js';
import { useCanvasStore } from '../state/canvasStore.js';
import { useTabs } from './hooks/useTabs.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';

/**
 * AppContent Component.
 * Contains the main collaborative rendering context, socket listeners, and panels.
 */
export default function AppContent({
  connected,
  setConnected,
  joined,
  socketRef,
  currentUser,
  setCurrentUser,
  users,
  setUsers,
  roomIdInput
}) {
  const {
    showHeader,
    showLeftSidebar, setShowLeftSidebar,
    showRightSidebar, setShowRightSidebar,
    leftPanelTab, setLeftPanelTab,
    showDiceRoller, setShowDiceRoller,
    leftPanelCollapsed, setLeftPanelCollapsed,
    rightPanelCollapsed, setRightPanelCollapsed,
    handleCanvasInteraction,
    showSavesModal, setShowSavesModal,
    activeVirtualDimensions, setActiveVirtualDimensions,
    activeTool,
    penColor,
    penSize,
    eraserSize,
    showCursorNames, setShowCursorNames
  } = useUiStore();

  const {
    selectedElementIds,
    setSelectedElementIds,
    inputWidth, setInputWidth,
    inputHeight, setInputHeight,
    inputRotation, setInputRotation,
    isInspectorFocused, setIsInspectorFocused
  } = useSelectionStore();

  const {
    tabs,
    setTabs,
    activeTabId,
    elements,
    locks,
    setLocks,
    roomSettings,
    setElements
  } = useCanvasStore();

  const {
    saves,
    fetchSaves,
    handleCreateSave,
    handleLoadSave,
    handleDeleteSave
  } = useSaveEvents();

  useSocketConnection({
    joined,
    currentUser,
    roomIdInput,
    setConnected,
    setUsers,
    setCurrentUser
  });

  useUserEvents({ setUsers, setCurrentUser });
  useElementEvents();
  useTabEvents({ setUsers });
  useDiceEvents();
  const {
    hiddenAssetUrls,
    setHiddenAssetUrls,
    showHiddenMode,
    setShowHiddenMode,
    isUploading,
    uploadError,
    toggleHideAsset,
    handleImageUpload,
    allImageAssets,
    visibleAssets,
    hiddenAssets,
    draggedElementId,
    dragOverElementId
  } = useUploadStore();

  const {
    handleSpawnShape,
    handleSpawnImage,
    adjustElementLayer,
    adjustSelectedElementsLayer,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDragEnd,
    handleDrop
  } = useElementActions();

  const {
    handleStartInspectorTransform,
    handleEndInspectorTransform,
    handleInspectorChange,
    handleToggleSelectionLock,
    handleDeleteSelected,
    handleClearDrawings
  } = useSelectionActions(currentUser);

  const {
    history,
    redoStack,
    pushHistoryAction,
    handleUndo,
    handleRedo
  } = useHistoryStore();

  // Register keyboard shortcuts hook
  useKeyboardShortcuts();

  // Clear selection when active tab changes
  useEffect(() => {
    setSelectedElementIds([]);
  }, [activeTabId, setSelectedElementIds]);

  const {
    mixedDice, setMixedDice,
    d20Count, setD20Count,
    d20Mode, setD20Mode,
    activeRolls, setActiveRolls,
    rollHistory, setRollHistory,
    enable3dDice, setEnable3dDice,
    hoveredRoll, setHoveredRoll,
    shakeClass,
    diceSizeMultiplier, setDiceSizeMultiplier,
    handleCriticalRoll, handleRollDice: storeRollDice
  } = useDiceStore();



  const {
    handleSwitchTab,
    handleCreateTab,
    handleDeleteTab,
    handleRenameTab
  } = useTabs(setUsers);

  const handleUpdateRoomSettings = useCallback((updates) => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, roomSettings: { ...t.roomSettings, ...updates } }
            : t
        )
      );
      socket.emit(EVENTS.ROOM_SETTINGS_UPDATE, { updates, tabId: activeTabId }, (res) => {
        if (res && res.success && res.roomSettings) {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === activeTabId
                ? { ...t, roomSettings: res.roomSettings }
                : t
            )
          );
        }
      });
    }
  }, [activeTabId, setTabs, socketRef]);

  const nameRef = useRef('');
  const colorRef = useRef('');
  const roomIdRef = useRef('');
  const joinedRef = useRef(false);

  // Sync refs with latest state from props
  useEffect(() => {
    nameRef.current = currentUser?.name || '';
    colorRef.current = currentUser?.color || '';
    roomIdRef.current = roomIdInput;
    joinedRef.current = joined;
  }, [currentUser, roomIdInput, joined]);

  const handleRenameUser = useCallback((newName) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    if (!newName.trim()) return;

    socket.emit(EVENTS.USER_RENAME, { name: newName.trim() }, (res) => {
      if (res && res.success) {
        nameRef.current = newName.trim();
      } else {
        alert(res?.error || 'Failed to rename user.');
      }
    });
  }, [socketRef]);

  const handleRecolorUser = useCallback((newColor) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    if (!newColor) return;

    // Optimistically update local states immediately
    setCurrentUser((prev) => (prev ? { ...prev, color: newColor } : null));
    setUsers((prev) =>
      prev.map((u) => (u.id === socket.id ? { ...u, color: newColor } : u))
    );
    setRollHistory((prev) =>
      prev.map((r) => (r.userId === socket.id ? { ...r, userColor: newColor } : r))
    );
    setActiveRolls((prev) =>
      prev.map((r) => (r.userId === socket.id ? { ...r, userColor: newColor } : r))
    );
    colorRef.current = newColor;

    socket.emit(EVENTS.USER_RECOLOR, { color: newColor }, (res) => {
      if (res && res.success) {
        // Optimistic update succeeded
      } else {
        console.error(res?.error || 'Failed to update color.');
      }
    });
  }, [setCurrentUser, setUsers, setActiveRolls, setRollHistory, socketRef]);


  const handleRollDice = useCallback(() => {
    storeRollDice(currentUser?.color);
  }, [storeRollDice, currentUser]);

  // Connect socket and register general listeners
  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;
  }, [socketRef]);

  return (
    <div className={`flex-1 flex flex-col bg-[#070b13] overflow-hidden text-slate-100 h-full ${shakeClass}`}>
      {/* Header */}
      <Header
        showHeader={showHeader}
        roomIdInput={roomIdInput}
        connected={connected}
        users={users}
        currentUser={currentUser}
        tabs={tabs}
        handleRecolorUser={handleRecolorUser}
        handleRenameUser={handleRenameUser}
        handleUndo={handleUndo}
        undoDisabled={history.length === 0}
        handleRedo={handleRedo}
        redoDisabled={redoStack.length === 0}
        onOpenSaves={() => {
          fetchSaves();
          setShowSavesModal(true);
        }}
      />

      {/* Main Workspace Panels */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Library Sidebar */}
        <LeftSidebar
          showLeftSidebar={showLeftSidebar}
          setShowLeftSidebar={setShowLeftSidebar}
          leftPanelCollapsed={leftPanelCollapsed}
          setLeftPanelCollapsed={setLeftPanelCollapsed}
          leftPanelTab={leftPanelTab}
          setLeftPanelTab={setLeftPanelTab}
          visibleAssets={visibleAssets}
          hiddenAssets={hiddenAssets}
          showHiddenMode={showHiddenMode}
          setShowHiddenMode={setShowHiddenMode}
          roomSettings={roomSettings}
          allImageAssets={allImageAssets}
          activeVirtualDimensions={activeVirtualDimensions}
          showCursorNames={showCursorNames}
          setShowCursorNames={setShowCursorNames}
          users={users}
          currentUser={currentUser}
          tabs={tabs}
          isUploading={isUploading}
          uploadError={uploadError}
          handleSpawnShape={handleSpawnShape}
          handleSpawnImage={handleSpawnImage}
          handleUpdateRoomSettings={handleUpdateRoomSettings}
          handleImageUpload={handleImageUpload}
          toggleHideAsset={toggleHideAsset}
          hiddenAssetUrls={hiddenAssetUrls}
          setHiddenAssetUrls={setHiddenAssetUrls}
          handleRecolorUser={handleRecolorUser}
          getFullUrl={getFullUrl}
        />

        {/* Center Canvas Area */}
        <main className="flex-1 p-5 flex flex-col overflow-hidden relative">
          {/* Collaborative Canvas Tabs Bar */}
          <CanvasTabsBar
            users={users}
            handleSwitchTab={handleSwitchTab}
            handleDeleteTab={handleDeleteTab}
            handleRenameTab={handleRenameTab}
            handleCreateTab={handleCreateTab}
          />

          <div className="flex-1 min-h-0 relative">
            {/* Unified Floating Bottom-Center Dock */}
            <CanvasDock
              handleDeleteSelected={handleDeleteSelected}
              handleClearDrawings={handleClearDrawings}
            />

            <Canvas
              socketRef={socketRef}
              elements={elements}
              setElements={setElements}
              locks={locks}
              setLocks={setLocks}
              users={users}
              currentUser={currentUser}
              selectedElementIds={selectedElementIds}
              setSelectedElementIds={setSelectedElementIds}
              activeTool={activeTool}
              penColor={penColor}
              penSize={penSize}
              eraserSize={eraserSize}
              roomSettings={roomSettings}
              tabId={activeTabId}
              onVirtualDimensionsChange={setActiveVirtualDimensions}
              showCursorNames={showCursorNames}
              onCanvasInteraction={handleCanvasInteraction}
              pushHistoryAction={pushHistoryAction}
            />
          </div>
        </main>

        {/* Right Sidebar Inspector Floating Panel */}
        <RightSidebar
          showRightSidebar={showRightSidebar}
          setShowRightSidebar={setShowRightSidebar}
          rightPanelCollapsed={rightPanelCollapsed}
          setRightPanelCollapsed={setRightPanelCollapsed}
          users={users}
          currentUser={currentUser}
          elements={elements}
          setElements={setElements}
          locks={locks}
          selectedElementIds={selectedElementIds}
          setSelectedElementIds={setSelectedElementIds}
          activeTabId={activeTabId}
          tabs={tabs}
          socketRef={socketRef}
          inputWidth={inputWidth}
          setInputWidth={setInputWidth}
          inputHeight={inputHeight}
          setInputHeight={setInputHeight}
          inputRotation={inputRotation}
          setInputRotation={setInputRotation}
          isInspectorFocused={isInspectorFocused}
          setIsInspectorFocused={setIsInspectorFocused}
          handleStartInspectorTransform={handleStartInspectorTransform}
          handleEndInspectorTransform={handleEndInspectorTransform}
          handleInspectorChange={handleInspectorChange}
          adjustSelectedElementsLayer={adjustSelectedElementsLayer}
          handleDeleteSelected={handleDeleteSelected}
          adjustElementLayer={adjustElementLayer}
          handleToggleSelectionLock={handleToggleSelectionLock}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          handleDragEnd={handleDragEnd}
          handleDrop={handleDrop}
          draggedElementId={draggedElementId}
          dragOverElementId={dragOverElementId}
          pushHistoryAction={pushHistoryAction}
        />
      </div>

      {/* Floating Dice Roller Card Popover */}
      <DiceRollerWidget
        showDiceRoller={showDiceRoller}
        setShowDiceRoller={setShowDiceRoller}
        enable3dDice={enable3dDice}
        setEnable3dDice={setEnable3dDice}
        diceSizeMultiplier={diceSizeMultiplier}
        setDiceSizeMultiplier={setDiceSizeMultiplier}
        d20Count={d20Count}
        setD20Count={setD20Count}
        d20Mode={d20Mode}
        setD20Mode={setD20Mode}
        mixedDice={mixedDice}
        setMixedDice={setMixedDice}
        rollHistory={rollHistory}
        setRollHistory={setRollHistory}
        hoveredRoll={hoveredRoll}
        setHoveredRoll={setHoveredRoll}
        handleRollDice={handleRollDice}
        currentUser={currentUser}
      />

      {/* Dice Roll Broadcast Overlay Notifications */}
      <ActiveRollsIndicator />

      {enable3dDice && (
        <DiceEffects activeRolls={activeRolls} onCriticalRoll={handleCriticalRoll} diceSizeMultiplier={diceSizeMultiplier} />
      )}

      {showSavesModal && (
        <SavesModal
          saves={saves}
          onClose={() => setShowSavesModal(false)}
          onCreateSave={handleCreateSave}
          onLoadSave={handleLoadSave}
          onDeleteSave={handleDeleteSave}
        />
      )}
    </div>
  );
}
