/**
 * Shared hierarchical folder tree utilities.
 * Handles depth calculations, cycle detection, move validation,
 * tree grouping, path flattening, and sibling name collision resolution.
 */

export const MAX_FOLDER_DEPTH = 5;

/**
 * Calculates the 1-indexed hierarchy depth of a folder.
 * Root-level folders (parentId === null) have depth 1.
 * 
 * @param {string|null} folderId - Target folder ID.
 * @param {Array<{ id: string, parentId?: string|null }>} folders - Folder list.
 * @returns {number} 1-indexed depth (0 if folderId is null or not found).
 */
export function getFolderDepth(folderId, folders) {
  if (!folderId || !Array.isArray(folders)) return 0;

  const folderMap = new Map(folders.map((f) => [f.id, f]));
  let current = folderMap.get(folderId);
  if (!current) return 0;

  let depth = 1;
  const visited = new Set([folderId]);

  while (current && current.parentId) {
    if (visited.has(current.parentId)) {
      // Cycle detected: guard against infinite loop
      break;
    }
    visited.add(current.parentId);
    current = folderMap.get(current.parentId);
    if (current) {
      depth += 1;
    }
  }

  return depth;
}

/**
 * Calculates the maximum downward depth offset of a folder's subtree.
 * Returns 0 if the folder has no child folders, 1 if its deepest child is a direct child, etc.
 * 
 * @param {string} folderId - Target folder ID.
 * @param {Array<{ id: string, parentId?: string|null }>} folders - Folder list.
 * @returns {number} Maximum subtree depth offset.
 */
export function getMaxSubtreeDepthOffset(folderId, folders) {
  if (!folderId || !Array.isArray(folders)) return 0;

  const childrenMap = new Map();
  folders.forEach((f) => {
    const pId = f.parentId || null;
    if (!childrenMap.has(pId)) childrenMap.set(pId, []);
    childrenMap.get(pId).push(f.id);
  });

  const visited = new Set();
  const getOffset = (id) => {
    if (visited.has(id)) return 0;
    visited.add(id);

    const children = childrenMap.get(id) || [];
    if (children.length === 0) return 0;

    let maxChildOffset = 0;
    for (const childId of children) {
      const offset = 1 + getOffset(childId);
      if (offset > maxChildOffset) {
        maxChildOffset = offset;
      }
    }
    return maxChildOffset;
  };

  return getOffset(folderId);
}

/**
 * Checks whether candidateId is equal to targetAncestorId or is a descendant of targetAncestorId.
 * 
 * @param {string|null} candidateId - The ID to check.
 * @param {string} targetAncestorId - The ancestor candidate ID.
 * @param {Array<{ id: string, parentId?: string|null }>} folders - Folder list.
 * @returns {boolean} True if candidateId is inside targetAncestorId's subtree or is targetAncestorId.
 */
export function isDescendantFolder(candidateId, targetAncestorId, folders) {
  if (!candidateId || !targetAncestorId) return false;
  if (candidateId === targetAncestorId) return true;
  if (!Array.isArray(folders)) return false;

  const folderMap = new Map(folders.map((f) => [f.id, f]));
  let current = folderMap.get(candidateId);
  const visited = new Set();

  while (current && current.parentId) {
    if (visited.has(current.id)) break;
    visited.add(current.id);

    if (current.parentId === targetAncestorId) {
      return true;
    }
    current = folderMap.get(current.parentId);
  }

  return false;
}

/**
 * Retrieves ordered list of ancestor folder IDs from root down to folderId's parent.
 * 
 * @param {string|null} folderId - Target folder ID.
 * @param {Array<{ id: string, parentId?: string|null }>} folders - Folder list.
 * @returns {string[]} Array of ancestor folder IDs.
 */
export function getAncestorFolderIds(folderId, folders) {
  if (!folderId || !Array.isArray(folders)) return [];

  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const ancestors = [];
  let current = folderMap.get(folderId);
  const visited = new Set();

  while (current && current.parentId) {
    if (visited.has(current.parentId)) break;
    visited.add(current.parentId);

    const parent = folderMap.get(current.parentId);
    if (parent) {
      ancestors.unshift(parent.id);
      current = parent;
    } else {
      break;
    }
  }

  return ancestors;
}

