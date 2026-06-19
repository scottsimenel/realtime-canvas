import { describe, expect, test } from 'vitest';
import {
  getLocalCoords,
  getHandleAtCoords,
  checkEraserIntersectsPath,
  splitPathElement,
  getElementAtCoords,
  getHoveredElement,
  getGroupBoundingBox,
  getGroupHandleAtCoords,
  checkElementIntersectsBox
} from '../CanvasSelection.js';

describe('CanvasSelection math', () => {
  const element = {
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    properties: {
      rotation: Math.PI / 2 // Rotated 90 degrees
    }
  };

  test('getLocalCoords translates client coordinates into rotated local coords', () => {
    // Center is (200, 150)
    const local = getLocalCoords(250, 150, element);
    expect(local.x).toBeCloseTo(0, 5);
    expect(local.y).toBeCloseTo(-50, 5);
  });

  test('getHandleAtCoords identifies drag handles correctly', () => {
    const el = { x: 100, y: 100, width: 200, height: 100, properties: { rotation: 0 } };
    expect(getHandleAtCoords(96, 96, el, 1)).toBe('nw');
    expect(getHandleAtCoords(304, 96, el, 1)).toBe('ne');
    expect(getHandleAtCoords(304, 204, el, 1)).toBe('se');
    expect(getHandleAtCoords(96, 204, el, 1)).toBe('sw');
    expect(getHandleAtCoords(200, 76, el, 1)).toBe('rotate');
  });

  test('checkEraserIntersectsPath returns true if eraser circle overlaps with path segment', () => {
    const pathEl = {
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      properties: {
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 }
        ],
        strokeWidth: 4,
        rotation: 0
      }
    };
    expect(checkEraserIntersectsPath(150, 150, 10, pathEl)).toBe(true);
    expect(checkEraserIntersectsPath(0, 0, 10, pathEl)).toBe(false);
  });

  test('splitPathElement splits path at eraser points correctly', () => {
    const pathEl = {
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      properties: {
        points: [
          { x: 0, y: 0.5 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 0.5 }
        ],
        stroke: '#000000',
        strokeWidth: 4,
        rotation: 0
      }
    };
    const result = splitPathElement(150, 150, 10, pathEl);
    expect(result.length).toBe(0);
  });

  test('getElementAtCoords hits correct shapes', () => {
    const elements = [
      { id: '1', type: 'rectangle', x: 100, y: 100, width: 50, height: 50 },
      { id: '2', type: 'circle', x: 200, y: 200, width: 50, height: 50 },
      { id: '3', type: 'triangle', x: 300, y: 300, width: 50, height: 50 },
      { id: '4', type: 'hexagon', x: 400, y: 400, width: 50, height: 50 }
    ];

    expect(getElementAtCoords(120, 120, elements).id).toBe('1');
    expect(getElementAtCoords(220, 220, elements).id).toBe('2');
    expect(getElementAtCoords(325, 330, elements).id).toBe('3');
    expect(getElementAtCoords(425, 425, elements).id).toBe('4');
    expect(getElementAtCoords(300, 200, elements)).toBeNull();
  });

  test('getHoveredElement finds correct shape under cursor', () => {
    const elements = [
      { id: '1', type: 'rectangle', x: 100, y: 100, width: 50, height: 50 },
      { id: '2', type: 'circle', x: 200, y: 200, width: 50, height: 50 },
      { id: '3', type: 'triangle', x: 300, y: 300, width: 50, height: 50 },
      { id: '4', type: 'hexagon', x: 400, y: 400, width: 50, height: 50 },
      { id: '5', type: 'star', x: 500, y: 500, width: 50, height: 50 }
    ];

    expect(getHoveredElement(120, 120, elements).id).toBe('1');
    expect(getHoveredElement(220, 220, elements).id).toBe('2');
    expect(getHoveredElement(325, 330, elements).id).toBe('3');
    expect(getHoveredElement(425, 425, elements).id).toBe('4');
    expect(getHoveredElement(525, 525, elements).id).toBe('5');
    expect(getHoveredElement(0, 0, elements)).toBeNull();
  });

  test('getGroupBoundingBox calculates aggregate bounding box', () => {
    const elements = [
      { id: '1', type: 'rectangle', x: 100, y: 100, width: 50, height: 50 },
      { id: '2', type: 'rectangle', x: 200, y: 200, width: 50, height: 50 }
    ];

    const bbox = getGroupBoundingBox(['1', '2'], elements);
    expect(bbox.x).toBe(100);
    expect(bbox.y).toBe(100);
    expect(bbox.width).toBe(150); // From 100 to 250
    expect(bbox.height).toBe(150); // From 100 to 250

    expect(getGroupBoundingBox([], elements)).toBeNull();
  });

  test('getGroupHandleAtCoords identifies group handles', () => {
    const bbox = { x: 100, y: 100, width: 100, height: 100, cx: 150, cy: 150 };
    expect(getGroupHandleAtCoords(96, 96, bbox, 1)).toBe('nw');
    expect(getGroupHandleAtCoords(204, 96, bbox, 1)).toBe('ne');
    expect(getGroupHandleAtCoords(204, 204, bbox, 1)).toBe('se');
    expect(getGroupHandleAtCoords(96, 204, bbox, 1)).toBe('sw');
    expect(getGroupHandleAtCoords(150, 76, bbox, 1)).toBe('rotate');
    expect(getGroupHandleAtCoords(150, 150, bbox, 1)).toBeNull();
    expect(getGroupHandleAtCoords(0, 0, null, 1)).toBeNull();
  });

  test('checkElementIntersectsBox checks overlaps', () => {
    const el = { x: 100, y: 100, width: 50, height: 50, properties: { rotation: 0 } };
    
    // Completely inside
    expect(checkElementIntersectsBox(el, 50, 200, 50, 200)).toBe(true);
    // Completely outside
    expect(checkElementIntersectsBox(el, 0, 10, 0, 10)).toBe(false);
  });
});
