/**
 * Coordinate transformations, rotated hit detection, selection checks,
 * and path splitting math utilities for the high-DPI Canvas drawing engine.
 */

// Translate client coordinates to local coordinates relative to center of a rotated element
export const getLocalCoords = (x, y, element) => {
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const rad = element.properties?.rotation || 0;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos,
  };
};

// Check if mouse hits a handle on the selected element
export const getHandleAtCoords = (x, y, element, scale) => {
  const local = getLocalCoords(x, y, element);
  const w = element.width;
  const h = element.height;
  const r = 10 / scale; // hit tolerance radius in virtual space
  const offset = 4 / scale;
  const rotOffset = 24 / scale;

  // NW
  if (Math.hypot(local.x - (-w / 2 - offset), local.y - (-h / 2 - offset)) <= r) return 'nw';
  // NE
  if (Math.hypot(local.x - (w / 2 + offset), local.y - (-h / 2 - offset)) <= r) return 'ne';
  // SE
  if (Math.hypot(local.x - (w / 2 + offset), local.y - (h / 2 + offset)) <= r) return 'se';
  // SW
  if (Math.hypot(local.x - (-w / 2 - offset), local.y - (h / 2 + offset)) <= r) return 'sw';

  // Rotation handle (located 24px above top center)
  if (Math.hypot(local.x - 0, local.y - (-h / 2 - rotOffset)) <= r) return 'rotate';

  return null;
};

// Check if circular eraser (or click point) intersects with any segment of a path element
export const checkEraserIntersectsPath = (ex, ey, eraserRad, pathEl) => {
  const points = pathEl.properties?.points || [];
  if (points.length < 2) return false;

  // Translate coordinates into path local rotated space
  const local = getLocalCoords(ex, ey, pathEl);
  const w = pathEl.width;
  const h = pathEl.height;

  // Math helper to get shortest distance from a point to a segment
  const getDistanceToSegment = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);

    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t)); // Clamp projection inside segment bounds

    const closestX = ax + t * dx;
    const closestY = ay + t * dy;
    return Math.hypot(px - closestX, py - closestY);
  };

  const pathStrokeWidth = pathEl.properties?.strokeWidth || 4;
  const hitTolerance = eraserRad + pathStrokeWidth / 2;

  for (let i = 0; i < points.length - 1; i++) {
    // Map normalized coordinates back to local element space
    const ax = -w / 2 + points[i].x * w;
    const ay = -h / 2 + points[i].y * h;
    const bx = -w / 2 + points[i + 1].x * w;
    const by = -h / 2 + points[i + 1].y * h;

    const dist = getDistanceToSegment(local.x, local.y, ax, ay, bx, by);
    if (dist <= hitTolerance) {
      return true;
    }
  }
  return false;
};