/**
 * Retrieves all descendant folder IDs inside a folder's subtree.
 * 
 * @param {string} folderId - Target folder ID.
 * @param {Array<{ id: string, parentId?: string|null }>} folders - Folder list.
 * @returns {string[]} Array of descendant folder IDs.
 */
export function getDescendantFolderIds(folderId, folders) {
  if (!folderId || !Array.isArray(folders)) return [];

  const childrenMap = new Map();
  folders.forEach((f) => {
    const pId = f.parentId || null;
    if (!childrenMap.has(pId)) childrenMap.set(pId, []);
    childrenMap.get(pId).push(f.id);
  });

  const result = [];
  const queue = [...(childrenMap.get(folderId) || [])];
  const visited = new Set();

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!visited.has(currentId)) {
      visited.add(currentId);
      result.push(currentId);
      const subChildren = childrenMap.get(currentId) || [];
      queue.push(...subChildren);
    }
  }

  return result;
}

/**
 * Resolves a unique sibling name under targetParentId by appending " (1)", " (2)", etc. if a conflict exists.
 * 
 * @param {string} baseName - Desired folder name.
 * @param {string|null} targetParentId - Target parent folder ID (null for root).
 * @param {Array<{ id: string, name: string, parentId?: string|null }>} folders - Folder list.
 * @param {string|null} [excludeFolderId=null] - Optional folder ID to exclude from collision check (e.g. self).
 * @returns {string} Unique sibling folder name.
 */
export function resolveUniqueSiblingName(baseName, targetParentId, folders, excludeFolderId = null) {
  const cleanBase = (baseName || 'Folder').trim();
  const safeParentId = targetParentId || null;

  const existingSiblingNames = new Set(
    (folders || [])
      .filter((f) => f.id !== excludeFolderId && (f.parentId || null) === safeParentId)
      .map((f) => f.name.toLowerCase().trim())
  );

  if (!existingSiblingNames.has(cleanBase.toLowerCase())) {
    return cleanBase;
  }

  let counter = 1;
  let candidate = `${cleanBase} (${counter})`;
  while (existingSiblingNames.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `${cleanBase} (${counter})`;
  }

  return candidate;
}

/**
 * Validates whether a folder can be moved to targetParentId.
 * 
 * @param {string} folderId - ID of folder to move.
 * @param {string|null} targetParentId - Target parent folder ID (null for root).
 * @param {Array<{ id: string, name: string, parentId?: string|null }>} folders - Folder list.
 * @returns {{ valid: boolean, error?: string }} Validation result.
 */
export function canMoveFolder(folderId, targetParentId, folders) {
  if (!folderId) return { valid: false, error: 'Folder ID is required.' };
  if (!Array.isArray(folders)) return { valid: false, error: 'Folders must be an array.' };

  const currentFolder = folders.find((f) => f.id === folderId);
  if (!currentFolder) return { valid: false, error: 'Folder not found.' };

  const safeTargetParentId = targetParentId || null;
  const currentParentId = currentFolder.parentId || null;

  if (safeTargetParentId === currentParentId) {
    return { valid: false, error: 'Folder is already in this location.' };
  }

  if (safeTargetParentId === folderId) {
    return { valid: false, error: 'Cannot move a folder into itself.' };
  }

  if (safeTargetParentId !== null) {
    const targetFolder = folders.find((f) => f.id === safeTargetParentId);
    if (!targetFolder) {
      return { valid: false, error: 'Target parent folder not found.' };
    }

    if (isDescendantFolder(safeTargetParentId, folderId, folders)) {
      return { valid: false, error: 'Cannot move a folder into one of its own subfolders.' };
    }

    const targetDepth = getFolderDepth(safeTargetParentId, folders);
    const subtreeHeight = getMaxSubtreeDepthOffset(folderId, folders);

    if (targetDepth + 1 + subtreeHeight > MAX_FOLDER_DEPTH) {
      return {
        valid: false,
        error: `Exceeds maximum folder nesting limit of ${MAX_FOLDER_DEPTH} levels.`
      };
    }
  } else {
    // Moving to root: depth becomes 1 + subtreeHeight
    const subtreeHeight = getMaxSubtreeDepthOffset(folderId, folders);
    if (1 + subtreeHeight > MAX_FOLDER_DEPTH) {
      return {
        valid: false,
        error: `Exceeds maximum folder nesting limit of ${MAX_FOLDER_DEPTH} levels.`
      };
    }
  }

  // Check sibling name conflict
  const siblingConflict = folders.some(
    (f) =>
      f.id !== folderId &&
      (f.parentId || null) === safeTargetParentId &&
      f.name.toLowerCase().trim() === currentFolder.name.toLowerCase().trim()
  );

  if (siblingConflict) {
    return {
      valid: false,
      error: 'A folder with that name already exists in the destination folder.'
    };
  }

  return { valid: true };
}

