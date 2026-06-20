import { createContext, useContext, useState, useCallback, useEffect, createElement } from 'react';

const UiContext = createContext(null);

/**
 * UI State Store Provider.
 * Manages panel visibility, collapse state, Zen Mode, active tools, and save/cursor configurations.
 */
export function UiProvider({ children }) {
  const [showHeader, setShowHeader] = useState(true);
  const [showLeftSidebar, setShowLeftSidebar] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [showRightSidebar, setShowRightSidebar] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [showTabsBar, setShowTabsBar] = useState(true);
  const [leftPanelTab, setLeftPanelTab] = useState('images'); // 'shapes' | 'images' | 'canvas'
  const [showDiceRoller, setShowDiceRoller] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // States for collaborative drawing tool and configs
  const [showSavesModal, setShowSavesModal] = useState(false);
  const [activeVirtualDimensions, setActiveVirtualDimensions] = useState({ width: 1920, height: 1080 });
  const [activeTool, setActiveTool] = useState('select'); // 'select', 'pan', 'pen', 'eraser', 'measure'
  const [penColor, setPenColor] = useState('#3b82f6');
  const [penSize, setPenSize] = useState(4);
  const [eraserSize, setEraserSize] = useState(20);

  const [showCursorNames, setShowCursorNames] = useState(() => {
    try {
      const saved = localStorage.getItem('canvas_show_cursor_names');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('canvas_show_cursor_names', JSON.stringify(showCursorNames));
    } catch (e) {
      console.error(e);
    }
  }, [showCursorNames]);

  const isZenMode = !showHeader && !showLeftSidebar && !showRightSidebar && !showTabsBar;

  const handleToggleZenMode = useCallback(() => {
    const nextState = isZenMode;
    setShowHeader(nextState);
    setShowLeftSidebar(nextState);
    setShowRightSidebar(nextState);
    setShowTabsBar(nextState);
    setLeftPanelCollapsed(false);
    setRightPanelCollapsed(false);
  }, [isZenMode]);

  const handleCanvasInteraction = useCallback((clickedEmptySpace) => {
    if (clickedEmptySpace) {
      if (showLeftSidebar) setLeftPanelCollapsed(true);
      if (showRightSidebar) setRightPanelCollapsed(true);
    } else {
      if (showLeftSidebar) setLeftPanelCollapsed(true);
      setShowRightSidebar(true);
      setRightPanelCollapsed(false);
    }
  }, [showLeftSidebar, showRightSidebar]);

  const [locateElementTrigger, setLocateElementTrigger] = useState(null);

  const value = {
    showHeader,
    setShowHeader,
    showLeftSidebar,
    setShowLeftSidebar,
    showRightSidebar,
    setShowRightSidebar,
    showTabsBar,
    setShowTabsBar,
    leftPanelTab,
    setLeftPanelTab,
    showDiceRoller,
    setShowDiceRoller,
    leftPanelCollapsed,
    setLeftPanelCollapsed,
    rightPanelCollapsed,
    setRightPanelCollapsed,
    isZenMode,
    handleToggleZenMode,
    handleCanvasInteraction,
    showSavesModal,
    setShowSavesModal,
    activeVirtualDimensions,
    setActiveVirtualDimensions,
    activeTool,
    setActiveTool,
    penColor,
    setPenColor,
    penSize,
    setPenSize,
    eraserSize,
    setEraserSize,
    showCursorNames,
    setShowCursorNames,
    locateElementTrigger,
    setLocateElementTrigger
  };

  return createElement(UiContext.Provider, { value }, children);
}

/**
 * Hook to consume the UI state store context.
 * @returns {object} The UI state store values and setters.
 */
export function useUiStore() {
  const context = useContext(UiContext);
  if (!context) {
    throw new Error('useUiStore must be used within a UiProvider');
  }
  return context;
}

