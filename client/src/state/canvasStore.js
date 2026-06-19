import { createContext, useContext, useState, useRef, useEffect, useCallback, createElement, useMemo } from 'react';

const CanvasContext = createContext(null);

/**
 * Canvas State Store Provider.
 * Manages the tabs registry, active tab selection, elements, locks, and room settings.
 */
export function CanvasProvider({ children }) {
  const [tabs, setTabs] = useState([
    {
      id: 'tab-default',
      name: 'Canvas 1',
      elements: [],
      locks: {},
      roomSettings: {
        backgroundImageUrl: null,
        showBackground: true,
        showGrid: true,
        gridSnapping: false,
        gridType: 'square',
        gridSize: 40,
        customBackgroundWidth: null,
        customBackgroundHeight: null,
        gridScaleNumber: 5,
        gridScaleUnit: 'ft',
      },
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-default');

  const activeTabIdRef = useRef('tab-default');
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);
  const elements = useMemo(() => activeTab ? activeTab.elements : [], [activeTab]);
  const locks = useMemo(() => activeTab ? activeTab.locks : {}, [activeTab]);
  const roomSettings = useMemo(() => activeTab ? activeTab.roomSettings : {}, [activeTab]);

  const setElements = useCallback((updater) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabIdRef.current
          ? {
              ...t,
              elements:
                typeof updater === 'function' ? updater(t.elements) : updater,
            }
          : t
      )
    );
  }, []);

  const setLocks = useCallback((updater) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabIdRef.current
          ? {
              ...t,
              locks: typeof updater === 'function' ? updater(t.locks) : updater,
            }
          : t
      )
    );
  }, []);

  const value = useMemo(() => ({
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    elements,
    locks,
    roomSettings,
    setElements,
    setLocks
  }), [tabs, activeTabId, activeTab, elements, locks, roomSettings, setElements, setLocks]);

  return createElement(CanvasContext.Provider, { value }, children);
}

/**
 * Hook to consume the Canvas state store context.
 * @returns {object} The Canvas state store values and setters.
 */
export function useCanvasStore() {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvasStore must be used within a CanvasProvider');
  }
  return context;
}
