import { describe, expect, test } from 'vitest';
import { locksArrayToMap } from '../locks.js';

describe('locksArrayToMap', () => {
  test('returns empty object if input is falsy or empty', () => {
    expect(locksArrayToMap(null)).toEqual({});
    expect(locksArrayToMap(undefined)).toEqual({});
    expect(locksArrayToMap([])).toEqual({});
  });

  test('converts a list of entries to a key-value object', () => {
    const input = [
      ['el_1', 'user_a'],
      ['el_2', 'user_b']
    ];
    expect(locksArrayToMap(input)).toEqual({
      el_1: 'user_a',
      el_2: 'user_b'
    });
  });
});
