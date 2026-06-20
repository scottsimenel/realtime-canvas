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
    useContext: () => reactMockValueCapture.captured,
    createElement: (type, props, children) => {
      if (props && props.value) {
        reactMockValueCapture.captured = props.value;
      }
      return null;
    }
  };
});

// Import target store providers
import { UploadProvider, useUploadStore } from '../uploadStore.js';

// Mock Socket
const mockSocket = {
  connected: true,
  id: 'socket-user-123',
  emit: vi.fn((event, data, callback) => {
    if (callback) {
      if (event === 'asset-rename') {
        callback({ success: true, asset: { id: data.assetId, name: data.name, url: '/uploads/map.png' } });
      } else {
        callback({ success: true, assetId: data.assetId });
      }
    }
  }),
  on: vi.fn(),
  off: vi.fn()
};

vi.mock('../../lib/socket.js', () => ({
  SOCKET_URL: 'http://localhost:5000',
  getSocket: () => mockSocket
}));

describe('uploadStore behavioral unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockStates = {};
    stateIndex = 0;
    reactMockValueCapture.captured = null;
  });

  test('UploadProvider initial state, filters, search and actions', () => {
    // Run Provider
    UploadProvider({ children: null });

    let store = reactMockValueCapture.captured;
    expect(store).not.toBeNull();

    // Verify initial values
    expect(store.searchQuery).toBe('');
    expect(store.activeFilter).toBe('all');
    
    // There are some default preset images
    expect(store.visibleAssets.length).toBeGreaterThan(0);
    const initialPresetCount = store.visibleAssets.length;

    // Test search filter
    store.setSearchQuery('nonexistent_image_name_xyz');
    
    // Re-run provider to get updated state
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;

    expect(store.visibleAssets.length).toBe(0);

    // Reset search query
    store.setSearchQuery('');
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.visibleAssets.length).toBe(initialPresetCount);

    // Test preset filter
    store.setActiveFilter('presets');
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.visibleAssets.every(a => a.isPreset)).toBe(true);

    // Test upload filter (should be empty initially)
    store.setActiveFilter('uploads');
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.visibleAssets.length).toBe(0);

    // Add a custom asset to state using mock sets
    store.setAssets([{ id: 'custom_asset_1', name: 'My Map', url: '/uploads/map.png' }]);
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;

    // Filter uploads should show the custom asset
    expect(store.visibleAssets.length).toBe(1);
    expect(store.visibleAssets[0].name).toBe('My Map');

    // Test rename asset action
    store.handleRenameAsset('custom_asset_1', 'Renamed Map');
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'asset-rename',
      expect.objectContaining({ assetId: 'custom_asset_1', name: 'Renamed Map' }),
      expect.any(Function)
    );

    // Test delete asset action
    store.handleDeleteAsset('custom_asset_1');
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'asset-delete',
      expect.objectContaining({ assetId: 'custom_asset_1' }),
      expect.any(Function)
    );
  });

  test('useUploadStore throws error outside provider', () => {
    reactMockValueCapture.captured = null;
    expect(() => useUploadStore()).toThrowError('useUploadStore must be used within an UploadProvider');
  });
});
