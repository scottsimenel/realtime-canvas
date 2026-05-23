import { useRef, useEffect, useState, useCallback } from 'react';

export default function Canvas({
  socketRef,
  elements,
  setElements,
  locks,
  setLocks,
  users,
  currentUser,
  selectedElementIds,
  setSelectedElementIds,
  activeTool,
  penColor,
  penSize,
  eraserSize = 20,
  roomSettings,
  tabId = 'tab-default',
  onVirtualDimensionsChange,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const dragStateRef = useRef(null);
  const lastCursorEmitRef = useRef(0);
  const imageCache = useRef({});
  const tempDrawingPathRef = useRef(null); // Ref for local drawing stroke: { points, stroke, strokeWidth }
  const eraserHoverRef = useRef(null); // Ref for tracking eraser mouse cursor hover coordinate: { x, y }
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [redrawTrigger, setRedrawTrigger] = useState(0);
  const [virtualDimensions, setVirtualDimensions] = useState({ width: 1920, height: 1080 });
  const [hoveredElementId, setHoveredElementId] = useState(null);

  const [userZoom, setUserZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const activePointersRef = useRef({}); // maps pointerId -> { clientX, clientY }
  const touchStartRef = useRef(null); // { distance, midpoint, userZoom, panOffset }
  const isSpacePressedRef = useRef(false);

  // Load background image to set virtual dimensions state
  useEffect(() => {
    const {
      backgroundImageUrl,
      showBackground,
      customBackgroundWidth,
      customBackgroundHeight,
    } = roomSettings || {};

    const fallbackWidth = 1920;
    const fallbackHeight = 1080;

    const getFittedDimensions = (imgW, imgH) => {
      const maxW = 1920;
      const maxH = 1080;
      const imgRatio = imgW / imgH;
      const boxRatio = maxW / maxH;
      if (imgRatio > boxRatio) {
        return { width: maxW, height: Math.round(maxW / imgRatio) };
      } else {
        return { width: Math.round(maxH * imgRatio), height: maxH };
      }
    };

    const getOverriddenDimensions = (imgRatio, defaultW, defaultH) => {
      const w = parseInt(customBackgroundWidth, 10);
      const h = parseInt(customBackgroundHeight, 10);
      const wValid = !isNaN(w) && w > 0;
      const hValid = !isNaN(h) && h > 0;

      if (wValid && hValid) {
        return { width: w, height: h };
      } else if (wValid) {
        return { width: w, height: Math.round(w / imgRatio) };
      } else if (hValid) {
        return { width: Math.round(h * imgRatio), height: h };
      } else {
        return { width: defaultW, height: defaultH };
      }
    };

    if (showBackground && backgroundImageUrl) {
      const img = new Image();
      img.src = backgroundImageUrl;
      img.onload = () => {
        const fitted = getFittedDimensions(img.width, img.height);
        const imgRatio = img.width / img.height;
        const final = getOverriddenDimensions(imgRatio, fitted.width, fitted.height);
        setVirtualDimensions((prev) => {
          if (prev.width === final.width && prev.height === final.height) return prev;
          return final;
        });
      };
      img.onerror = () => {
        setTimeout(() => {
          const final = getOverriddenDimensions(fallbackWidth / fallbackHeight, fallbackWidth, fallbackHeight);
          setVirtualDimensions((prev) => {
            if (prev.width === final.width && prev.height === final.height) return prev;
            return final;
          });
        }, 0);
      };
    } else {
      setTimeout(() => {
        const final = getOverriddenDimensions(fallbackWidth / fallbackHeight, fallbackWidth, fallbackHeight);
        setVirtualDimensions((prev) => {
          if (prev.width === final.width && prev.height === final.height) return prev;
          return final;
        });
      }, 0);
    }
  }, [roomSettings]);

  // Sync virtualDimensions with parent callback if provided
  useEffect(() => {
    if (onVirtualDimensionsChange) {
      onVirtualDimensionsChange(virtualDimensions);
    }
  }, [virtualDimensions, onVirtualDimensionsChange]);

  // Trigger state update to force re-render/redraw on asynchronous assets (like images) loading
  const triggerRedraw = useCallback(() => {
    setRedrawTrigger((prev) => prev + 1);
  }, []);

  const getFullUrl = useCallback((url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const socketUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : window.location.origin;
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${socketUrl}${path}`;
  }, []);

  // Get image from cache or load it
  const getOrLoadImage = useCallback((rawUrl) => {
    if (!rawUrl) return null;
    const url = getFullUrl(rawUrl);
    if (imageCache.current[url]) {
      return imageCache.current[url];
    }
    const img = new Image();
    img.src = url;
    img.onload = () => {
      imageCache.current[url] = img;
      triggerRedraw();
    };
    img.onerror = () => {
      console.error(`Failed to load image: ${url}`);
      // Store placeholder image to avoid repeating failed loads
      const errorPlaceholder = new Image();
      imageCache.current[url] = errorPlaceholder;
    };
    return null;
  }, [triggerRedraw]);

  // Set up resize observer to keep canvas sized correctly
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width: Math.max(width, 100), height: Math.max(height, 100) });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Compute scale and translation offsets for mapping client to virtual coords
  const getViewportTransform = useCallback(() => {
    const { width: virtualWidth, height: virtualHeight } = virtualDimensions;
    const baseScale = Math.min(canvasSize.width / virtualWidth, canvasSize.height / virtualHeight) || 1;
    const scale = baseScale * userZoom;
    const baseOffsetX = (canvasSize.width - virtualWidth * scale) / 2;
    const baseOffsetY = (canvasSize.height - virtualHeight * scale) / 2;
    const offsetX = baseOffsetX + panOffset.x;
    const offsetY = baseOffsetY + panOffset.y;
    return { scale, offsetX, offsetY, virtualWidth, virtualHeight };
  }, [canvasSize, virtualDimensions, userZoom, panOffset]);

  // Translate client coordinates to local coordinates relative to center of a rotated element
  const getLocalCoords = useCallback((x, y, element) => {
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
  }, []);

  // Check if mouse hits a handle on the selected element
  const getHandleAtCoords = useCallback((x, y, element, scale) => {
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
  }, [getLocalCoords]);

  // Check if circular eraser (or click point) intersects with any segment of a path element (Feature 1)
  const checkEraserIntersectsPath = useCallback((ex, ey, eraserRad, pathEl) => {
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
  }, [getLocalCoords]);

  // Split a path element into multiple sub-paths where the eraser intersects
  const splitPathElement = useCallback((ex, ey, eraserRad, pathEl) => {
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
  }, [getLocalCoords]);

  // Check if coordinates hit an element, checking top-most first
  const getElementAtCoords = useCallback((x, y) => {
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
        // High fidelity check close to actual line segments of the path (Feature 1 selection)
        if (checkEraserIntersectsPath(x, y, 8, el)) {
          return el;
        }
      }
    }
    return null;
  }, [elements, getLocalCoords, checkEraserIntersectsPath]);

  const getHoveredElement = useCallback((x, y) => {
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
  }, [elements, getLocalCoords]);

  // Group Transform helpers
  const getGroupBoundingBox = useCallback((selectedIds) => {
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

      // 4 corners relative to center
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
  }, [elements]);

  const getGroupHandleAtCoords = useCallback((mx, my, bbox, scale) => {
    if (!bbox) return null;
    const r = 10 / scale; // hit tolerance radius
    const offset = 4 / scale;
    const rotOffset = 24 / scale;

    // NW
    if (Math.hypot(mx - (bbox.x - offset), my - (bbox.y - offset)) <= r) return 'nw';
    // NE
    if (Math.hypot(mx - (bbox.x + bbox.width + offset), my - (bbox.y - offset)) <= r) return 'ne';
    // SE
    if (Math.hypot(mx - (bbox.x + bbox.width + offset), my - (bbox.y + bbox.height + offset)) <= r) return 'se';
    // SW
    if (Math.hypot(mx - (bbox.x - offset), my - (bbox.y + bbox.height + offset)) <= r) return 'sw';
    // Rotation handle (24px above top edge)
    if (Math.hypot(mx - bbox.cx, my - (bbox.y - rotOffset)) <= r) return 'rotate';

    return null;
  }, []);

  const checkElementIntersectsBox = useCallback((el, sMinX, sMaxX, sMinY, sMaxY) => {
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

    // 1. Check if any of the element's 4 corners is in the selection box
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

    // 2. Check if any of the selection box's 4 corners is inside the rotated element
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

    // 3. Check if the center of the selection box is inside the element
    const sCx = (sMinX + sMaxX) / 2;
    const sCy = (sMinY + sMaxY) / 2;
    if (isPointInRotatedElement(sCx, sCy)) {
      return true;
    }

    return false;
  }, []);

  // Drawing loop
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Destructure roomSettings
    const {
      backgroundImageUrl = null,
      showBackground = true,
      showGrid = true,
      gridType = 'square',
      gridSize = 40,
    } = roomSettings || {};

    const { scale, offsetX, offsetY, virtualWidth, virtualHeight } = getViewportTransform();

    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Save global state and transform to virtual coordinates
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Track whether a background image is actually drawn to adjust grid color
    let isBackgroundDrawn = false;

    // Draw background image
    if (showBackground && backgroundImageUrl) {
      const bgImg = getOrLoadImage(backgroundImageUrl);
      if (bgImg && bgImg.width > 0) {
        isBackgroundDrawn = true;
        ctx.drawImage(bgImg, 0, 0, virtualWidth, virtualHeight);
      }
    }

    // Draw grid background if enabled
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = isBackgroundDrawn ? '#47556960' : '#1e293b';
      ctx.lineWidth = 1 / scale;

      if (gridType === 'hexagon') {
        const R = gridSize;
        const hSpacing = 1.5 * R;
        const vSpacing = Math.sqrt(3) * R;

        const cols = Math.ceil(virtualWidth / hSpacing) + 1;
        const rows = Math.ceil(virtualHeight / vSpacing) + 1;

        ctx.beginPath();
        for (let col = 0; col < cols; col++) {
          const cx = col * hSpacing;
          const isOdd = Math.abs(col) % 2 === 1;
          const yOffset = isOdd ? vSpacing / 2 : 0;
          
          for (let row = 0; row < rows; row++) {
            const cy = row * vSpacing + yOffset;
            
            // Draw flat-topped hexagon
            ctx.moveTo(cx + R, cy);
            for (let i = 1; i <= 6; i++) {
              const angle = (i * Math.PI) / 3;
              ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle));
            }
          }
        }
        ctx.stroke();
      } else {
        // Standard square grid
        const gridSpacing = gridSize;
        ctx.beginPath();
        for (let x = 0; x <= virtualWidth; x += gridSpacing) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, virtualHeight);
        }
        for (let y = 0; y <= virtualHeight; y += gridSpacing) {
          ctx.moveTo(0, y);
          ctx.lineTo(virtualWidth, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw element shapes
    elements.forEach((element) => {
      const lockHolderId = locks[element.id];
      const isLockedByMe = lockHolderId === currentUser?.id;
      const isLockedByOther = lockHolderId && lockHolderId !== currentUser?.id;
      const lockHolder = isLockedByOther ? users.find((u) => u.id === lockHolderId) : null;

      const w = element.width;
      const h = element.height;
      const cx = element.x + w / 2;
      const cy = element.y + h / 2;
      const rad = element.properties?.rotation || 0;

      ctx.save();

      // Translate to center and rotate context
      ctx.translate(cx, cy);
      ctx.rotate(rad);

      // Render shapes centered on (0, 0)
      if (element.type === 'rectangle') {
        ctx.fillStyle = element.properties?.fill || '#3b82f6';
        ctx.fillRect(-w / 2, -h / 2, w, h);

        ctx.strokeStyle = element.properties?.stroke || '#2563eb';
        ctx.lineWidth = element.properties?.strokeWidth || 2;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
      } else if (element.type === 'circle') {
        ctx.fillStyle = element.properties?.fill || '#10b981';
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = element.properties?.stroke || '#059669';
        ctx.lineWidth = element.properties?.strokeWidth || 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (element.type === 'image') {
        const img = getOrLoadImage(element.properties?.url);
        if (img && img.width > 0) {
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        } else {
          // Draw image placeholder
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-w / 2, -h / 2, w, h);

          ctx.fillStyle = '#64748b';
          ctx.font = '12px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            img ? 'Failed to load Image' : 'Loading Image...',
            0,
            0
          );
        }

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.strokeRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2);
      } else if (element.type === 'path') {
        const points = element.properties?.points || [];
        if (points.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = element.properties?.stroke || '#3b82f6';
          ctx.lineWidth = element.properties?.strokeWidth || 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // First point mapped to local coordinate bounds
          const startX = -w / 2 + points[0].x * w;
          const startY = -h / 2 + points[0].y * h;
          ctx.moveTo(startX, startY);

          for (let p = 1; p < points.length; p++) {
            const px = -w / 2 + points[p].x * w;
            const py = -h / 2 + points[p].y * h;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }

      // Draw lock highlighting (for individual elements)
      if (isLockedByMe || isLockedByOther) {
        const lockColor = isLockedByMe
          ? currentUser?.color || '#3b82f6'
          : lockHolder?.color || '#f43f5e';

        ctx.strokeStyle = lockColor;
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([6 / scale, 4 / scale]);
        ctx.strokeRect(
          -w / 2 - 6 / scale,
          -h / 2 - 6 / scale,
          w + 12 / scale,
          h + 12 / scale
        );
        ctx.setLineDash([]); // Reset dash

        // Draw padlock icon or text banner
        if (isLockedByOther && lockHolder) {
          ctx.fillStyle = lockColor;
          ctx.font = `500 ${11 / scale}px Inter, system-ui, sans-serif`;
          const labelText = `🔒 Locked by ${lockHolder.name}`;
          const textWidth = ctx.measureText(labelText).width;

          // Draw label background card
          ctx.fillRect(
            -w / 2 - 6 / scale,
            -h / 2 - 30 / scale,
            textWidth + 12 / scale,
            20 / scale
          );

          // Draw label text
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, -w / 2, -h / 2 - 20 / scale);
        } else if (isLockedByMe) {
          ctx.fillStyle = lockColor;
          ctx.font = `500 ${11 / scale}px Inter, system-ui, sans-serif`;
          const labelText = '✨ Transforming';
          const textWidth = ctx.measureText(labelText).width;

          ctx.fillRect(
            -w / 2 - 6 / scale,
            -h / 2 - 30 / scale,
            textWidth + 12 / scale,
            20 / scale
          );

          // Draw label text
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, -w / 2, -h / 2 - 20 / scale);
        }
      }

      // Draw tooltip info icon in top-right corner if enabled
      if (element.properties?.tooltip?.enabled) {
        ctx.save();
        // Translate to top right corner (slightly offset inwards)
        ctx.translate(w / 2 - 10 / scale, -h / 2 + 10 / scale);
        
        // Circular background
        ctx.beginPath();
        ctx.arc(0, 0, 7 / scale, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; // Sky blue border
        ctx.lineWidth = 1 / scale;
        ctx.stroke();
        
        // Info letter 'i'
        ctx.fillStyle = '#38bdf8'; // Sky blue text
        ctx.font = `bold ${8 / scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('i', 0, -0.5 / scale); // tiny vertical adjustment
        
        ctx.restore();
      }

      // Draw canvas-visible tracker bars below the element bounds
      if (element.properties?.tooltip?.enabled) {
        const trackers = element.properties.tooltip.trackers || [];
        const canvasTrackers = trackers.filter(t => t.showOnCanvas);
        if (canvasTrackers.length > 0) {
          const barHeight = 5 / scale;
          const barWidth = w;
          let startY = h / 2 + 6 / scale; // start 6px below element bounds
          
          canvasTrackers.forEach((tracker) => {
            const val = Number(tracker.value) || 0;
            const max = Number(tracker.max) || 10;
            const pct = max > 0 ? Math.min(Math.max(val / max, 0), 1) : 0;
            
            // Bar background (semi-transparent slate)
            ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
            ctx.fillRect(-barWidth / 2, startY, barWidth, barHeight);
            
            // Bar fill
            let fillColor = '#ef4444'; // default red
            if (tracker.color === 'green') fillColor = '#10b981';
            else if (tracker.color === 'blue') fillColor = '#3b82f6';
            else if (tracker.color === 'yellow' || tracker.color === 'amber') fillColor = '#f59e0b';
            else if (tracker.color === 'purple') fillColor = '#8b5cf6';
            else if (tracker.color === 'rose') fillColor = '#f43f5e';
            
            ctx.fillStyle = fillColor;
            ctx.fillRect(-barWidth / 2, startY, barWidth * pct, barHeight);
            
            // Border outline
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1 / scale;
            ctx.strokeRect(-barWidth / 2, startY, barWidth, barHeight);
            
            startY += barHeight + 3 / scale; // vertical stack offset
          });
        }
      }

      ctx.restore();
    });

    // Draw individual outlines for selected elements
    selectedElementIds.forEach((id) => {
      const element = elements.find((e) => e.id === id);
      if (!element) return;

      const w = element.width;
      const h = element.height;
      const cx = element.x + w / 2;
      const cy = element.y + h / 2;
      const rad = element.properties?.rotation || 0;

      const outlineColor = element.properties?.locked ? '#f59e0b' : '#38bdf8';

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rad);

      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1 / scale;

      // Draw individual handles only if exactly 1 element is selected
      if (selectedElementIds.length === 1) {
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeRect(-w / 2 - 4 / scale, -h / 2 - 4 / scale, w + 8 / scale, h + 8 / scale);

        // Rotation handle line
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1 / scale;
        ctx.beginPath();
        ctx.moveTo(0, -h / 2 - 4 / scale);
        ctx.lineTo(0, -h / 2 - 24 / scale);
        ctx.stroke();

        // Rotation handle circle
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1.5 / scale;
        ctx.beginPath();
        ctx.arc(0, -h / 2 - 24 / scale, 5 / scale, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Corner handles
        const handleSize = 7 / scale;
        const offset = 4 / scale;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1.5 / scale;

        // Top-Left
        ctx.fillRect(-w / 2 - offset - handleSize / 2, -h / 2 - offset - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(-w / 2 - offset - handleSize / 2, -h / 2 - offset - handleSize / 2, handleSize, handleSize);
        // Top-Right
        ctx.fillRect(w / 2 + offset - handleSize / 2, -h / 2 - offset - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(w / 2 + offset - handleSize / 2, -h / 2 - offset - handleSize / 2, handleSize, handleSize);
        // Bottom-Right
        ctx.fillRect(w / 2 + offset - handleSize / 2, h / 2 + offset - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(w / 2 + offset - handleSize / 2, h / 2 + offset - handleSize / 2, handleSize, handleSize);
        // Bottom-Left
        ctx.fillRect(-w / 2 - offset - handleSize / 2, h / 2 + offset - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(-w / 2 - offset - handleSize / 2, h / 2 + offset - handleSize / 2, handleSize, handleSize);
      } else {
        // Draw simple selection outline if in a group
        ctx.strokeRect(-w / 2 - 2 / scale, -h / 2 - 2 / scale, w + 4 / scale, h + 4 / scale);
      }

      ctx.restore();
    });

    // Draw unified group bounding box & handles if selectedElementIds.length > 1
    if (selectedElementIds.length > 1) {
      const bbox = getGroupBoundingBox(selectedElementIds);
      if (bbox) {
        ctx.save();
        ctx.strokeStyle = '#0ea5e9'; // sky-500
        ctx.lineWidth = 1.5 / scale;
        // Group bounding box outline
        ctx.strokeRect(bbox.x - 4 / scale, bbox.y - 4 / scale, bbox.width + 8 / scale, bbox.height + 8 / scale);

        // Rotation stem
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 1 / scale;
        ctx.beginPath();
        ctx.moveTo(bbox.cx, bbox.y - 4 / scale);
        ctx.lineTo(bbox.cx, bbox.y - 24 / scale);
        ctx.stroke();

        // Rotation circle
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 1.5 / scale;
        ctx.beginPath();
        ctx.arc(bbox.cx, bbox.y - 24 / scale, 5 / scale, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Corner handles
        const handleSize = 7 / scale;
        const offset = 4 / scale;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 1.5 / scale;

        // Top-Left
        ctx.fillRect(bbox.x - offset - handleSize / 2, bbox.y - offset - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(bbox.x - offset - handleSize / 2, bbox.y - offset - handleSize / 2, handleSize, handleSize);
        // Top-Right
        ctx.fillRect(bbox.x + bbox.width + offset - handleSize / 2, bbox.y - offset - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(bbox.x + bbox.width + offset - handleSize / 2, bbox.y - offset - handleSize / 2, handleSize, handleSize);
        // Bottom-Right
        ctx.fillRect(bbox.x + bbox.width + offset - handleSize / 2, bbox.y + bbox.height + offset - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(bbox.x + bbox.width + offset - handleSize / 2, bbox.y + bbox.height + offset - handleSize / 2, handleSize, handleSize);
        // Bottom-Left
        ctx.fillRect(bbox.x - offset - handleSize / 2, bbox.y + bbox.height + offset - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(bbox.x - offset - handleSize / 2, bbox.y + bbox.height + offset - handleSize / 2, handleSize, handleSize);

        ctx.restore();
      }
    }

    // Draw active local drawing stroke (Feature 1)
    const activeStroke = tempDrawingPathRef.current;
    if (activeStroke && activeStroke.points && activeStroke.points.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = activeStroke.stroke || '#3b82f6';
      ctx.lineWidth = activeStroke.strokeWidth || 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.moveTo(activeStroke.points[0].x, activeStroke.points[0].y);
      for (let p = 1; p < activeStroke.points.length; p++) {
        ctx.lineTo(activeStroke.points[p].x, activeStroke.points[p].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw eraser circular cursor indicator (Feature 1)
    if (activeTool === 'eraser' && eraserHoverRef.current) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = '#f43f5e'; // rose-500
      ctx.lineWidth = 1.5 / scale;
      ctx.setLineDash([4 / scale, 4 / scale]);
      const eraserRad = eraserSize / 2;
      ctx.arc(eraserHoverRef.current.x, eraserHoverRef.current.y, eraserRad, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    // Draw drag-select box
    const drag = dragStateRef.current;
    if (drag && drag.mode === 'select') {
      const x = Math.min(drag.startX, drag.currentX);
      const y = Math.min(drag.startY, drag.currentY);
      const w = Math.abs(drag.startX - drag.currentX);
      const h = Math.abs(drag.startY - drag.currentY);

      ctx.save();
      ctx.strokeStyle = '#0ea5e9'; // sky-500
      ctx.lineWidth = 1.5 / scale;
      ctx.setLineDash([4 / scale, 4 / scale]);
      ctx.fillStyle = 'rgba(14, 165, 233, 0.08)'; // 8% opacity sky blue

      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    // Restore global translation and scaling
    ctx.restore();
  }, [canvasSize, elements, locks, users, currentUser, getOrLoadImage, selectedElementIds, getGroupBoundingBox, activeTool, eraserSize, roomSettings, getViewportTransform]);

  // Adjust high DPI canvas scaling and trigger redraws
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    drawCanvas();
  }, [canvasSize, drawCanvas, redrawTrigger]);

  const throttleCursorMove = (x, y) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    const now = Date.now();
    if (now - lastCursorEmitRef.current > 30) { // Emit cursor every 30ms
      socket.emit('cursor-move', { x, y });
      lastCursorEmitRef.current = now;
    }
  };

  // Keyboard listener for element deletion
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedElementIds.length > 0 && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
          return; // Ignore if typing inside text fields
        }

        const socket = socketRef.current;
        if (socket && socket.connected) {
          const unlockedIds = selectedElementIds.filter((id) => {
            const el = elements.find((item) => item.id === id);
            if (!el || el.properties?.locked) return false;
            const lockHolderId = locks[id];
            return !lockHolderId || lockHolderId === currentUser?.id;
          });

          if (unlockedIds.length === 0) return;

          socket.emit('element-delete', { elementIds: unlockedIds, tabId }, (response) => {
            if (response && response.success) {
              setElements((prev) => prev.filter((el) => !unlockedIds.includes(el.id)));
              setSelectedElementIds((prev) => prev.filter((id) => !unlockedIds.includes(id)));
            }
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementIds, elements, locks, currentUser, socketRef, setElements, setSelectedElementIds, tabId]);

  // Spacebar panning key listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        isSpacePressedRef.current = true;
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handlePointerDown = (e) => {
    // If user clicks interactive UI elements (buttons, inputs, sliders, etc.), do nothing on the canvas
    if (
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('select') ||
      e.target.closest('textarea')
    ) {
      return;
    }

    setHoveredElementId(null);
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    // Capture pointer to track movements outside canvas bounds
    containerRef.current?.setPointerCapture(e.pointerId);

    // Register active pointer coordinates
    activePointersRef.current[e.pointerId] = { clientX: e.clientX, clientY: e.clientY };

    const activePointerIds = Object.keys(activePointersRef.current);

    // Multi-touch touch gestures (pinch-to-zoom/pan)
    if (activePointerIds.length === 2) {
      // Abort any pen drawing or lock selections
      if (dragStateRef.current && dragStateRef.current.mode === 'draw') {
        tempDrawingPathRef.current = null;
      }
      if (dragStateRef.current && dragStateRef.current.mode.startsWith('group-') && dragStateRef.current.lockedIds.length > 0) {
        socket.emit('element-unlock', { elementIds: dragStateRef.current.lockedIds, tabId });
        setLocks((prev) => {
          const next = { ...prev };
          dragStateRef.current.lockedIds.forEach((id) => delete next[id]);
          return next;
        });
      } else if (dragStateRef.current && dragStateRef.current.hasLock) {
        socket.emit('element-unlock', { elementId: dragStateRef.current.elementId, tabId });
        setLocks((prev) => {
          const next = { ...prev };
          delete next[dragStateRef.current.elementId];
          return next;
        });
      }

      const [p1, p2] = activePointerIds.map(id => activePointersRef.current[id]);
      const distance = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
      const midpoint = { x: (p1.clientX + p2.clientX) / 2, y: (p1.clientY + p2.clientY) / 2 };

      touchStartRef.current = {
        distance,
        midpoint,
        userZoom,
        panOffset: { ...panOffset }
      };
      dragStateRef.current = { mode: 'touch-gesture' };
      triggerRedraw();
      return;
    }

    if (activePointerIds.length === 1) {
      // Initiate viewport panning
      if (activeTool === 'pan' || isSpacePressedRef.current || e.button === 1 || e.button === 4) {
        dragStateRef.current = {
          mode: 'pan',
          startX: e.clientX,
          startY: e.clientY,
          startPanOffset: { ...panOffset }
        };
        return;
      }

      // Delegate to standard draw/drag/resize/select mousedown handler
      handleMouseDown(e);
    }
  };

  const handlePointerMove = (e) => {
    if (activePointersRef.current[e.pointerId]) {
      activePointersRef.current[e.pointerId] = { clientX: e.clientX, clientY: e.clientY };
    }

    const activePointerIds = Object.keys(activePointersRef.current);
    const drag = dragStateRef.current;

    if (drag) {
      if (drag.mode === 'touch-gesture' && activePointerIds.length === 2) {
        const [p1, p2] = activePointerIds.map(id => activePointersRef.current[id]);
        const newDistance = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
        const newMidpoint = { x: (p1.clientX + p2.clientX) / 2, y: (p1.clientY + p2.clientY) / 2 };

        const start = touchStartRef.current;
        if (start) {
          const zoomFactor = newDistance / start.distance;
          const nextZoom = Math.min(8.0, Math.max(0.5, start.userZoom * zoomFactor));

          const dx = newMidpoint.x - start.midpoint.x;
          const dy = newMidpoint.y - start.midpoint.y;

          setUserZoom(nextZoom);
          setPanOffset({
            x: start.panOffset.x + dx,
            y: start.panOffset.y + dy
          });
          triggerRedraw();
        }
        return;
      }

      if (drag.mode === 'pan') {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        setPanOffset({
          x: drag.startPanOffset.x + dx,
          y: drag.startPanOffset.y + dy
        });
        triggerRedraw();
        return;
      }

      // Delegate to standard draw/drag/resize/select mousemove handler
      handleMouseMove(e);
    } else {
      // Hover behavior updates
      const coords = getCanvasCoords(e);
      throttleCursorMove(coords.x, coords.y);

      if (activeTool === 'eraser') {
        eraserHoverRef.current = coords;
        triggerRedraw();
      }

      if (activeTool === 'select' || activeTool === 'pan') {
        const hovered = getHoveredElement(coords.x, coords.y);
        if (hovered && hovered.properties?.tooltip?.enabled) {
          setHoveredElementId(hovered.id);
        } else {
          setHoveredElementId(null);
        }
      }
    }
  };

  const handlePointerUp = (e) => {
    containerRef.current?.releasePointerCapture(e.pointerId);
    delete activePointersRef.current[e.pointerId];

    const drag = dragStateRef.current;
    if (drag) {
      if (drag.mode === 'touch-gesture' || drag.mode === 'pan') {
        dragStateRef.current = null;
        triggerRedraw();
        return;
      }

      // Delegate to standard resolve mouseup handler
      handleMouseUp();
    }
  };

  const handlePointerLeave = (e) => {
    containerRef.current?.releasePointerCapture(e.pointerId);
    delete activePointersRef.current[e.pointerId];

    const drag = dragStateRef.current;
    if (drag) {
      if (drag.mode === 'touch-gesture' || drag.mode === 'pan') {
        dragStateRef.current = null;
        triggerRedraw();
        return;
      }
    }

    setHoveredElementId(null);
    eraserHoverRef.current = null;
    handleMouseUp();
  };

  const handleWheel = (e) => {
    const zoomFactor = 1.08;
    let nextZoom = userZoom;
    if (e.deltaY < 0) {
      nextZoom = Math.min(8.0, userZoom * zoomFactor);
    } else {
      nextZoom = Math.max(0.5, userZoom / zoomFactor);
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Translate mouse coordinates to virtual coords before zoom
      const { scale, offsetX, offsetY } = getViewportTransform();
      const virtualX = (mouseX - offsetX) / scale;
      const virtualY = (mouseY - offsetY) / scale;

      setUserZoom(nextZoom);

      // Adjust panOffset so that cursor points to same virtual coords after zoom
      const baseScale = Math.min(canvasSize.width / virtualDimensions.width, canvasSize.height / virtualDimensions.height) || 1;
      const newScale = baseScale * nextZoom;

      const newBaseOffsetX = (canvasSize.width - virtualDimensions.width * newScale) / 2;
      const newBaseOffsetY = (canvasSize.height - virtualDimensions.height * newScale) / 2;

      setPanOffset({
        x: mouseX - virtualX * newScale - newBaseOffsetX,
        y: mouseY - virtualY * newScale - newBaseOffsetY
      });
    }

    triggerRedraw();
  };

  const handleMouseDown = (e) => {
    setHoveredElementId(null);
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    const coords = getCanvasCoords(e);
    const { scale } = getViewportTransform();

    // Feature 1: Pen tool drawing initiation
    if (activeTool === 'pen') {
      tempDrawingPathRef.current = {
        points: [coords],
        stroke: penColor,
        strokeWidth: penSize,
      };
      dragStateRef.current = {
        mode: 'draw',
      };
      triggerRedraw();
      return;
    }

    // Feature 1: Eraser tool activation
    if (activeTool === 'eraser') {
      dragStateRef.current = {
        mode: 'erase',
      };
      eraserHoverRef.current = coords;

      // Perform click erase intersection check immediately
      const eraserRad = eraserSize / 2;
      const elementsToErase = elements.filter(
        (el) => el.type === 'path' && checkEraserIntersectsPath(coords.x, coords.y, eraserRad, el)
      );

      if (elementsToErase.length > 0) {
        const unlockableElements = elementsToErase.filter((el) => {
          const lockHolderId = locks[el.id];
          return !lockHolderId || lockHolderId === currentUser?.id;
        });

        if (unlockableElements.length > 0) {
          const toDeleteIds = [];
          const toCreateElements = [];

          unlockableElements.forEach((el) => {
            const subPaths = splitPathElement(coords.x, coords.y, eraserRad, el);
            toDeleteIds.push(el.id);
            toCreateElements.push(...subPaths);
          });

          if (toDeleteIds.length > 0) {
            setElements((prev) => [
              ...prev.filter((el) => !toDeleteIds.includes(el.id)),
              ...toCreateElements,
            ]);
            setSelectedElementIds((prev) =>
              prev.filter((id) => !toDeleteIds.includes(id))
            );

            socket.emit('element-delete', { elementIds: toDeleteIds, tabId });
            toCreateElements.forEach((newEl) => {
              socket.emit('element-create', { element: newEl, tabId });
            });
          }
        }
      }
      triggerRedraw();
      return;
    }

    // 1. Check if clicking handles of group bounding box (if >1 elements selected)
    if (selectedElementIds.length > 1) {
      const bbox = getGroupBoundingBox(selectedElementIds);
      if (bbox) {
        const handle = getGroupHandleAtCoords(coords.x, coords.y, bbox, scale);
        if (handle) {
          dragStateRef.current = {
            mode: handle === 'rotate' ? 'group-rotate' : 'group-resize',
            handleType: handle,
            bbox,
            initialMouseX: coords.x,
            initialMouseY: coords.y,
            initialElements: elements.map(el => ({ ...el, properties: { ...el.properties } })),
            lockedIds: [],
          };

          const targetIds = selectedElementIds.filter(id => !locks[id] || locks[id] === currentUser?.id);
          socket.emit('element-lock', { elementIds: targetIds, tabId }, (response) => {
            if (response && response.success && response.lockedIds) {
              if (dragStateRef.current) {
                dragStateRef.current.lockedIds = response.lockedIds;
                setLocks(prev => {
                  const next = { ...prev };
                  response.lockedIds.forEach(id => {
                    next[id] = currentUser.id;
                  });
                  return next;
                });
              }
            }
          });
          return;
        }
      }
    }

    // 2. Check if clicking handles of the currently selected element (if exactly 1 element selected)
    if (selectedElementIds.length === 1) {
      const activeElement = elements.find((el) => el.id === selectedElementIds[0]);
      if (activeElement) {
        const lockHolderId = locks[activeElement.id];
        const isLockedBySomeoneElse = lockHolderId && lockHolderId !== currentUser?.id;

        if (!isLockedBySomeoneElse) {
          const handle = getHandleAtCoords(coords.x, coords.y, activeElement, scale);
          if (handle) {
            // Setup transform drag state
            dragStateRef.current = {
              elementId: activeElement.id,
              mode: handle === 'rotate' ? 'rotate' : 'resize',
              handleType: handle,
              initialWidth: activeElement.width,
              initialHeight: activeElement.height,
              initialX: activeElement.x,
              initialY: activeElement.y,
              initialRotation: activeElement.properties?.rotation || 0,
              initialMouseX: coords.x,
              initialMouseY: coords.y,
              aspectRatio: activeElement.width / activeElement.height,
              hasLock: false,
            };

            // Request socket lock
            socket.emit('element-lock', { elementId: activeElement.id, tabId }, (response) => {
              if (response && response.success) {
                if (dragStateRef.current && dragStateRef.current.elementId === activeElement.id) {
                  dragStateRef.current.hasLock = true;
                  setLocks((prev) => ({ ...prev, [activeElement.id]: currentUser.id }));
                }
              } else {
                dragStateRef.current = null;
              }
            });
            return;
          }
        }
      }
    }

    // 3. Check if clicking an element
    const element = getElementAtCoords(coords.x, coords.y);
    if (element) {
      const lockHolderId = locks[element.id];
      if (lockHolderId && lockHolderId !== currentUser?.id) {
        // Locked by someone else, select it but don't drag
        setSelectedElementIds([element.id]);
        return;
      }

      // If shift is pressed, toggle selection
      if (e.shiftKey) {
        const isSelected = selectedElementIds.includes(element.id);
        const newSelection = isSelected
          ? selectedElementIds.filter(id => id !== element.id)
          : [...selectedElementIds, element.id];
        setSelectedElementIds(newSelection);
        return;
      }

      // If already in selection group (and not shift), we initiate group move for the whole group
      if (selectedElementIds.includes(element.id) && selectedElementIds.length > 1) {
        const bbox = getGroupBoundingBox(selectedElementIds);
        if (bbox) {
          dragStateRef.current = {
            mode: 'group-move',
            bbox,
            offsetX: coords.x,
            offsetY: coords.y,
            initialElements: elements.map(el => ({ ...el, properties: { ...el.properties } })),
            lockedIds: [],
          };

          const targetIds = selectedElementIds.filter(id => !locks[id] || locks[id] === currentUser?.id);
          socket.emit('element-lock', { elementIds: targetIds, tabId }, (response) => {
            if (response && response.success && response.lockedIds) {
              if (dragStateRef.current) {
                dragStateRef.current.lockedIds = response.lockedIds;
                setLocks(prev => {
                  const next = { ...prev };
                  response.lockedIds.forEach(id => {
                    next[id] = currentUser.id;
                  });
                  return next;
                });
              }
            }
          });
          return;
        }
      }

      // Otherwise select just this element and start single move
      setSelectedElementIds([element.id]);

      dragStateRef.current = {
        elementId: element.id,
        mode: 'move',
        offsetX: coords.x - element.x,
        offsetY: coords.y - element.y,
        hasLock: false,
      };

      socket.emit('element-lock', { elementId: element.id, tabId }, (response) => {
        if (response && response.success) {
          if (dragStateRef.current && dragStateRef.current.elementId === element.id) {
            dragStateRef.current.hasLock = true;
            setLocks((prev) => ({ ...prev, [element.id]: currentUser.id }));
          }
        } else {
          if (dragStateRef.current && dragStateRef.current.elementId === element.id) {
            dragStateRef.current = null;
          }
        }
      });
    } else {
      // 4. Clicked on empty space: start drag selection
      if (!e.shiftKey) {
        setSelectedElementIds([]);
      }

      dragStateRef.current = {
        mode: 'select',
        startX: coords.x,
        startY: coords.y,
        currentX: coords.x,
        currentY: coords.y,
        isAddingSelection: e.shiftKey,
        initialSelection: [...selectedElementIds],
      };
    }
  };

  const handleMouseMove = (e) => {
    const coords = getCanvasCoords(e);
    throttleCursorMove(coords.x, coords.y);

    if (activeTool === 'eraser') {
      eraserHoverRef.current = coords;
      triggerRedraw();
    }

    const drag = dragStateRef.current;
    if (drag) {
      if (hoveredElementId !== null) {
        setHoveredElementId(null);
      }
      if (drag.mode === 'draw') {
        if (tempDrawingPathRef.current) {
          tempDrawingPathRef.current.points.push(coords);
          triggerRedraw();
        }
        return;
      }

      if (drag.mode === 'erase') {
        const socket = socketRef.current;
        const eraserRad = eraserSize / 2;
        const elementsToErase = elements.filter(
          (el) => el.type === 'path' && checkEraserIntersectsPath(coords.x, coords.y, eraserRad, el)
        );

        if (elementsToErase.length > 0) {
          const unlockableElements = elementsToErase.filter((el) => {
            const lockHolderId = locks[el.id];
            return !lockHolderId || lockHolderId === currentUser?.id;
          });

          if (unlockableElements.length > 0) {
            const toDeleteIds = [];
            const toCreateElements = [];

            unlockableElements.forEach((el) => {
              const subPaths = splitPathElement(coords.x, coords.y, eraserRad, el);
              toDeleteIds.push(el.id);
              toCreateElements.push(...subPaths);
            });

            if (toDeleteIds.length > 0) {
              setElements((prev) => [
                ...prev.filter((el) => !toDeleteIds.includes(el.id)),
                ...toCreateElements,
              ]);
              setSelectedElementIds((prev) =>
                prev.filter((id) => !toDeleteIds.includes(id))
              );

              if (socket && socket.connected) {
                socket.emit('element-delete', { elementIds: toDeleteIds, tabId });
                toCreateElements.forEach((newEl) => {
                  socket.emit('element-create', { element: newEl, tabId });
                });
              }
            }
          }
        }
        return;
      }


      if (drag.mode === 'select') {
        drag.currentX = coords.x;
        drag.currentY = coords.y;
        triggerRedraw();
        return;
      }

      let updatesBatch = [];

      if (drag.mode === 'group-move') {
        const dx = Math.round(coords.x - drag.offsetX);
        const dy = Math.round(coords.y - drag.offsetY);

        const activeIds = drag.lockedIds.length > 0
          ? drag.lockedIds
          : selectedElementIds.filter(id => !locks[id] || locks[id] === currentUser?.id);

        updatesBatch = activeIds.map((id) => {
          const initEl = drag.initialElements.find(item => item.id === id);
          if (!initEl) return null;
          return {
            elementId: id,
            updates: {
              x: initEl.x + dx,
              y: initEl.y + dy,
            }
          };
        }).filter(Boolean);
      }
      else if (drag.mode === 'group-rotate') {
        const cx = drag.bbox.cx;
        const cy = drag.bbox.cy;
        const initialAngle = Math.atan2(drag.initialMouseY - cy, drag.initialMouseX - cx);
        const currentAngle = Math.atan2(coords.y - cy, coords.x - cx);
        const deltaAngle = currentAngle - initialAngle;

        const activeIds = drag.lockedIds.length > 0
          ? drag.lockedIds
          : selectedElementIds.filter(id => !locks[id] || locks[id] === currentUser?.id);

        updatesBatch = activeIds.map((id) => {
          const initEl = drag.initialElements.find(item => item.id === id);
          if (!initEl) return null;

          const elW = initEl.width;
          const elH = initEl.height;
          const elCx = initEl.x + elW / 2;
          const elCy = initEl.y + elH / 2;

          const rx = elCx - cx;
          const ry = elCy - cy;
          const newCx = cx + rx * Math.cos(deltaAngle) - ry * Math.sin(deltaAngle);
          const newCy = cy + rx * Math.sin(deltaAngle) + ry * Math.cos(deltaAngle);

          const newRotation = (initEl.properties?.rotation || 0) + deltaAngle;

          return {
            elementId: id,
            updates: {
              x: Math.round(newCx - elW / 2),
              y: Math.round(newCy - elH / 2),
              properties: {
                ...initEl.properties,
                rotation: newRotation,
              }
            }
          };
        }).filter(Boolean);
      }
      else if (drag.mode === 'group-resize') {
        const dx = coords.x - drag.initialMouseX;
        const dy = coords.y - drag.initialMouseY;
        const bbox = drag.bbox;

        let scaleX = 1;
        let scaleY = 1;

        if (drag.handleType === 'nw') {
          scaleX = (bbox.width - dx) / bbox.width;
          scaleY = (bbox.height - dy) / bbox.height;
        } else if (drag.handleType === 'ne') {
          scaleX = (bbox.width + dx) / bbox.width;
          scaleY = (bbox.height - dy) / bbox.height;
        } else if (drag.handleType === 'se') {
          scaleX = (bbox.width + dx) / bbox.width;
          scaleY = (bbox.height + dy) / bbox.height;
        } else if (drag.handleType === 'sw') {
          scaleX = (bbox.width - dx) / bbox.width;
          scaleY = (bbox.height + dy) / bbox.height;
        }

        scaleX = Math.max(scaleX, 0.05);
        scaleY = Math.max(scaleY, 0.05);

        const activeIds = drag.lockedIds.length > 0
          ? drag.lockedIds
          : selectedElementIds.filter(id => !locks[id] || locks[id] === currentUser?.id);

        updatesBatch = activeIds.map((id) => {
          const initEl = drag.initialElements.find(item => item.id === id);
          if (!initEl) return null;

          const elW = initEl.width;
          const elH = initEl.height;
          const elCx = initEl.x + elW / 2;
          const elCy = initEl.y + elH / 2;

          let newW = Math.round(elW * scaleX);
          let newH = Math.round(elH * scaleY);
          newW = Math.max(newW, 10);
          newH = Math.max(newH, 10);

          const rx = elCx - bbox.cx;
          const ry = elCy - bbox.cy;
          const newCx = bbox.cx + rx * scaleX;
          const newCy = bbox.cy + ry * scaleY;

          return {
            elementId: id,
            updates: {
              x: Math.round(newCx - newW / 2),
              y: Math.round(newCy - newH / 2),
              width: newW,
              height: newH,
            }
          };
        }).filter(Boolean);
      }
      else {
        // Single element transform
        const element = elements.find((el) => el.id === drag.elementId);
        if (!element) return;

        let updates = {};

        if (drag.mode === 'move') {
          const newX = Math.round(coords.x - drag.offsetX);
          const newY = Math.round(coords.y - drag.offsetY);
          updates = { x: newX, y: newY };
        } else if (drag.mode === 'rotate') {
          const cx = drag.initialX + drag.initialWidth / 2;
          const cy = drag.initialY + drag.initialHeight / 2;
          const currentAngle = Math.atan2(coords.y - cy, coords.x - cx) + Math.PI / 2;
          updates = {
            properties: {
              ...element.properties,
              rotation: currentAngle,
            },
          };
        } else if (drag.mode === 'resize') {
          const cx = drag.initialX + drag.initialWidth / 2;
          const cy = drag.initialY + drag.initialHeight / 2;
          const dx = coords.x - cx;
          const dy = coords.y - cy;
          const rad = drag.initialRotation;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);

          const lx = dx * cos + dy * sin;
          const ly = -dx * sin + dy * cos;

          let signX = 1;
          let signY = 1;
          if (drag.handleType === 'nw') { signX = -1; signY = -1; }
          else if (drag.handleType === 'ne') { signX = 1; signY = -1; }
          else if (drag.handleType === 'sw') { signX = -1; signY = 1; }
          else if (drag.handleType === 'se') { signX = 1; signY = 1; }

          let newWidth = Math.max(Math.round(2 * lx * signX), 24);
          let newHeight = Math.max(Math.round(2 * ly * signY), 24);

          if (element.type === 'image') {
            const scale = Math.max(newWidth / drag.initialWidth, newHeight / drag.initialHeight);
            newWidth = Math.round(drag.initialWidth * scale);
            newHeight = Math.round(drag.initialHeight * scale);
          }

          const newX = Math.round(cx - newWidth / 2);
          const newY = Math.round(cy - newHeight / 2);

          updates = {
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
          };
        }

        updatesBatch = [{ elementId: drag.elementId, updates }];
      }

      if (updatesBatch.length > 0) {
        // Optimistic local state update
        setElements((prev) =>
          prev.map((el) => {
            const match = updatesBatch.find((u) => u.elementId === el.id);
            if (match) {
              return {
                ...el,
                ...match.updates,
                properties: {
                  ...(el.properties || {}),
                  ...(match.updates.properties || {}),
                },
              };
            }
            return el;
          })
        );

        // Emit updates to the server once lock is acquired
        const socket = socketRef.current;
        if (socket && socket.connected) {
          if (drag.mode.startsWith('group-')) {
            const unlockedBatch = updatesBatch.filter((item) => {
              return drag.lockedIds.includes(item.elementId) || !locks[item.elementId] || locks[item.elementId] === currentUser?.id;
            });
            if (unlockedBatch.length > 0) {
              socket.emit('element-update', { batch: unlockedBatch, tabId });
            }
          } else if (drag.hasLock) {
            socket.emit('element-update', {
              elementId: drag.elementId,
              updates: updatesBatch[0].updates,
              tabId,
            });
          }
        }
      }
    } else {
      const hovered = getHoveredElement(coords.x, coords.y);
      if (hovered && hovered.properties?.tooltip?.enabled) {
        if (hoveredElementId !== hovered.id) {
          setHoveredElementId(hovered.id);
        }
      } else {
        if (hoveredElementId !== null) {
          setHoveredElementId(null);
        }
      }
    }
  };

  const handleMouseUp = () => {
    const drag = dragStateRef.current;
    if (drag) {
      if (drag.mode === 'draw') {
        const strokePath = tempDrawingPathRef.current;
        if (strokePath && strokePath.points && strokePath.points.length > 1) {
          // Calculate bounding box boundaries of the raw drawn points
          let minX = Infinity;
          let maxX = -Infinity;
          let minY = Infinity;
          let maxY = -Infinity;

          strokePath.points.forEach((p) => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          });

          // Ensure width and height are non-zero to avoid division by zero
          const w = Math.max(maxX - minX, 4);
          const h = Math.max(maxY - minY, 4);

          // Normalize the raw points relative to the bounding box
          const normalizedPoints = strokePath.points.map((p) => ({
            x: (p.x - minX) / w,
            y: (p.y - minY) / h,
          }));

          const id = `el_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          const element = {
            id,
            type: 'path',
            x: minX,
            y: minY,
            width: w,
            height: h,
            properties: {
              points: normalizedPoints,
              stroke: strokePath.stroke,
              strokeWidth: strokePath.strokeWidth,
              rotation: 0,
            },
          };

          // Optimistically update locally
          setElements((prev) => [...prev, element]);

          // Emit to server
          const socket = socketRef.current;
          if (socket && socket.connected) {
            socket.emit('element-create', { element, tabId });
          }
        }
        tempDrawingPathRef.current = null;
        dragStateRef.current = null;
        triggerRedraw();
        return;
      }

      if (drag.mode === 'erase') {
        dragStateRef.current = null;
        triggerRedraw();
        return;
      }

      if (drag.mode === 'select') {
        const minX = Math.min(drag.startX, drag.currentX);
        const maxX = Math.max(drag.startX, drag.currentX);
        const minY = Math.min(drag.startY, drag.currentY);
        const maxY = Math.max(drag.startY, drag.currentY);

        const width = maxX - minX;
        const height = maxY - minY;

        if (width > 3 || height > 3) {
          const intersectingIds = [];
          elements.forEach((el) => {
            if (el.properties?.locked) return;
            if (checkElementIntersectsBox(el, minX, maxX, minY, maxY)) {
              intersectingIds.push(el.id);
            }
          });

          if (drag.isAddingSelection) {
            setSelectedElementIds((prev) => {
              const next = [...prev];
              intersectingIds.forEach((id) => {
                if (!next.includes(id)) {
                  next.push(id);
                }
              });
              return next;
            });
          } else {
            setSelectedElementIds(intersectingIds);
          }
        } else {
          if (!drag.isAddingSelection) {
            setSelectedElementIds([]);
          }
        }
      } else if (drag.mode.startsWith('group-')) {
        const activeIds = drag.lockedIds.length > 0
          ? drag.lockedIds
          : selectedElementIds.filter(id => locks[id] === currentUser?.id);

        if (activeIds.length > 0) {
          const socket = socketRef.current;
          if (socket && socket.connected) {
            socket.emit('element-unlock', { elementIds: activeIds, tabId });
          }
          setLocks((prev) => {
            const next = { ...prev };
            activeIds.forEach((id) => {
              delete next[id];
            });
            return next;
          });
        }
      } else if (drag.hasLock) {
        const socket = socketRef.current;
        if (socket && socket.connected) {
          socket.emit('element-unlock', { elementId: drag.elementId, tabId });
        }
        setLocks((prev) => {
          const next = { ...prev };
          delete next[drag.elementId];
          return next;
        });
      }
      dragStateRef.current = null;
      triggerRedraw();
    }
  };

  const handleMouseLeave = () => {
    setHoveredElementId(null);
    eraserHoverRef.current = null;
    handleMouseUp();
  };

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const { scale, offsetX, offsetY } = getViewportTransform();
    return {
      x: Math.round((screenX - offsetX) / scale),
      y: Math.round((screenY - offsetY) / scale),
    };
  };

  const { scale, offsetX, offsetY } = getViewportTransform();

  const hoveredElement = hoveredElementId ? elements.find((el) => el.id === hoveredElementId) : null;
  const showTooltip = hoveredElement && hoveredElement.properties?.tooltip?.enabled;

  let tooltipLeft = 0;
  let tooltipTop = 0;
  let isFlipped = false;

  if (showTooltip) {
    const cx = hoveredElement.x + hoveredElement.width / 2;
    const screenCx = offsetX + cx * scale;
    const screenTopY = offsetY + hoveredElement.y * scale;
    const screenH = hoveredElement.height * scale;

    tooltipLeft = screenCx;

    // Flip if too close to the top boundary
    if (screenTopY < 165) {
      tooltipTop = screenTopY + screenH + 10;
      isFlipped = true;
    } else {
      tooltipTop = screenTopY - 10;
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-[#0b0f19] select-none overflow-hidden border border-slate-800/80 rounded-xl shadow-inner shadow-black/50 ${
        activeTool === 'pen'
          ? 'cursor-crosshair'
          : activeTool === 'eraser'
          ? 'cursor-none'
          : 'cursor-default'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Floating Tooltip Card */}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltipLeft,
            top: tooltipTop,
            transform: isFlipped ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            zIndex: 40,
            pointerEvents: 'none',
          }}
          className="w-64 p-4 rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-800/80 text-left shadow-2xl flex flex-col gap-3 transition-all duration-150 select-none"
        >
          {/* Header/Title */}
          <div className="border-b border-slate-800/85 pb-1.5 flex items-center justify-between">
            <span className="font-bold text-slate-100 text-sm truncate max-w-[190px]">
              {hoveredElement.properties.tooltip.title || (hoveredElement.type.charAt(0).toUpperCase() + hoveredElement.type.slice(1))}
            </span>
            <span className="text-[9px] text-sky-400/80 bg-sky-500/10 px-1.5 py-0.5 rounded font-mono uppercase">
              {hoveredElement.type}
            </span>
          </div>

          {/* Trackers / Bars */}
          {hoveredElement.properties.tooltip.trackers && hoveredElement.properties.tooltip.trackers.length > 0 && (
            <div className="space-y-2.5">
              {hoveredElement.properties.tooltip.trackers.map((tracker) => {
                const val = Number(tracker.value) || 0;
                const max = Number(tracker.max) || 10;
                const pct = max > 0 ? Math.min(Math.max(val / max, 0), 1) : 0;
                
                const bgMap = {
                  red: 'bg-red-500',
                  green: 'bg-emerald-500',
                  blue: 'bg-blue-500',
                  amber: 'bg-amber-500',
                  purple: 'bg-purple-500',
                  rose: 'bg-rose-500',
                };
                
                return (
                  <div key={tracker.id} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                      <span className="uppercase tracking-wider truncate max-w-[120px]">{tracker.label}</span>
                      <span className="font-mono text-slate-300">
                        {val} <span className="text-slate-600">/</span> {max}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded bg-slate-900 overflow-hidden border border-slate-800/40">
                      <div
                        style={{ width: `${pct * 100}%` }}
                        className={`h-full rounded transition-all duration-300 ${bgMap[tracker.color] || 'bg-red-500'}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Key-Value Stats capsules */}
          {hoveredElement.properties.tooltip.stats && hoveredElement.properties.tooltip.stats.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-800/50">
              {hoveredElement.properties.tooltip.stats.map((stat) => (
                <div
                  key={stat.id}
                  className="px-2 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800/60 flex flex-col min-w-0"
                >
                  <span className="text-[8px] font-extrabold text-slate-500 uppercase tracking-widest truncate">
                    {stat.label}
                  </span>
                  <span className="text-xs font-bold text-slate-200 truncate mt-0.5">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Render active cursors with names */}
      {users
        .filter((u) => u.id !== currentUser?.id && (u.activeTabId || 'tab-default') === tabId)
        .map((user) => {
          if (user.x === undefined || user.y === undefined) return null;

          const screenX = offsetX + user.x * scale;
          const screenY = offsetY + user.y * scale;

          return (
            <div
              key={user.id}
              style={{
                position: 'absolute',
                left: screenX,
                top: screenY,
                pointerEvents: 'none',
                transform: 'translate(-2px, -2px)',
                zIndex: 50,
              }}
              className="transition-all duration-75 ease-out select-none"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="filter drop-shadow-md"
              >
                <path
                  d="M1 1V11.5L4.5 8L7.5 13.5L9.5 12.5L6.5 7L11 6.5L1 1Z"
                  fill={user.color || '#f43f5e'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              <div
                style={{ backgroundColor: user.color || '#f43f5e' }}
                className="ml-4 mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-white whitespace-nowrap shadow-md border border-white/20 flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                <span>{user.name}</span>
              </div>
            </div>
          );
        })}

      {/* Floating Zoom & Pan Reset Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 shadow-lg select-none">
        <button
          type="button"
          onClick={() => {
            setUserZoom((prev) => Math.max(0.5, prev - 0.1));
            triggerRedraw();
          }}
          className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition flex items-center justify-center font-bold text-lg select-none cursor-pointer active:scale-95"
          title="Zoom Out"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => {
            setUserZoom(1);
            setPanOffset({ x: 0, y: 0 });
            triggerRedraw();
          }}
          className="px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-slate-200 transition flex items-center justify-center text-xs font-semibold select-none cursor-pointer active:scale-95"
          title="Reset Zoom & Pan to Fit Screen"
        >
          {Math.round(userZoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => {
            setUserZoom((prev) => Math.min(8.0, prev + 0.1));
            triggerRedraw();
          }}
          className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition flex items-center justify-center font-bold text-lg select-none cursor-pointer active:scale-95"
          title="Zoom In"
        >
          +
        </button>
      </div>
    </div>
  );
}
