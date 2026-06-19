import { SOCKET_URL } from './socket.js';

/**
 * Returns the full absolute URL for a local path or asset, or returns the URL as is if already absolute.
 * @param {string} url - The URL or path to resolve.
 * @returns {string} The full absolute URL.
 */
export const getFullUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${SOCKET_URL}${path}`;
};
