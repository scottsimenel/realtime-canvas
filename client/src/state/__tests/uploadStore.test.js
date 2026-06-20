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
    createElement: (type, props) => {
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
      } else if (event === 'folder-create') {
        callback({ success: true, folder: data.folder });
      } else if (event === 'folder-rename') {
        callback({ success: true, folder: { id: data.folderId, name: data.name } });
      } else if (event === 'folder-delete') {
        callback({ success: true });
      } else if (event === 'asset-move') {
        callback({ success: true, asset: { id: data.assetId, folderId: data.folderId } });
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

  test('Folder management actions: create, rename, delete, move', () => {
    UploadProvider({ children: null });
    let store = reactMockValueCapture.captured;

    // 1. Create Folder
    store.handleCreateFolder('New Test Folder');
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'folder-create',
      expect.objectContaining({ folder: expect.objectContaining({ name: 'New Test Folder' }) }),
      expect.any(Function)
    );

    // Verify folder was added to state
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.folders.length).toBe(1);
    expect(store.folders[0].name).toBe('New Test Folder');
    const folderId = store.folders[0].id;

    // 2. Rename Folder
    store.handleRenameFolder(folderId, 'Renamed Test Folder');
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'folder-rename',
      expect.objectContaining({ folderId, name: 'Renamed Test Folder' }),
      expect.any(Function)
    );

    // Verify folder was renamed
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.folders[0].name).toBe('Renamed Test Folder');

    // 3. Move Asset to Folder
    store.setAssets([{ id: 'asset_x', name: 'Asset X', url: '/uploads/x.png', folderId: null }]);
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;

    store.handleMoveAsset('asset_x', folderId);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'asset-move',
      expect.objectContaining({ assetId: 'asset_x', folderId }),
      expect.any(Function)
    );

    // Verify asset's folderId is updated
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.assets[0].folderId).toBe(folderId);

    // 4. Delete Folder
    store.handleDeleteFolder(folderId);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'folder-delete',
      expect.objectContaining({ folderId }),
      expect.any(Function)
    );

    // Verify folder is deleted and assets in that folder have folderId reset to null
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.folders.length).toBe(0);
    expect(store.assets[0].folderId).toBeNull();
  });

  test('useUploadStore throws error outside provider', () => {
    reactMockValueCapture.captured = null;
    expect(() => useUploadStore()).toThrowError('useUploadStore must be used within an UploadProvider');
  });
});
