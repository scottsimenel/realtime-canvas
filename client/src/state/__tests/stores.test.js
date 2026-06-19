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
    useContext: () => ({}),
    createElement: (type, props) => {
      if (props && props.value) {
        reactMockValueCapture.captured = props.value;
      }
      return null;
    }
  };
});

// Import the providers *after* the react mock is defined
import { UiProvider } from '../uiStore.js';
import { ClipboardProvider } from '../clipboardStore.js';

// Mock Socket
const mockSocket = {
  connected: true,
  id: 'socket-user-123',
  emit: vi.fn((event, data, callback) => {
    if (callback) {
      callback({ success: true, roomSettings: { name: 'Test' } });
    }
  }),
  on: vi.fn(),
  off: vi.fn()
};

vi.mock('../../lib/socket.js', () => ({
  getSocket: () => mockSocket
}));

// Mock selections and other stores for cross-store references
const mockSetSelectedElementIds = vi.fn();
vi.mock('../selectionStore.js', () => ({
  useSelectionStore: () => ({
    selectedElementIds: ['el1'],
    setSelectedElementIds: mockSetSelectedElementIds,
    setIsInspectorFocused: vi.fn(),
    inspectorLockRef: { current: false },
    originalInspectorElementsRef: { current: [] }
  })
}));

const mockSetTabs = vi.fn();
const mockSetElements = vi.fn();
vi.mock('../canvasStore.js', () => ({
  useCanvasStore: () => ({
    activeTabId: 'tab-default',
    setActiveTabId: vi.fn(),
    tabs: [{ id: 'tab-default', elements: [{ id: 'el1', type: 'circle', x: 50, y: 50, properties: {} }] }],
    setTabs: mockSetTabs,
    elements: [{ id: 'el1', type: 'circle', x: 50, y: 50, properties: {} }],
    setElements: mockSetElements,
    locks: {}
  })
}));

const mockPushHistoryAction = vi.fn();
vi.mock('../historyStore.js', () => ({
  useHistoryStore: () => ({
    history: [],
    redoStack: [],
    pushHistoryAction: mockPushHistoryAction,
    handleUndo: vi.fn(),
    handleRedo: vi.fn()
  })
}));

describe('State stores behavioral unit tests (Node mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockStates = {};
    stateIndex = 0;
    reactMockValueCapture.captured = null;
  });

  test('UiProvider initial state and Zen Mode toggling', () => {
    // Run Provider
    UiProvider({ children: null });

    const value = reactMockValueCapture.captured;
    expect(value).not.toBeNull();
    expect(value.isZenMode).toBe(false);
    expect(value.showHeader).toBe(true);

    // Call toggle Zen Mode callback
    value.handleToggleZenMode();

    // Re-run Provider to get updated states
    stateIndex = 0;
    UiProvider({ children: null });

    const nextValue = reactMockValueCapture.captured;
    expect(nextValue.isZenMode).toBe(true);
    expect(nextValue.showHeader).toBe(false);
  });

  test('ClipboardProvider copy and paste calculations', () => {
    ClipboardProvider({ children: null });

    const value = reactMockValueCapture.captured;
    expect(value).not.toBeNull();

    // Test handleCopy
    value.handleCopy();
    
    // Test handlePaste
    value.handlePaste();
    
    expect(mockSetElements).toHaveBeenCalled();
    expect(mockSetSelectedElementIds).toHaveBeenCalled();
    expect(mockPushHistoryAction).toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalled();
  });
});