// Split a path element into multiple sub-paths where the eraser intersects
export const splitPathElement = (ex, ey, eraserRad, pathEl) => {
  const points = pathEl.properties?.points || [];
  if (points.length < 2) return [];

  const local = getLocalCoords(ex, ey, pathEl);
  const w = pathEl.width;
  const h = pathEl.height;
  const strokeWidth = pathEl.properties?.strokeWidth || 4;
  const hitTolerance = eraserRad; // Erase vertices strictly inside the eraser

  // 1. Calculate local coordinates for all points
  const localPts = points.map((p) => ({
    x: -w / 2 + p.x * w,
    y: -h / 2 + p.y * h,
  }));

  // 2. Identify which points are erased (inside eraser circle)
  const isPtErased = localPts.map(
    (lp) => Math.hypot(lp.x - local.x, lp.y - local.y) <= hitTolerance
  );

  // Helper to get distance from a point to a segment
  const getDistanceToSegment = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };

  // 3. Identify which segments are erased (intersect the eraser + stroke thickness)
  const isSegErased = [];
  for (let i = 0; i < localPts.length - 1; i++) {
    const dist = getDistanceToSegment(
      local.x,
      local.y,
      localPts[i].x,
      localPts[i].y,
      localPts[i + 1].x,
      localPts[i + 1].y
    );
    isSegErased.push(dist <= eraserRad + strokeWidth / 2);
  }

  // 4. Split into chunks of points
  const chunks = [];
  let currentChunk = [];

  for (let i = 0; i < points.length; i++) {
    if (isPtErased[i]) {
      // Current point is erased. End current chunk
      if (currentChunk.length >= 2) {
        chunks.push(currentChunk);
      }
      currentChunk = [];
    } else {
      // Point is not erased
      if (currentChunk.length === 0) {
        currentChunk.push(points[i]);
      } else {
        // Check if segment from previous point to this point was erased
        if (isSegErased[i - 1]) {
          // Segment is erased! Split here.
          if (currentChunk.length >= 2) {
            chunks.push(currentChunk);
          }
          currentChunk = [points[i]];
        } else {
          currentChunk.push(points[i]);
        }
      }
    }
  }
  if (currentChunk.length >= 2) {
    chunks.push(currentChunk);
  }

  if (chunks.length === 0) {
    return [];
  }

  // 5. Convert chunks back into new path elements
  const parentCx = pathEl.x + w / 2;
  const parentCy = pathEl.y + h / 2;
  const rot = pathEl.properties?.rotation || 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  return chunks.map((chunk, idx) => {
    // Chunk points are original normalized points. Get local coords relative to parent:
    const chunkLocalPts = chunk.map((pt) => ({
      x: -w / 2 + pt.x * w,
      y: -h / 2 + pt.y * h,
    }));

    // Find local bounding box of this chunk
    let minLx = Infinity;
    let maxLx = -Infinity;
    let minLy = Infinity;
    let maxLy = -Infinity;
    chunkLocalPts.forEach((lp) => {
      if (lp.x < minLx) minLx = lp.x;
      if (lp.x > maxLx) maxLx = lp.x;
      if (lp.y < minLy) minLy = lp.y;
      if (lp.y > maxLy) maxLy = lp.y;
    });

    const chunkW = Math.max(maxLx - minLx, 4);
    const chunkH = Math.max(maxLy - minLy, 4);

    // Normalize points for the new element
    const newNormalizedPoints = chunkLocalPts.map((lp) => ({
      x: (lp.x - minLx) / chunkW,
      y: (lp.y - minLy) / chunkH,
    }));

    // Center of new element in parent local space
    const newCxLocal = minLx + chunkW / 2;
    const newCyLocal = minLy + chunkH / 2;

    // Center in global space
    const newCxGlobal = parentCx + newCxLocal * cos - newCyLocal * sin;
    const newCyGlobal = parentCy + newCxLocal * sin + newCyLocal * cos;

    const newX = newCxGlobal - chunkW / 2;
    const newY = newCyGlobal - chunkH / 2;

    const newId = `el_path_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 9)}`;

    return {
      id: newId,
      type: 'path',
      x: Math.round(newX),
      y: Math.round(newY),
      width: Math.round(chunkW),
      height: Math.round(chunkH),
      properties: {
        points: newNormalizedPoints,
        stroke: pathEl.properties.stroke,
        strokeWidth: pathEl.properties.strokeWidth,
        rotation: rot,
      },
    };
  });
};

// Check if coordinates hit an element, checking top-most first
export const getElementAtCoords = (x, y, elements) => {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.properties?.locked) continue;
    const local = getLocalCoords(x, y, el);
    const hw = el.width / 2;
    const hh = el.height / 2;

    if (el.type === 'rectangle' || el.type === 'image') {
      if (local.x >= -hw && local.x <= hw && local.y >= -hh && local.y <= hh) {
        return el;
      }
    } else if (el.type === 'circle') {
      const dx = local.x / hw;
      const dy = local.y / hh;
      if (dx * dx + dy * dy <= 1) {
        return el;
      }
    } else if (el.type === 'path') {
      if (checkEraserIntersectsPath(x, y, 8, el)) {
        return el;
      }
    }
  }
  return null;
};

