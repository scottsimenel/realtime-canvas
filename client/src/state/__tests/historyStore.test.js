import { describe, expect, test, vi, beforeEach } from 'vitest';

// State capture objects
const reactMockValueCapture = { captured: null };
let currentMockStates = {};
let stateIndex = 0;

// Mock React Module
vi.mock('react', () => {
  const mockUseState = (init) => {
    const idx = stateIndex++;
    if (currentMockStates[idx] === undefined) {
      currentMockStates[idx] = typeof init === 'function' ? init() : init;
    }
    const setter = (val) => {
      currentMockStates[idx] = typeof val === 'function' ? val(currentMockStates[idx]) : val;
    };
    return [currentMockStates[idx], setter];
  };

  const mockUseRef = (init) => {
    const idx = stateIndex++;
    if (currentMockStates[idx] === undefined) {
      currentMockStates[idx] = { current: init };
    }
    return currentMockStates[idx];
  };

  return {
    useState: mockUseState,
    useRef: mockUseRef,
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useEffect: () => {},
    createContext: () => ({}),
    useContext: (ctx) => {
      // Return captured value if resolving HistoryContext
      return reactMockValueCapture.captured;
    },
    createElement: (type, props) => {
      if (props && props.value) {
        reactMockValueCapture.captured = props.value;
      }
      return null;
    }
  };
});

// Import the provider
import { HistoryProvider, useHistoryStore } from '../historyStore.js';

// Mock Socket
const mockSocket = {
  connected: true,
  id: 'socket-user-123',
  emit: vi.fn((event, data, callback) => {
    if (callback) {
      callback({ success: true });
    }
  }),
  on: vi.fn(),
  off: vi.fn()
};

vi.mock('../../lib/socket.js', () => ({
  getSocket: () => mockSocket
}));

// Dynamic mocks for cross-store references
let currentActiveTabId = 'tab-default';
let currentSelectedElementIds = [];
const mockSetSelectedElementIds = vi.fn((updateFn) => {
  if (typeof updateFn === 'function') {
    currentSelectedElementIds = updateFn(currentSelectedElementIds);
  } else {
    currentSelectedElementIds = updateFn;
  }
});
vi.mock('../selectionStore.js', () => ({
  useSelectionStore: () => ({
    setSelectedElementIds: mockSetSelectedElementIds
  })
}));

let currentTabs = [{ id: 'tab-default', elements: [{ id: 'el1', type: 'circle', x: 50, y: 50, properties: {} }] }];
const mockSetTabs = vi.fn((updateFn) => {
  if (typeof updateFn === 'function') {
    currentTabs = updateFn(currentTabs);
  } else {
    currentTabs = updateFn;
  }
});
const mockSetActiveTabId = vi.fn((id) => {
  currentActiveTabId = id;
});
vi.mock('../canvasStore.js', () => ({
  useCanvasStore: () => ({
    setTabs: mockSetTabs,
    activeTabId: currentActiveTabId,
    setActiveTabId: mockSetActiveTabId,
    tabs: currentTabs
  })
}));

