/**
 * Generates a new element ID.
 * @returns {string} The new element ID.
 */
export const newElementId = () => {
  return `el_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Generates a new tab ID.
 * @returns {string} The new tab ID.
 */
export const newTabId = () => {
  return `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Generates a new asset ID.
 * @returns {string} The new asset ID.
 */
export const newAssetId = () => {
  return `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Generates a new roll ID.
 * @returns {string} The new roll ID.
 */
export const newRollId = () => {
  return `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};
