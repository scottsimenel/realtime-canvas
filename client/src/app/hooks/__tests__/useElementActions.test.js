import { describe, expect, test, vi, beforeEach } from 'vitest';

// Mock React
vi.mock('react', () => ({
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useState: (init) => [typeof init === 'function' ? init() : init, vi.fn()],
  useRef: (init) => ({ current: init }),
  useEffect: () => {},
}));

import { useElementActions } from '../useElementActions.js';
import { EVENTS } from '../../../../../shared/protocol.js';

// Mock Socket
const mockSocket = {
  connected: true,
  id: 'socket-test-123',
  emit: vi.fn(),
};

vi.mock('../../../lib/socket.js', () => ({
  getSocket: () => mockSocket,
}));

// Mock Stores
let mockElements = [];
const mockSetElements = vi.fn((updater) => {
  mockElements = typeof updater === 'function' ? updater(mockElements) : updater;
});

const mockPushHistoryAction = vi.fn();

let mockSelectedElementIds = [];

vi.mock('../../../state/canvasStore.js', () => ({
  useCanvasStore: () => ({
    elements: mockElements,
    setElements: mockSetElements,
    activeTabId: 'tab-1',
  }),
}));

vi.mock('../../../state/historyStore.js', () => ({
  useHistoryStore: () => ({
    pushHistoryAction: mockPushHistoryAction,
  }),
}));

vi.mock('../../../state/selectionStore.js', () => ({
  useSelectionStore: () => ({
    selectedElementIds: mockSelectedElementIds,
  }),
}));

vi.mock('../../../state/uploadStore.js', () => ({
  useUploadStore: () => ({
    draggedElementId: null,
    setDraggedElementId: vi.fn(),
    setDragOverElementId: vi.fn(),
  }),
}));

vi.mock('../../../state/uiStore.js', () => ({
  useUiStore: () => ({
    activeVirtualDimensions: { width: 1920, height: 1080 },
  }),
}));

describe('useElementActions layer adjustment tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElements = [
      { id: 'el-bottom', type: 'image', x: 0, y: 0 },
      { id: 'el-middle', type: 'circle', x: 50, y: 50 },
      { id: 'el-top', type: 'rectangle', x: 100, y: 100 },
    ];
    mockSelectedElementIds = [];
  });

  test('adjustElementsToFront moves bottom element to top of layer stack', () => {
    const { adjustElementsToFront } = useElementActions();

    adjustElementsToFront(['el-bottom']);

    expect(mockSetElements).toHaveBeenCalled();
    expect(mockElements.map((el) => el.id)).toEqual(['el-middle', 'el-top', 'el-bottom']);

    expect(mockSocket.emit).toHaveBeenCalledWith(EVENTS.ELEMENTS_REORDER, {
      orderedIds: ['el-middle', 'el-top', 'el-bottom'],
      tabId: 'tab-1',
    });

    expect(mockPushHistoryAction).toHaveBeenCalledWith({
      type: 'reorder',
      orderedIdsBefore: ['el-bottom', 'el-middle', 'el-top'],
      orderedIdsAfter: ['el-middle', 'el-top', 'el-bottom'],
      tabId: 'tab-1',
    });
  });

  test('adjustElementsToFront is a no-op if element is already at the top', () => {
    const { adjustElementsToFront } = useElementActions();

    adjustElementsToFront(['el-top']);

    // State updater should return prev unmodified without socket emission or history push
    expect(mockElements.map((el) => el.id)).toEqual(['el-bottom', 'el-middle', 'el-top']);
    expect(mockSocket.emit).not.toHaveBeenCalled();
    expect(mockPushHistoryAction).not.toHaveBeenCalled();
  });

  test('adjustElementsToFront moves multiple selected tokens to the top preserving relative order', () => {
    const { adjustElementsToFront } = useElementActions();

    adjustElementsToFront(['el-bottom', 'el-middle']);

    expect(mockElements.map((el) => el.id)).toEqual(['el-top', 'el-bottom', 'el-middle']);

    expect(mockSocket.emit).toHaveBeenCalledWith(EVENTS.ELEMENTS_REORDER, {
      orderedIds: ['el-top', 'el-bottom', 'el-middle'],
      tabId: 'tab-1',
    });

    expect(mockPushHistoryAction).toHaveBeenCalledWith({
      type: 'reorder',
      orderedIdsBefore: ['el-bottom', 'el-middle', 'el-top'],
      orderedIdsAfter: ['el-top', 'el-bottom', 'el-middle'],
      tabId: 'tab-1',
    });
  });

  test('adjustElementLayer("front") delegates to adjustElementsToFront', () => {
    const { adjustElementLayer } = useElementActions();

    adjustElementLayer('el-middle', 'front');

    expect(mockElements.map((el) => el.id)).toEqual(['el-bottom', 'el-top', 'el-middle']);
    expect(mockSocket.emit).toHaveBeenCalledWith(EVENTS.ELEMENTS_REORDER, {
      orderedIds: ['el-bottom', 'el-top', 'el-middle'],
      tabId: 'tab-1',
    });
  });

  test('adjustElementsToFront safely handles non-existent IDs or empty array', () => {
    const { adjustElementsToFront } = useElementActions();

    adjustElementsToFront([]);
    expect(mockSocket.emit).not.toHaveBeenCalled();

    adjustElementsToFront(['non-existent']);
    expect(mockSocket.emit).not.toHaveBeenCalled();
    expect(mockPushHistoryAction).not.toHaveBeenCalled();
  });
});
