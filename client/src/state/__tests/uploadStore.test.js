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
      } else if (event === 'folder-move') {
        callback({ success: true, folder: { id: data.folderId, parentId: data.parentId } });
      } else if (event === 'folder-delete') {
        callback({ success: true, fallbackParentId: null, promotedFolders: [] });
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

// Import target store providers
import { UploadProvider, useUploadStore } from '../uploadStore.js';

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

    // Test currentRoomId initial value and setter
    expect(store.currentRoomId).toBe('canvas-default');
    store.setCurrentRoomId('room-dungeon-99');
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.currentRoomId).toBe('room-dungeon-99');
  });

  test('Folder management actions: create, rename, delete, move', () => {
    UploadProvider({ children: null });
    let store = reactMockValueCapture.captured;

    // 1. Create Root Folder
    store.handleCreateFolder('Dungeon');
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'folder-create',
      expect.objectContaining({ folder: expect.objectContaining({ name: 'Dungeon', parentId: null }) }),
      expect.any(Function)
    );

    // Verify root folder was added to state
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.folders.length).toBe(1);
    expect(store.folders[0].name).toBe('Dungeon');
    const dungeonFolderId = store.folders[0].id;

    // 2. Create Nested Subfolder inside Dungeon
    store.handleCreateFolder('Traps', dungeonFolderId);
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.folders.length).toBe(2);
    const trapsFolder = store.folders.find((f) => f.name === 'Traps');
    expect(trapsFolder).toBeDefined();
    expect(trapsFolder.parentId).toBe(dungeonFolderId);
    const trapsFolderId = trapsFolder.id;

    // 3. Rename Folder
    store.handleRenameFolder(trapsFolderId, 'Deadly Traps');
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'folder-rename',
      expect.objectContaining({ folderId: trapsFolderId, name: 'Deadly Traps' }),
      expect.any(Function)
    );

    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.folders.find((f) => f.id === trapsFolderId).name).toBe('Deadly Traps');

    // 4. Move Folder (move Deadly Traps to root)
    store.handleMoveFolder(trapsFolderId, null);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'folder-move',
      expect.objectContaining({ folderId: trapsFolderId, parentId: null }),
      expect.any(Function)
    );

    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.folders.find((f) => f.id === trapsFolderId).parentId).toBeNull();

    // 5. Move Asset to Folder
    store.setAssets([{ id: 'asset_x', name: 'Asset X', url: '/uploads/x.png', folderId: null }]);
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;

    store.handleMoveAsset('asset_x', trapsFolderId);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'asset-move',
      expect.objectContaining({ assetId: 'asset_x', folderId: trapsFolderId }),
      expect.any(Function)
    );

    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.assets[0].folderId).toBe(trapsFolderId);

    // 6. Delete Folder: non-cascading promotion of child assets
    store.handleDeleteFolder(trapsFolderId);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'folder-delete',
      expect.objectContaining({ folderId: trapsFolderId }),
      expect.any(Function)
    );

    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.folders.some((f) => f.id === trapsFolderId)).toBe(false);
    expect(store.assets[0].folderId).toBeNull();
  });

  test('Folder duplicate prevention, sibling-scoping, and promotion collision resolution', () => {
    UploadProvider({ children: null });
    let store = reactMockValueCapture.captured;

    // 1. Create root folder "Dungeons"
    store.handleCreateFolder('Dungeons');
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    const dungeonId = store.folders[0].id;

    // 2. Duplicate root folder check (case-insensitive)
    store.handleCreateFolder('dungeons');
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.uploadError).toBe('A folder with that name already exists in this folder.');
    expect(store.folders.length).toBe(1);

    // 3. Sibling-scoped uniqueness allows same name in different branch
    store.handleCreateFolder('Dungeons', dungeonId);
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.folders.length).toBe(2);
    const subDungeon = store.folders.find((f) => f.parentId === dungeonId);
    expect(subDungeon.name).toBe('Dungeons');

    // 4. Test non-cascading delete with promotion collision resolution:
    // Deleting root folder "Dungeons" promotes subfolder "Dungeons" to root (null).
    // Because another root folder "Dungeons" was just deleted, but wait!
    // If we have another root folder named "Maps" and a subfolder inside Dungeon also named "Maps":
    store.handleCreateFolder('Maps', null);
    store.handleCreateFolder('Maps', dungeonId);
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;

    // Now delete "Dungeons" (which has child "Maps"). Target parent is root (null),
    // which already has a sibling "Maps".
    store.handleDeleteFolder(dungeonId);
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;

    // Promoted "Maps" subfolder must have been renamed to "Maps (1)" to avoid collision!
    const folderNames = store.folders.map((f) => f.name);
    expect(folderNames).toContain('Maps');
    expect(folderNames).toContain('Maps (1)');
  });

  test('Search matching by deep ancestor folder name', () => {
    UploadProvider({ children: null });
    let store = reactMockValueCapture.captured;

    // Build hierarchy: Kingdom -> Dungeon -> Catacombs
    store.setFolders([
      { id: 'f_kingdom', name: 'Kingdom', parentId: null },
      { id: 'f_dungeon', name: 'Dungeon', parentId: 'f_kingdom' },
      { id: 'f_catacombs', name: 'Catacombs', parentId: 'f_dungeon' }
    ]);
    store.setAssets([
      { id: 'asset_deep', name: 'Skeleton King', url: '/uploads/sk.png', folderId: 'f_catacombs' },
      { id: 'asset_unrelated', name: 'Forest Trees', url: '/uploads/f1.png', folderId: null }
    ]);

    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;

    // Search query matches ancestor "Kingdom"
    store.setSearchQuery('kingdom');
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;

    // Asset in Catacombs should match because Kingdom is an ancestor!
    const matchedNames = store.visibleAssets.map(a => a.name);
    expect(matchedNames).toContain('Skeleton King');
    expect(matchedNames).not.toContain('Forest Trees');
  });

  test('Cycle prevention and depth limit validation', () => {
    UploadProvider({ children: null });
    let store = reactMockValueCapture.captured;

    // Chain 5 levels of folders: L1 -> L2 -> L3 -> L4 -> L5
    store.setFolders([
      { id: 'l1', name: 'Level 1', parentId: null },
      { id: 'l2', name: 'Level 2', parentId: 'l1' },
      { id: 'l3', name: 'Level 3', parentId: 'l2' },
      { id: 'l4', name: 'Level 4', parentId: 'l3' },
      { id: 'l5', name: 'Level 5', parentId: 'l4' }
    ]);
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;

    // 1. Attempt to add a 6th level folder inside L5
    store.handleCreateFolder('Level 6', 'l5');
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.uploadError).toBe('Maximum folder nesting limit of 5 levels reached.');

    // 2. Attempt to move an ancestor into its own descendant (cycle prevention)
    store.handleMoveFolder('l1', 'l3');
    stateIndex = 0;
    UploadProvider({ children: null });
    store = reactMockValueCapture.captured;
    expect(store.uploadError).toBe('Cannot move a folder into one of its own subfolders.');
  });

  test('useUploadStore throws error outside provider', () => {
    reactMockValueCapture.captured = null;
    expect(() => useUploadStore()).toThrowError('useUploadStore must be used within an UploadProvider');
  });
});
