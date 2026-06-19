import { describe, expect, test } from 'vitest';
import { mergeElement } from '../mergeElement.js';

describe('mergeElement', () => {
  test('handles null/undefined inputs', () => {
    expect(mergeElement(null, { x: 10 })).toEqual({ x: 10 });
    expect(mergeElement({ id: '1' }, null)).toEqual({ id: '1' });
  });

  test('performs shallow merge on base fields', () => {
    const el = { id: 'el_1', x: 10, y: 20 };
    const updates = { x: 15, width: 100 };
    const result = mergeElement(el, updates);
    expect(result).toEqual({ id: 'el_1', x: 15, y: 20, width: 100, properties: {} });
  });

  test('performs shallow merge on properties object', () => {
    const el = {
      id: 'el_1',
      properties: { fill: 'red', stroke: 'blue' }
    };
    const updates = {
      properties: { fill: 'green', opacity: 0.5 }
    };
    const result = mergeElement(el, updates);
    expect(result).toEqual({
      id: 'el_1',
      properties: { fill: 'green', stroke: 'blue', opacity: 0.5 }
    });
  });

  test('does not mutate the original objects', () => {
    const el = { id: 'el_1', properties: { fill: 'red' } };
    const updates = { properties: { fill: 'blue' } };
    const result = mergeElement(el, updates);

    expect(result).not.toBe(el);
    expect(result.properties).not.toBe(el.properties);
    expect(el.properties.fill).toBe('red');
  });
});