// Get hovered element for tooltips
export const getHoveredElement = (x, y, elements) => {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type !== 'rectangle' && el.type !== 'circle' && el.type !== 'image') continue;
    
    const local = getLocalCoords(x, y, el);
    const hw = el.width / 2;
    const hh = el.height / 2;
    
    if (el.type === 'rectangle' || el.type === 'image') {
      if (local.x >= -hw && local.x <= hw && local.y >= -hh && local.y <= hh) {
        return el;
      }
    } else if (el.type === 'circle') {
      const dx = local.x / hw;
      const dy = local.y / hh;
      if (dx * dx + dy * dy <= 1) {
        return el;
      }
    }
  }
  return null;
};

// Group Transform helpers
export const getGroupBoundingBox = (selectedIds, elements) => {
  if (!selectedIds || selectedIds.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  selectedIds.forEach((id) => {
    const el = elements.find((e) => e.id === id);
    if (!el) return;

    const w = el.width;
    const h = el.height;
    const cx = el.x + w / 2;
    const cy = el.y + h / 2;
    const rad = el.properties?.rotation || 0;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ];

    corners.forEach((c) => {
      const gx = cx + c.x * cos - c.y * sin;
      const gy = cy + c.x * sin + c.y * cos;
      if (gx < minX) minX = gx;
      if (gx > maxX) maxX = gx;
      if (gy < minY) minY = gy;
      if (gy > maxY) maxY = gy;
    });
  });

  if (minX === Infinity) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
};

export const getGroupHandleAtCoords = (mx, my, bbox, scale) => {
  if (!bbox) return null;
  const r = 10 / scale;
  const offset = 4 / scale;
  const rotOffset = 24 / scale;

  if (Math.hypot(mx - (bbox.x - offset), my - (bbox.y - offset)) <= r) return 'nw';
  if (Math.hypot(mx - (bbox.x + bbox.width + offset), my - (bbox.y - offset)) <= r) return 'ne';
  if (Math.hypot(mx - (bbox.x + bbox.width + offset), my - (bbox.y + bbox.height + offset)) <= r) return 'se';
  if (Math.hypot(mx - (bbox.x - offset), my - (bbox.y + bbox.height + offset)) <= r) return 'sw';
  if (Math.hypot(mx - bbox.cx, my - (bbox.y - rotOffset)) <= r) return 'rotate';

  return null;
};

export const checkElementIntersectsBox = (el, sMinX, sMaxX, sMinY, sMaxY) => {
  const w = el.width;
  const h = el.height;
  const cx = el.x + w / 2;
  const cy = el.y + h / 2;
  const rad = el.properties?.rotation || 0;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const isPointInSelectionBox = (px, py) => {
    return px >= sMinX && px <= sMaxX && py >= sMinY && py <= sMaxY;
  };

  const isPointInRotatedElement = (px, py) => {
    const dx = px - cx;
    const dy = py - cy;
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    return lx >= -w / 2 && lx <= w / 2 && ly >= -h / 2 && ly <= h / 2;
  };

  const elementCorners = [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ];
  for (const c of elementCorners) {
    const gx = cx + c.x * cos - c.y * sin;
    const gy = cy + c.x * sin + c.y * cos;
    if (isPointInSelectionBox(gx, gy)) {
      return true;
    }
  }

  const boxCorners = [
    { x: sMinX, y: sMinY },
    { x: sMaxX, y: sMinY },
    { x: sMaxX, y: sMaxY },
    { x: sMinX, y: sMaxY },
  ];
  for (const bc of boxCorners) {
    if (isPointInRotatedElement(bc.x, bc.y)) {
      return true;
    }
  }

  const sCx = (sMinX + sMaxX) / 2;
  const sCy = (sMinY + sMaxY) / 2;
  if (isPointInRotatedElement(sCx, sCy)) {
    return true;
  }

  return false;
};