/**
 * Builds a hierarchical tree from a flat list of folders.
 * 
 * @param {Array<{ id: string, name: string, parentId?: string|null }>} folders - Folder list.
 * @returns {Array<Object>} Root tree nodes with children arrays.
 */
export function buildFolderTree(folders) {
  if (!Array.isArray(folders) || folders.length === 0) return [];

  const folderMap = new Map();
  const childrenMap = new Map();

  folders.forEach((f) => {
    folderMap.set(f.id, {
      ...f,
      parentId: f.parentId || null,
      children: []
    });
  });

  const roots = [];

  folderMap.forEach((node) => {
    if (node.parentId && folderMap.has(node.parentId)) {
      if (!childrenMap.has(node.parentId)) {
        childrenMap.set(node.parentId, []);
      }
      childrenMap.get(node.parentId).push(node);
    } else {
      // Root or orphaned parent references become top-level
      roots.push(node);
    }
  });

  const attachChildren = (node, depth, path) => {
    node.depth = depth;
    node.pathLabel = path ? `${path} / ${node.name}` : node.name;
    const children = childrenMap.get(node.id) || [];
    children.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    node.children = children;
    children.forEach((child) => attachChildren(child, depth + 1, node.pathLabel));
  };

  roots.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  roots.forEach((root) => attachChildren(root, 1, ''));

  return roots;
}

/**
 * Flattens the folder tree into a depth-first list suitable for <select> options.
 * 
 * @param {Array<{ id: string, name: string, parentId?: string|null }>} folders - Folder list.
 * @returns {Array<{ id: string, name: string, parentId: string|null, depth: number, pathLabel: string, indentPrefix: string }>} Flattened list.
 */
export function flattenFolderTree(folders) {
  const tree = buildFolderTree(folders);
  const result = [];

  const traverse = (node) => {
    const indentPrefix = node.depth > 1 ? `${'  '.repeat(node.depth - 2)}↳ ` : '';
    result.push({
      id: node.id,
      name: node.name,
      parentId: node.parentId,
      depth: node.depth,
      pathLabel: node.pathLabel,
      indentPrefix
    });
    if (Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  };

  tree.forEach(traverse);
  return result;
}

/**
 * Collects all asset IDs belonging directly to folderId or any of its descendant folders.
 * 
 * @param {string} folderId - Target folder ID.
 * @param {Array<{ id: string, parentId?: string|null }>} folders - Folder list.
 * @param {Array<{ id: string, folderId?: string|null }>} assets - Asset list.
 * @returns {string[]} Matching asset IDs.
 */
export function getSubtreeAssetIds(folderId, folders, assets) {
  if (!folderId || !Array.isArray(assets)) return [];

  const targetFolderIds = new Set([folderId, ...getDescendantFolderIds(folderId, folders)]);
  return assets
    .filter((a) => a.folderId && targetFolderIds.has(a.folderId))
    .map((a) => a.id);
}