describe('historyStore behavioral unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockStates = {};
    stateIndex = 0;
    reactMockValueCapture.captured = null;
    currentActiveTabId = 'tab-default';
    currentSelectedElementIds = [];
    currentTabs = [{ id: 'tab-default', elements: [{ id: 'el1', type: 'circle', x: 50, y: 50, properties: {} }] }];
  });

  const getStoreInstance = () => {
    stateIndex = 0;
    HistoryProvider({ children: null });
    return reactMockValueCapture.captured;
  };

  test('initial state is correct', () => {
    const store = getStoreInstance();
    expect(store.history).toEqual([]);
    expect(store.redoStack).toEqual([]);
  });

  test('pushHistoryAction pushes action and clears redo stack', () => {
    let store = getStoreInstance();
    store.pushHistoryAction({ type: 'create', id: 'act1' });

    store = getStoreInstance();
    expect(store.history.length).toBe(1);
    expect(store.history[0].id).toBe('act1');

    // Manually pollute redoStack to verify it gets cleared on new action
    store.setRedoStack([{ type: 'create', id: 'redo1' }]);
    store = getStoreInstance();
    expect(store.redoStack.length).toBe(1);

    store.pushHistoryAction({ type: 'create', id: 'act2' });
    store = getStoreInstance();
    expect(store.history.length).toBe(2);
    expect(store.history[0].id).toBe('act2');
    expect(store.redoStack.length).toBe(0); // Cleared!
  });

  test('history stack is capped at 50 actions', () => {
    const store = getStoreInstance();
    // Push 55 actions
    for (let i = 1; i <= 55; i++) {
      store.pushHistoryAction({ type: 'create', id: `act-${i}` });
    }
    const updatedStore = getStoreInstance();
    expect(updatedStore.history.length).toBe(50);
    // The oldest pushed should be evicted, so the oldest remaining is act-6
    expect(updatedStore.history[49].id).toBe('act-6');
    expect(updatedStore.history[0].id).toBe('act-55');
  });

  test('handleUndo and handleRedo do nothing when stacks are empty', () => {
    const store = getStoreInstance();
    store.handleUndo();
    expect(mockSocket.emit).not.toHaveBeenCalled();

    store.handleRedo();
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  test('active tab switches when action tabId does not match current tabId', () => {
    const store = getStoreInstance();
    store.pushHistoryAction({ type: 'create', tabId: 'tab-custom', elements: [{ id: 'el1' }] });
    
    const updatedStore = getStoreInstance();
    updatedStore.handleUndo();

    expect(mockSetActiveTabId).toHaveBeenCalledWith('tab-custom');
    expect(mockSocket.emit).toHaveBeenCalledWith('tab-switch', { tabId: 'tab-custom' });
  });

  test('undo and redo round-trip for "create" action', () => {
    const store = getStoreInstance();
    const action = {
      type: 'create',
      tabId: 'tab-default',
      elements: [{ id: 'el1', type: 'circle', x: 50, y: 50 }]
    };
    store.pushHistoryAction(action);

    // Undo
    let currentStore = getStoreInstance();
    currentStore.handleUndo();
    expect(mockSocket.emit).toHaveBeenCalledWith('element-delete', { elementIds: ['el1'], tabId: 'tab-default' }, expect.any(Function));
    
    // Simulate setTabs execution in callback
    expect(mockSetTabs).toHaveBeenCalled();
    expect(mockSetSelectedElementIds).toHaveBeenCalled();

    // Redo
    currentStore = getStoreInstance();
    expect(currentStore.redoStack.length).toBe(1);
    currentStore.handleRedo();
    expect(mockSocket.emit).toHaveBeenCalledWith('element-create', { element: action.elements[0], tabId: 'tab-default' }, expect.any(Function));
    expect(mockSetTabs).toHaveBeenCalledTimes(2);
  });

  test('undo and redo round-trip for "delete" action', () => {
    const store = getStoreInstance();
    const action = {
      type: 'delete',
      tabId: 'tab-default',
      elements: [{ id: 'el1', type: 'circle', x: 50, y: 50 }]
    };
    store.pushHistoryAction(action);

    // Undo
    let currentStore = getStoreInstance();
    currentStore.handleUndo();
    expect(mockSocket.emit).toHaveBeenCalledWith('element-create', { element: action.elements[0], tabId: 'tab-default' }, expect.any(Function));
    expect(mockSetTabs).toHaveBeenCalled();

    // Redo
    currentStore = getStoreInstance();
    currentStore.handleRedo();
    expect(mockSocket.emit).toHaveBeenCalledWith('element-delete', { elementIds: ['el1'], tabId: 'tab-default' }, expect.any(Function));
    expect(mockSetSelectedElementIds).toHaveBeenCalled();
  });

  test('undo and redo round-trip for "transform" action', () => {
    const store = getStoreInstance();
    const action = {
      type: 'transform',
      tabId: 'tab-default',
      elementsBefore: [{ id: 'el1', x: 50, y: 50, width: 20, height: 20, properties: {} }],
      elementsAfter: [{ id: 'el1', x: 100, y: 100, width: 20, height: 20, properties: {} }]
    };
    store.pushHistoryAction(action);

    // Undo
    let currentStore = getStoreInstance();
    currentStore.handleUndo();
    expect(mockSocket.emit).toHaveBeenCalledWith('element-update', {
      batch: [{ elementId: 'el1', updates: { x: 50, y: 50, width: 20, height: 20, properties: {} } }],
      tabId: 'tab-default'
    }, expect.any(Function));
    expect(mockSetTabs).toHaveBeenCalled();

    // Redo
    currentStore = getStoreInstance();
    currentStore.handleRedo();
    expect(mockSocket.emit).toHaveBeenCalledWith('element-update', {
      batch: [{ elementId: 'el1', updates: { x: 100, y: 100, width: 20, height: 20, properties: {} } }],
      tabId: 'tab-default'
    }, expect.any(Function));
  });

  test('undo and redo round-trip for "erase" action', () => {
    const store = getStoreInstance();
    const action = {
      type: 'erase',
      tabId: 'tab-default',
      elementsBefore: [{ id: 'el1', type: 'circle', x: 50, y: 50 }],
      elementsAfter: [{ id: 'el2', type: 'circle', x: 100, y: 100 }]
    };
    store.pushHistoryAction(action);

    // Undo
    let currentStore = getStoreInstance();
    currentStore.handleUndo();
    expect(mockSocket.emit).toHaveBeenCalledWith('element-delete', { elementIds: ['el2'], tabId: 'tab-default' }, expect.any(Function));
    expect(mockSocket.emit).toHaveBeenCalledWith('element-create', { element: action.elementsBefore[0], tabId: 'tab-default' }, expect.any(Function));
    expect(mockSetTabs).toHaveBeenCalled();

    // Redo
    currentStore = getStoreInstance();
    currentStore.handleRedo();
    expect(mockSocket.emit).toHaveBeenCalledWith('element-delete', { elementIds: ['el1'], tabId: 'tab-default' }, expect.any(Function));
    expect(mockSocket.emit).toHaveBeenCalledWith('element-create', { element: action.elementsAfter[0], tabId: 'tab-default' }, expect.any(Function));
  });

  test('undo and redo round-trip for "reorder" action', () => {
    const store = getStoreInstance();
    const action = {
      type: 'reorder',
      tabId: 'tab-default',
      orderedIdsBefore: ['el1', 'el2'],
      orderedIdsAfter: ['el2', 'el1']
    };
    store.pushHistoryAction(action);

    // Undo
    let currentStore = getStoreInstance();
    currentStore.handleUndo();
    expect(mockSocket.emit).toHaveBeenCalledWith('elements-reorder', { orderedIds: ['el1', 'el2'], tabId: 'tab-default' }, expect.any(Function));
    expect(mockSetTabs).toHaveBeenCalled();

    // Redo
    currentStore = getStoreInstance();
    currentStore.handleRedo();
    expect(mockSocket.emit).toHaveBeenCalledWith('elements-reorder', { orderedIds: ['el2', 'el1'], tabId: 'tab-default' }, expect.any(Function));
  });

  test('useHistoryStore throws error when used outside HistoryProvider', () => {
    // Temporarily clear captured react values
    reactMockValueCapture.captured = null;
    expect(() => useHistoryStore()).toThrowError('useHistoryStore must be used within a HistoryProvider');
  });
});
