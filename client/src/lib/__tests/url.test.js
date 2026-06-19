import { describe, expect, test } from 'vitest';
import { getFullUrl } from '../url.js';

describe('getFullUrl', () => {
  test('returns empty string if url is falsy', () => {
    expect(getFullUrl('')).toBe('');
    expect(getFullUrl(null)).toBe('');
    expect(getFullUrl(undefined)).toBe('');
  });

  test('returns the url unchanged if it starts with http, https, or data:', () => {
    expect(getFullUrl('http://example.com/img.png')).toBe('http://example.com/img.png');
    expect(getFullUrl('https://example.com/img.png')).toBe('https://example.com/img.png');
    expect(getFullUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  test('resolves local relative paths against SOCKET_URL', () => {
    expect(getFullUrl('/uploads/img.png')).toContain('/uploads/img.png');
    expect(getFullUrl('uploads/img.png')).toContain('/uploads/img.png');
  });
});
