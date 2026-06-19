/**
 * Merges element updates into an existing element, performing a shallow merge
 * on the base fields and a shallow merge on the nested `properties` object.
 * @param {object} el - The original element object.
 * @param {object} updates - The updates object to merge.
 * @returns {object} The merged element object.
 */
export const mergeElement = (el, updates) => {
  if (!el) return updates || {};
  if (!updates) return el;
  return {
    ...el,
    ...updates,
    properties: {
      ...(el.properties || {}),
      ...(updates.properties || {}),
    },
  };
};
