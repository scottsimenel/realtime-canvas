/**
 * Converts a lock entries array [[eId, uId], ...] into an object mapping element ID to lock holder ID.
 * @param {Array<[string, string]>} locksArray - Array of lock entries.
 * @returns {Record<string, string>} Object mapping element ID to user ID.
 */
export const locksArrayToMap = (locksArray) => {
  const lockMap = {};
  (locksArray || []).forEach(([eId, uId]) => {
    lockMap[eId] = uId;
  });
  return lockMap;
};
