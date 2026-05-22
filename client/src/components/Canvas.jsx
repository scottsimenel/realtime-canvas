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

  // Trigger state update to force re-render/redraw on asynchronous assets (like images) loading
  const triggerRedraw = useCallback(() => {
    setRedrawTrigger((prev) => prev + 1);
  }, []);

  // Get image from cache or load it
  const getOrLoadImage = useCallback((url) => {
    if (!url) return null;
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
  const getHandleAtCoords = useCallback((x, y, element) => {
    const local = getLocalCoords(x, y, element);
    const w = element.width;
    const h = element.height;
    const r = 10; // hit tolerance radius

    // NW
    if (Math.hypot(local.x - (-w / 2 - 4), local.y - (-h / 2 - 4)) <= r) return 'nw';
    // NE
    if (Math.hypot(local.x - (w / 2 + 4), local.y - (-h / 2 - 4)) <= r) return 'ne';
    // SE
    if (Math.hypot(local.x - (w / 2 + 4), local.y - (h / 2 + 4)) <= r) return 'se';
    // SW
    if (Math.hypot(local.x - (-w / 2 - 4), local.y - (h / 2 + 4)) <= r) return 'sw';
    // Rotation handle (24px above top edge)
    if (Math.hypot(local.x - 0, local.y - (-h / 2 - 24)) <= r) return 'rotate';

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

  const getGroupHandleAtCoords = useCallback((mx, my, bbox) => {
    if (!bbox) return null;
    const r = 10; // hit tolerance radius

    // NW
    if (Math.hypot(mx - (bbox.x - 4), my - (bbox.y - 4)) <= r) return 'nw';
    // NE
    if (Math.hypot(mx - (bbox.x + bbox.width + 4), my - (bbox.y - 4)) <= r) return 'ne';
    // SE
    if (Math.hypot(mx - (bbox.x + bbox.width + 4), my - (bbox.y + bbox.height + 4)) <= r) return 'se';
    // SW
    if (Math.hypot(mx - (bbox.x - 4), my - (bbox.y + bbox.height + 4)) <= r) return 'sw';
    // Rotation handle (24px above top edge)
    if (Math.hypot(mx - bbox.cx, my - (bbox.y - 24)) <= r) return 'rotate';

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
      backgroundMode = 'fill',
      showGrid = true,
      gridType = 'square',
      gridSize = 40,
    } = roomSettings || {};

    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Track whether a background image is actually drawn to adjust grid color
    let isBackgroundDrawn = false;

    // Draw background image
    if (showBackground && backgroundImageUrl) {
      const bgImg = getOrLoadImage(backgroundImageUrl);
      if (bgImg && bgImg.width > 0) {
        isBackgroundDrawn = true;
        ctx.save();
        
        const canvasAspect = canvasSize.width / canvasSize.height;
        const imageAspect = bgImg.width / bgImg.height;
        let drawW, drawH, drawX, drawY;

        if (backgroundMode === 'stretch') {
          drawW = canvasSize.width;
          drawH = canvasSize.height;
          drawX = 0;
          drawY = 0;
        } else if (backgroundMode === 'fit') {
          // Aspect-fit (Contain)
          if (imageAspect > canvasAspect) {
            drawW = canvasSize.width;
            drawH = canvasSize.width / imageAspect;
            drawX = 0;
            drawY = (canvasSize.height - drawH) / 2;
          } else {
            drawH = canvasSize.height;
            drawW = canvasSize.height * imageAspect;
            drawX = (canvasSize.width - drawW) / 2;
            drawY = 0;
          }
        } else {
          // Aspect-fill (Cover) - default
          if (imageAspect > canvasAspect) {
            drawH = canvasSize.height;
            drawW = canvasSize.height * imageAspect;
            drawX = (canvasSize.width - drawW) / 2;
            drawY = 0;
          } else {
            drawW = canvasSize.width;
            drawH = canvasSize.width / imageAspect;
            drawX = 0;
            drawY = (canvasSize.height - drawH) / 2;
          }
        }

        ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);
        ctx.restore();
      }
    }

    // Draw grid background if enabled
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = isBackgroundDrawn ? '#47556960' : '#1e293b';
      ctx.lineWidth = 1;

      if (gridType === 'hexagon') {
        const R = gridSize;
        const hSpacing = 1.5 * R;
        const vSpacing = Math.sqrt(3) * R;

        const cols = Math.ceil(canvasSize.width / hSpacing) + 2;
        const rows = Math.ceil(canvasSize.height / vSpacing) + 2;

        ctx.beginPath();
        for (let col = -1; col < cols; col++) {
          const cx = col * hSpacing;
          const isOdd = Math.abs(col) % 2 === 1;
          const yOffset = isOdd ? vSpacing / 2 : 0;
          
          for (let row = -1; row < rows; row++) {
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
        for (let x = 0; x < canvasSize.width; x += gridSpacing) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvasSize.height);
        }
        for (let y = 0; y < canvasSize.height; y += gridSpacing) {
          ctx.moveTo(0, y);
          ctx.lineTo(canvasSize.width, y);
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
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(
          -w / 2 - 6,
          -h / 2 - 6,
          w + 12,
          h + 12
        );
        ctx.setLineDash([]); // Reset dash

        // Draw padlock icon or text banner
        if (isLockedByOther && lockHolder) {
          ctx.fillStyle = lockColor;
          ctx.font = '500 11px Inter, system-ui, sans-serif';
          const labelText = `🔒 Locked by ${lockHolder.name}`;
          const textWidth = ctx.measureText(labelText).width;

          // Draw label background card
          ctx.fillRect(
            -w / 2 - 6,
            -h / 2 - 30,
            textWidth + 12,
            20
          );

          // Draw label text
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, -w / 2, -h / 2 - 20);
        } else if (isLockedByMe) {
          ctx.fillStyle = lockColor;
          ctx.font = '500 11px Inter, system-ui, sans-serif';
          const labelText = '✨ Transforming';
          const textWidth = ctx.measureText(labelText).width;

          ctx.fillRect(
            -w / 2 - 6,
            -h / 2 - 30,
            textWidth + 12,
            20
          );

          // Draw label text
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, -w / 2, -h / 2 - 20);
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

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rad);

      ctx.strokeStyle = '#38bdf8'; // sky-400
      ctx.lineWidth = 1;

      // Draw individual handles only if exactly 1 element is selected
      if (selectedElementIds.length === 1) {
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);

        // Rotation handle line
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -h / 2 - 4);
        ctx.lineTo(0, -h / 2 - 24);
        ctx.stroke();

        // Rotation handle circle
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, -h / 2 - 24, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Corner handles
        const handleSize = 7;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;

        // Top-Left
        ctx.fillRect(-w / 2 - 4 - handleSize / 2, -h / 2 - 4 - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(-w / 2 - 4 - handleSize / 2, -h / 2 - 4 - handleSize / 2, handleSize, handleSize);
        // Top-Right
        ctx.fillRect(w / 2 + 4 - handleSize / 2, -h / 2 - 4 - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(w / 2 + 4 - handleSize / 2, -h / 2 - 4 - handleSize / 2, handleSize, handleSize);
        // Bottom-Right
        ctx.fillRect(w / 2 + 4 - handleSize / 2, h / 2 + 4 - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(w / 2 + 4 - handleSize / 2, h / 2 + 4 - handleSize / 2, handleSize, handleSize);
        // Bottom-Left
        ctx.fillRect(-w / 2 - 4 - handleSize / 2, h / 2 + 4 - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(-w / 2 - 4 - handleSize / 2, h / 2 + 4 - handleSize / 2, handleSize, handleSize);
      } else {
        // Draw simple selection outline if in a group
        ctx.strokeRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
      }

      ctx.restore();
    });

    // Draw unified group bounding box & handles if selectedElementIds.length > 1
    if (selectedElementIds.length > 1) {
      const bbox = getGroupBoundingBox(selectedElementIds);
      if (bbox) {
        ctx.save();
        ctx.strokeStyle = '#0ea5e9'; // sky-500
        ctx.lineWidth = 1.5;
        // Group bounding box outline
        ctx.strokeRect(bbox.x - 4, bbox.y - 4, bbox.width + 8, bbox.height + 8);

        // Rotation stem
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bbox.cx, bbox.y - 4);
        ctx.lineTo(bbox.cx, bbox.y - 24);
        ctx.stroke();

        // Rotation circle
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bbox.cx, bbox.y - 24, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Corner handles
        const handleSize = 7;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 1.5;

        // Top-Left
        ctx.fillRect(bbox.x - 4 - handleSize / 2, bbox.y - 4 - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(bbox.x - 4 - handleSize / 2, bbox.y - 4 - handleSize / 2, handleSize, handleSize);
        // Top-Right
        ctx.fillRect(bbox.x + bbox.width + 4 - handleSize / 2, bbox.y - 4 - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(bbox.x + bbox.width + 4 - handleSize / 2, bbox.y - 4 - handleSize / 2, handleSize, handleSize);
        // Bottom-Right
        ctx.fillRect(bbox.x + bbox.width + 4 - handleSize / 2, bbox.y + bbox.height + 4 - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(bbox.x + bbox.width + 4 - handleSize / 2, bbox.y + bbox.height + 4 - handleSize / 2, handleSize, handleSize);
        // Bottom-Left
        ctx.fillRect(bbox.x - 4 - handleSize / 2, bbox.y + bbox.height + 4 - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(bbox.x - 4 - handleSize / 2, bbox.y + bbox.height + 4 - handleSize / 2, handleSize, handleSize);

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
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
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
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.fillStyle = 'rgba(14, 165, 233, 0.08)'; // 8% opacity sky blue

      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
  }, [canvasSize, elements, locks, users, currentUser, getOrLoadImage, selectedElementIds, getGroupBoundingBox, activeTool, eraserSize, roomSettings]);

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
            const lockHolderId = locks[id];
            return !lockHolderId || lockHolderId === currentUser?.id;
          });

          if (unlockedIds.length === 0) return;

          socket.emit('element-delete', { elementIds: unlockedIds }, (response) => {
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
  }, [selectedElementIds, locks, currentUser, socketRef, setElements, setSelectedElementIds]);

  const handleMouseDown = (e) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    const coords = getCanvasCoords(e);

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

            socket.emit('element-delete', { elementIds: toDeleteIds });
            toCreateElements.forEach((newEl) => {
              socket.emit('element-create', { element: newEl });
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
        const handle = getGroupHandleAtCoords(coords.x, coords.y, bbox);
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
          socket.emit('element-lock', { elementIds: targetIds }, (response) => {
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
          const handle = getHandleAtCoords(coords.x, coords.y, activeElement);
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
            socket.emit('element-lock', { elementId: activeElement.id }, (response) => {
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
          socket.emit('element-lock', { elementIds: targetIds }, (response) => {
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

      socket.emit('element-lock', { elementId: element.id }, (response) => {
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
                socket.emit('element-delete', { elementIds: toDeleteIds });
                toCreateElements.forEach((newEl) => {
                  socket.emit('element-create', { element: newEl });
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
              socket.emit('element-update', { batch: unlockedBatch });
            }
          } else if (drag.hasLock) {
            socket.emit('element-update', {
              elementId: drag.elementId,
              updates: updatesBatch[0].updates,
            });
          }
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
            socket.emit('element-create', { element });
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
            socket.emit('element-unlock', { elementIds: activeIds });
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
          socket.emit('element-unlock', { elementId: drag.elementId });
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
    eraserHoverRef.current = null;
    handleMouseUp();
  };

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
    };
  };

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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Render active cursors with names */}
      {users
        .filter((u) => u.id !== currentUser?.id)
        .map((user) => {
          if (user.x === undefined || user.y === undefined) return null;

          return (
            <div
              key={user.id}
              style={{
                position: 'absolute',
                left: user.x,
                top: user.y,
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
    </div>
  );
}
