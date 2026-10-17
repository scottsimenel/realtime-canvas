import { describe, expect, test } from 'vitest';
import {
  MAX_FOLDER_DEPTH,
  getFolderDepth,
  getMaxSubtreeDepthOffset,
  isDescendantFolder,
  getAncestorFolderIds,
  getDescendantFolderIds,
  resolveUniqueSiblingName,
  canMoveFolder,
  buildFolderTree,
  flattenFolderTree,
  getSubtreeAssetIds
} from '../folderTree.js';

describe('folderTree pure math & hierarchy tests', () => {
  const sampleFolders = [
    { id: 'f-root-1', name: 'Campaign', parentId: null },
    { id: 'f-sub-1', name: 'Act 1', parentId: 'f-root-1' },
    { id: 'f-sub-2', name: 'Dungeon', parentId: 'f-sub-1' },
    { id: 'f-sub-3', name: 'Boss Room', parentId: 'f-sub-2' },
    { id: 'f-root-2', name: 'Characters', parentId: null }
  ];

  test('MAX_FOLDER_DEPTH is 5', () => {
    expect(MAX_FOLDER_DEPTH).toBe(5);
  });

  test('getFolderDepth calculates 1-indexed hierarchy depths correctly', () => {
    expect(getFolderDepth(null, sampleFolders)).toBe(0);
    expect(getFolderDepth('f-root-1', sampleFolders)).toBe(1);
    expect(getFolderDepth('f-sub-1', sampleFolders)).toBe(2);
    expect(getFolderDepth('f-sub-2', sampleFolders)).toBe(3);
    expect(getFolderDepth('f-sub-3', sampleFolders)).toBe(4);
    expect(getFolderDepth('nonexistent', sampleFolders)).toBe(0);

    // Guard against circular parent references
    const circularFolders = [
      { id: 'a', name: 'A', parentId: 'b' },
      { id: 'b', name: 'B', parentId: 'a' }
    ];
    expect(getFolderDepth('a', circularFolders)).toBeGreaterThanOrEqual(1);
  });

  test('getMaxSubtreeDepthOffset calculates depth offset under a folder', () => {
    expect(getMaxSubtreeDepthOffset('f-sub-3', sampleFolders)).toBe(0);
    expect(getMaxSubtreeDepthOffset('f-sub-2', sampleFolders)).toBe(1);
    expect(getMaxSubtreeDepthOffset('f-sub-1', sampleFolders)).toBe(2);
    expect(getMaxSubtreeDepthOffset('f-root-1', sampleFolders)).toBe(3);
    expect(getMaxSubtreeDepthOffset('f-root-2', sampleFolders)).toBe(0);
  });

  test('isDescendantFolder detects self and child lineage', () => {
    expect(isDescendantFolder('f-root-1', 'f-root-1', sampleFolders)).toBe(true);
    expect(isDescendantFolder('f-sub-3', 'f-root-1', sampleFolders)).toBe(true);
    expect(isDescendantFolder('f-sub-3', 'f-sub-2', sampleFolders)).toBe(true);
    expect(isDescendantFolder('f-root-1', 'f-sub-3', sampleFolders)).toBe(false);
    expect(isDescendantFolder('f-root-2', 'f-root-1', sampleFolders)).toBe(false);
  });

  test('getAncestorFolderIds returns top-down ancestors', () => {
    expect(getAncestorFolderIds('f-sub-3', sampleFolders)).toEqual(['f-root-1', 'f-sub-1', 'f-sub-2']);
    expect(getAncestorFolderIds('f-root-1', sampleFolders)).toEqual([]);
    expect(getAncestorFolderIds(null, sampleFolders)).toEqual([]);
  });

  test('getDescendantFolderIds returns all sub-children recursively', () => {
    const descendants = getDescendantFolderIds('f-root-1', sampleFolders);
    expect(descendants).toContain('f-sub-1');
    expect(descendants).toContain('f-sub-2');
    expect(descendants).toContain('f-sub-3');
    expect(descendants).not.toContain('f-root-2');
    expect(getDescendantFolderIds('f-sub-3', sampleFolders)).toEqual([]);
  });

  test('resolveUniqueSiblingName avoids duplicate names upon folder creation or promotion', () => {
    const folders = [
      { id: 'f1', name: 'Maps', parentId: null },
      { id: 'f2', name: 'Tokens', parentId: null },
      { id: 'f3', name: 'Maps (1)', parentId: null },
      { id: 'f4', name: 'Maps', parentId: 'sub-parent' } // Sibling in different parent
    ];

    // Non-conflicting name returns clean base name
    expect(resolveUniqueSiblingName('Handouts', null, folders)).toBe('Handouts');

    // Conflicting name at root auto-increments past Maps (1)
    expect(resolveUniqueSiblingName('Maps', null, folders)).toBe('Maps (2)');

    // Different parent allows "Maps" without suffix because no sibling has it under 'sub-parent-2'
    expect(resolveUniqueSiblingName('Maps', 'sub-parent-2', folders)).toBe('Maps');

    // Self exclusion when renaming or promoting without changing parent
    expect(resolveUniqueSiblingName('Maps', null, folders, 'f1')).toBe('Maps');
  });

  test('canMoveFolder validates move targets, cycles, and max depth 5', () => {
    // 1. Valid move
    const valid = canMoveFolder('f-root-2', 'f-root-1', sampleFolders);
    expect(valid.valid).toBe(true);

    // 2. No-op move to same parent
    const same = canMoveFolder('f-sub-1', 'f-root-1', sampleFolders);
    expect(same.valid).toBe(false);
    expect(same.error).toContain('already in this location');

    // 3. Move into itself
    const self = canMoveFolder('f-root-1', 'f-root-1', sampleFolders);
    expect(self.valid).toBe(false);

    // 4. Move into descendant (cycle prevention)
    const cycle = canMoveFolder('f-root-1', 'f-sub-2', sampleFolders);
    expect(cycle.valid).toBe(false);
    expect(cycle.error).toContain('own subfolders');

    // 5. Exceeding MAX_FOLDER_DEPTH (5)
    // f-root-1 subtree has depth 4 (root -> sub1 -> sub2 -> sub3)
    // If we have a folder at depth 2 (e.g. f-sub-1), and try to move f-root-1 under it:
    // target depth 2 + 1 + subtree height 3 = 6 > 5!
    const deepMove = canMoveFolder('f-root-1', 'f-root-2', sampleFolders);
    // target depth 1 + 1 + 3 = 5 (allowed)
    expect(deepMove.valid).toBe(true);

    const extraDeepFolders = [
      ...sampleFolders,
      { id: 'f-branch-1', name: 'Branch 1', parentId: null },
      { id: 'f-branch-2', name: 'Branch 2', parentId: 'f-branch-1' },
      { id: 'f-branch-3', name: 'Branch 3', parentId: 'f-branch-2' },
      { id: 'f-branch-4', name: 'Branch 4', parentId: 'f-branch-3' } // Depth 4
    ];
    // Trying to move f-sub-1 (subtree height 2) under f-branch-4 (depth 4) would be 4 + 1 + 2 = 7 > 5
    const tooDeep = canMoveFolder('f-sub-1', 'f-branch-4', extraDeepFolders);
    expect(tooDeep.valid).toBe(false);
    expect(tooDeep.error).toContain('Exceeds maximum folder nesting limit');

    // 6. Sibling duplicate name conflict
    const conflictFolders = [
      { id: 'f-a', name: 'Town', parentId: null },
      { id: 'f-b', name: 'Castle', parentId: null },
      { id: 'f-c', name: 'Town', parentId: 'f-b' }
    ];
    // Moving f-c to root should fail because root already has "Town"
    const nameConflict = canMoveFolder('f-c', null, conflictFolders);
    expect(nameConflict.valid).toBe(false);
    expect(nameConflict.error).toContain('already exists in the destination');
  });

  test('buildFolderTree and flattenFolderTree create structured hierarchy and indented paths', () => {
    const tree = buildFolderTree(sampleFolders);
    expect(tree.length).toBe(2); // Campaign and Characters at root

    const campaign = tree.find((t) => t.id === 'f-root-1');
    expect(campaign).toBeDefined();
    expect(campaign.depth).toBe(1);
    expect(campaign.children.length).toBe(1);
    expect(campaign.children[0].id).toBe('f-sub-1');
    expect(campaign.children[0].depth).toBe(2);

    const flat = flattenFolderTree(sampleFolders);
    expect(flat.length).toBe(5);

    const bossRoom = flat.find((f) => f.id === 'f-sub-3');
    expect(bossRoom).toBeDefined();
    expect(bossRoom.depth).toBe(4);
    expect(bossRoom.pathLabel).toBe('Campaign / Act 1 / Dungeon / Boss Room');
    expect(bossRoom.indentPrefix).toBe('    ↳ ');
  });

  test('getSubtreeAssetIds collects assets across all subfolders', () => {
    const assets = [
      { id: 'a1', folderId: 'f-sub-3' },
      { id: 'a2', folderId: 'f-sub-2' },
      { id: 'a3', folderId: 'f-root-1' },
      { id: 'a4', folderId: 'f-root-2' },
      { id: 'a5', folderId: null }
    ];

    const root1Assets = getSubtreeAssetIds('f-root-1', sampleFolders, assets);
    expect(root1Assets).toEqual(['a1', 'a2', 'a3']);

    const sub2Assets = getSubtreeAssetIds('f-sub-2', sampleFolders, assets);
    expect(sub2Assets).toEqual(['a1', 'a2']);

    const root2Assets = getSubtreeAssetIds('f-root-2', sampleFolders, assets);
    expect(root2Assets).toEqual(['a4']);
  });
});
