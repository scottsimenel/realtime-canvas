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
  checkElementIntersectsBox,
  calculateFocalZoomPan,
  scalePanOffsetForZoom,
  getPinchTargetElement,
  calculateTokenPinchResize,
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

  test('returns empty array when eraser leaves only sub-2-point fragments', () => {
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

  test('splits a 5-point path into multiple valid sub-paths when erased in the middle', () => {
    const pathEl = {
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      properties: {
        points: [
          { x: 0.0, y: 0.5 },
          { x: 0.2, y: 0.5 },
          { x: 0.5, y: 0.5 },
          { x: 0.8, y: 0.5 },
          { x: 1.0, y: 0.5 }
        ],
        stroke: '#000000',
        strokeWidth: 4,
        rotation: 0
      }
    };
    // Eraser at center (150, 150), radius 5 (0.05 * 100).
    // The middle point (0.5, 0.5) is at local (0,0), which is within radius 5.
    // The other points are at local (-50, 0), (-30, 0), (30, 0), (50, 0), which are outside radius 5.
    // This should result in two chunks: [P0, P1] and [P3, P4].
    const result = splitPathElement(150, 150, 5, pathEl);
    expect(result.length).toBe(2);
    expect(result[0].properties.points.length).toBe(2);
    expect(result[1].properties.points.length).toBe(2);
  });

  test('returns a single element matching the original path if the eraser does not intersect', () => {
    const pathEl = {
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      properties: {
        points: [
          { x: 0.0, y: 0.5 },
          { x: 0.5, y: 0.5 },
          { x: 1.0, y: 0.5 }
        ],
        stroke: '#000000',
        strokeWidth: 4,
        rotation: 0
      }
    };
    // Eraser completely away at (0, 0)
    const result = splitPathElement(0, 0, 5, pathEl);
    expect(result.length).toBe(1);
    expect(result[0].properties.points.length).toBe(3);
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

  test('calculateFocalZoomPan preserves screen position of focal point under zoom', () => {
    const canvasSize = { width: 800, height: 600 };
    const currentPan = { x: 50, y: -30 };
    const currentZoom = 1.0;
    const nextZoom = 2.0;

    // Zooming around screen center (400, 300) should scale the existing pan
    const centerZoomPan = calculateFocalZoomPan(
      currentPan,
      currentZoom,
      nextZoom,
      { x: 400, y: 300 },
      { x: 400, y: 300 },
      canvasSize
    );
    expect(centerZoomPan.x).toBeCloseTo(currentPan.x * 2, 5);
    expect(centerZoomPan.y).toBeCloseTo(currentPan.y * 2, 5);

    // Zooming with focal point at top-left corner (0, 0)
    // At zoom 1.0: virtual offset from center under (0, 0) is (0 - 400 - 50) = -450
    // At zoom 2.0: focal point remains at (0, 0), so (0 - 400) - 2 * (-450) = -400 + 900 = 500
    const cornerZoomPan = calculateFocalZoomPan(
      currentPan,
      currentZoom,
      nextZoom,
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      canvasSize
    );
    expect(cornerZoomPan.x).toBeCloseTo(500, 5);

    // Pinch with midpoint displacement (dx = 20, dy = 10)
    const movingPinchPan = calculateFocalZoomPan(
      { x: 0, y: 0 },
      1.0,
      1.5,
      { x: 200, y: 200 },
      { x: 220, y: 210 },
      canvasSize
    );
    // x: (220 - 400) - 1.5 * (200 - 400 - 0) = -180 - 1.5 * (-200) = -180 + 300 = 120
    // y: (210 - 300) - 1.5 * (200 - 300 - 0) = -90 - 1.5 * (-100) = -90 + 150 = 60
    expect(movingPinchPan.x).toBeCloseTo(120, 5);
    expect(movingPinchPan.y).toBeCloseTo(60, 5);
  });

  test('scalePanOffsetForZoom scales pan proportionally and handles edge cases', () => {
    expect(scalePanOffsetForZoom({ x: 100, y: -50 }, 1.0, 1.2)).toEqual({ x: 120, y: -60 });
    expect(scalePanOffsetForZoom({ x: 100, y: -50 }, 2.0, 1.0)).toEqual({ x: 50, y: -25 });
    // Invalid zoom returns current pan safely
    expect(scalePanOffsetForZoom({ x: 10, y: 20 }, 0, 1.5)).toEqual({ x: 10, y: 20 });
    expect(scalePanOffsetForZoom({ x: 10, y: 20 }, 1.0, 0)).toEqual({ x: 10, y: 20 });
  });

  describe('getPinchTargetElement', () => {
    const el1 = { id: 'el-1', type: 'image', x: 100, y: 100, width: 100, height: 100, properties: { rotation: 0 } };
    const el2 = { id: 'el-2', type: 'image', x: 300, y: 100, width: 100, height: 100, properties: { rotation: 0 } };
    const lockedEl = { id: 'el-3', type: 'image', x: 500, y: 100, width: 100, height: 100, properties: { rotation: 0, locked: true } };
    const elementsList = [el1, el2, lockedEl];

    test('returns target element when both touch points hit the same unlocked element', () => {
      const target = getPinchTargetElement({ x: 120, y: 120 }, { x: 180, y: 180 }, elementsList);
      expect(target).toEqual(el1);
    });

    test('returns null when both touch points hit empty canvas', () => {
      const target = getPinchTargetElement({ x: 10, y: 10 }, { x: 50, y: 50 }, elementsList);
      expect(target).toBeNull();
    });

    test('returns null when one touch point hits an element and the other is outside', () => {
      const target = getPinchTargetElement({ x: 120, y: 120 }, { x: 10, y: 10 }, elementsList);
      expect(target).toBeNull();
    });

    test('returns null when touch points hit two different elements', () => {
      const target = getPinchTargetElement({ x: 120, y: 120 }, { x: 320, y: 120 }, elementsList);
      expect(target).toBeNull();
    });

    test('returns null when element is permanently locked in properties', () => {
      const target = getPinchTargetElement({ x: 520, y: 120 }, { x: 580, y: 180 }, elementsList);
      expect(target).toBeNull();
    });

    test('returns null when element is actively locked by another collaborator', () => {
      const locks = { 'el-1': 'other-user-999' };
      const target = getPinchTargetElement({ x: 120, y: 120 }, { x: 180, y: 180 }, elementsList, locks, 'current-user-123');
      expect(target).toBeNull();
    });

    test('returns element when active lock is held by current user', () => {
      const locks = { 'el-1': 'current-user-123' };
      const target = getPinchTargetElement({ x: 120, y: 120 }, { x: 180, y: 180 }, elementsList, locks, 'current-user-123');
      expect(target).toEqual(el1);
    });

    test('returns null for missing arguments or empty elements', () => {
      expect(getPinchTargetElement(null, { x: 10, y: 10 }, elementsList)).toBeNull();
      expect(getPinchTargetElement({ x: 10, y: 10 }, null, elementsList)).toBeNull();
      expect(getPinchTargetElement({ x: 10, y: 10 }, { x: 10, y: 10 }, [])).toBeNull();
    });
  });

  describe('calculateTokenPinchResize', () => {
    const token = {
      id: 'token-1',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      initialCx: 150,
      initialCy: 150,
      aspectRatio: 1,
      type: 'image',
    };

    test('scales token up when currentDistance > startDistance', () => {
      const result = calculateTokenPinchResize(
        token,
        100, // start distance
        150, // current distance (1.5x)
        { x: 150, y: 150 },
        { x: 150, y: 150 }
      );
      expect(result.width).toBe(150);
      expect(result.height).toBe(150);
      expect(result.scaleFactor).toBe(1.5);
      // Center remains (150, 150) -> x = 150 - 75 = 75, y = 150 - 75 = 75
      expect(result.x).toBe(75);
      expect(result.y).toBe(75);
    });

    test('scales token down when currentDistance < startDistance', () => {
      const result = calculateTokenPinchResize(
        token,
        200, // start distance
        100, // current distance (0.5x)
        { x: 150, y: 150 },
        { x: 150, y: 150 }
      );
      expect(result.width).toBe(50);
      expect(result.height).toBe(50);
      expect(result.scaleFactor).toBe(0.5);
      expect(result.x).toBe(125);
      expect(result.y).toBe(125);
    });

    test('translates token center along with touch midpoint delta', () => {
      const result = calculateTokenPinchResize(
        token,
        100,
        100, // 1x scale
        { x: 150, y: 150 }, // start midpoint
        { x: 170, y: 180 }  // moved +20 in x, +30 in y
      );
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
      // New center = (150+20, 150+30) = (170, 180) -> x = 170 - 50 = 120, y = 180 - 50 = 130
      expect(result.x).toBe(120);
      expect(result.y).toBe(130);
    });

    test('preserves aspect ratio for non-square image token', () => {
      const rectToken = {
        id: 'rect-token',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        initialCx: 200,
        initialCy: 150,
        aspectRatio: 2,
        type: 'image',
      };
      const result = calculateTokenPinchResize(
        rectToken,
        100,
        200, // 2x
        { x: 200, y: 150 },
        { x: 200, y: 150 }
      );
      expect(result.width).toBe(400);
      expect(result.height).toBe(200);
    });

    test('clamps token resizing to minDimension and maxDimension bounds', () => {
      const minClamped = calculateTokenPinchResize(
        token,
        100,
        5, // would scale to 5px
        { x: 150, y: 150 },
        { x: 150, y: 150 },
        { minDimension: 25 }
      );
      expect(minClamped.width).toBe(25);
      expect(minClamped.height).toBe(25);

      const maxClamped = calculateTokenPinchResize(
        token,
        10,
        500, // 50x -> would scale to 5000px
        { x: 150, y: 150 },
        { x: 150, y: 150 },
        { maxDimension: 600 }
      );
      expect(maxClamped.width).toBe(600);
      expect(maxClamped.height).toBe(600);
    });

    test('handles missing token or non-positive distances gracefully', () => {
      expect(calculateTokenPinchResize(null, 100, 100)).toEqual({
        x: 0,
        y: 0,
        width: 24,
        height: 24,
        scaleFactor: 1,
      });
      expect(calculateTokenPinchResize(token, 0, 100)).toEqual({
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        scaleFactor: 1,
      });
      expect(calculateTokenPinchResize(token, 100, -5)).toEqual({
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        scaleFactor: 1,
      });
    });
  });
});
