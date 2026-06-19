import { createContext, useContext, useState, useCallback, createElement } from 'react';

const UiContext = createContext(null);

/**
 * UI State Store Provider.
 * Manages panel visibility, collapse state, and Zen Mode.
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
    handleCanvasInteraction
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
