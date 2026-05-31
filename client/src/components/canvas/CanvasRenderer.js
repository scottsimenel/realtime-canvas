/**
 * High-DPI HTML5 2D Canvas rendering layers.
 * Draws backgrounds, square/hexagon grids, elements (rectangles, circles, custom paths, images),
 * transform overlays, selections, and local pointer feedback.
 */

// Draw background image
export const drawBackground = (ctx, showBackground, backgroundImageUrl, getOrLoadImage, virtualWidth, virtualHeight) => {
  if (showBackground && backgroundImageUrl) {
    const bgImg = getOrLoadImage(backgroundImageUrl);
    if (bgImg && bgImg.width > 0) {
      ctx.drawImage(bgImg, 0, 0, virtualWidth, virtualHeight);
      return true;
    }
  }
  return false;
};

// Draw grid background if enabled
export const drawGrid = (ctx, showGrid, gridType, gridSize, isBackgroundDrawn, virtualWidth, virtualHeight, scale) => {
  if (!showGrid) return;
  
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
};

// Draw element shapes
export const drawElements = (ctx, elements, locks, users, currentUser, getOrLoadImage, scale) => {
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

    // Draw lock highlighting
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
      ctx.setLineDash([]);

      if (isLockedByOther && lockHolder) {
        ctx.fillStyle = lockColor;
        ctx.font = `500 ${11 / scale}px Inter, system-ui, sans-serif`;
        const labelText = `🔒 Locked by ${lockHolder.name}`;
        const textWidth = ctx.measureText(labelText).width;

        ctx.fillRect(
          -w / 2 - 6 / scale,
          -h / 2 - 30 / scale,
          textWidth + 12 / scale,
          20 / scale
        );

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

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, -w / 2, -h / 2 - 20 / scale);
      }
    }

    // Draw tooltip info icon in top-right corner if enabled
    if (element.properties?.tooltip?.enabled) {
      ctx.save();
      ctx.translate(w / 2 - 10 / scale, -h / 2 + 10 / scale);
      
      ctx.beginPath();
      ctx.arc(0, 0, 7 / scale, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.lineWidth = 1 / scale;
      ctx.stroke();
      
      ctx.fillStyle = '#38bdf8';
      ctx.font = `bold ${8 / scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('i', 0, -0.5 / scale);
      
      ctx.restore();
    }

    // Draw canvas-visible tracker bars below the element bounds
    if (element.properties?.tooltip?.enabled) {
      const trackers = element.properties.tooltip.trackers || [];
      const canvasTrackers = trackers.filter(t => t.showOnCanvas);
      if (canvasTrackers.length > 0) {
        const barHeight = 5 / scale;
        const barWidth = w;
        let startY = h / 2 + 6 / scale;
        
        canvasTrackers.forEach((tracker) => {
          const val = Number(tracker.value) || 0;
          const max = Number(tracker.max) || 10;
          const pct = max > 0 ? Math.min(Math.max(val / max, 0), 1) : 0;
          
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.fillRect(-barWidth / 2, startY, barWidth, barHeight);
          
          let fillColor = '#ef4444';
          if (tracker.color === 'green') fillColor = '#10b981';
          else if (tracker.color === 'blue') fillColor = '#3b82f6';
          else if (tracker.color === 'yellow' || tracker.color === 'amber') fillColor = '#f59e0b';
          else if (tracker.color === 'purple') fillColor = '#8b5cf6';
          else if (tracker.color === 'rose') fillColor = '#f43f5e';
          
          ctx.fillStyle = fillColor;
          ctx.fillRect(-barWidth / 2, startY, barWidth * pct, barHeight);
          
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1 / scale;
          ctx.strokeRect(-barWidth / 2, startY, barWidth, barHeight);
          
          startY += barHeight + 3 / scale;
        });
      }
    }

    ctx.restore();
  });
};

// Draw outlines for selection group
export const drawSelectionOutlines = (ctx, selectedElementIds, elements, getGroupBoundingBox, scale) => {
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

    if (selectedElementIds.length === 1) {
      ctx.lineWidth = 1.5 / scale;
      ctx.strokeRect(-w / 2 - 4 / scale, -h / 2 - 4 / scale, w + 8 / scale, h + 8 / scale);

      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1 / scale;
      ctx.beginPath();
      ctx.moveTo(0, -h / 2 - 4 / scale);
      ctx.lineTo(0, -h / 2 - 24 / scale);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.5 / scale;
      ctx.beginPath();
      ctx.arc(0, -h / 2 - 24 / scale, 5 / scale, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      const handleSize = 7 / scale;
      const offset = 4 / scale;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.5 / scale;

      ctx.fillRect(-w / 2 - offset - handleSize / 2, -h / 2 - offset - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(-w / 2 - offset - handleSize / 2, -h / 2 - offset - handleSize / 2, handleSize, handleSize);

      ctx.fillRect(w / 2 + offset - handleSize / 2, -h / 2 - offset - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(w / 2 + offset - handleSize / 2, -h / 2 - offset - handleSize / 2, handleSize, handleSize);

      ctx.fillRect(w / 2 + offset - handleSize / 2, h / 2 + offset - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(w / 2 + offset - handleSize / 2, h / 2 + offset - handleSize / 2, handleSize, handleSize);

      ctx.fillRect(-w / 2 - offset - handleSize / 2, h / 2 + offset - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(-w / 2 - offset - handleSize / 2, h / 2 + offset - handleSize / 2, handleSize, handleSize);
    } else {
      ctx.strokeRect(-w / 2 - 2 / scale, -h / 2 - 2 / scale, w + 4 / scale, h + 4 / scale);
    }

    ctx.restore();
  });

  if (selectedElementIds.length > 1) {
    const bbox = getGroupBoundingBox(selectedElementIds, elements);
    if (bbox) {
      ctx.save();
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 1.5 / scale;
      ctx.strokeRect(bbox.x - 4 / scale, bbox.y - 4 / scale, bbox.width + 8 / scale, bbox.height + 8 / scale);

      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 1 / scale;
      ctx.beginPath();
      ctx.moveTo(bbox.cx, bbox.y - 4 / scale);
      ctx.lineTo(bbox.cx, bbox.y - 24 / scale);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 1.5 / scale;
      ctx.beginPath();
      ctx.arc(bbox.cx, bbox.y - 24 / scale, 5 / scale, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      const handleSize = 7 / scale;
      const offset = 4 / scale;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 1.5 / scale;

      ctx.fillRect(bbox.x - offset - handleSize / 2, bbox.y - offset - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(bbox.x - offset - handleSize / 2, bbox.y - offset - handleSize / 2, handleSize, handleSize);

      ctx.fillRect(bbox.x + bbox.width + offset - handleSize / 2, bbox.y - offset - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(bbox.x + bbox.width + offset - handleSize / 2, bbox.y - offset - handleSize / 2, handleSize, handleSize);

      ctx.fillRect(bbox.x + bbox.width + offset - handleSize / 2, bbox.y + bbox.height + offset - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(bbox.x + bbox.width + offset - handleSize / 2, bbox.y + bbox.height + offset - handleSize / 2, handleSize, handleSize);

      ctx.fillRect(bbox.x - offset - handleSize / 2, bbox.y + bbox.height + offset - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(bbox.x - offset - handleSize / 2, bbox.y + bbox.height + offset - handleSize / 2, handleSize, handleSize);

      ctx.restore();
    }
  }
};

// Draw active local drawing stroke
export const drawActiveLocalStroke = (ctx, tempDrawingPathRef) => {
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
};

// Draw eraser circular cursor indicator
export const drawEraserCursor = (ctx, activeTool, eraserHoverRef, eraserSize, scale) => {
  if (activeTool === 'eraser' && eraserHoverRef.current) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.5 / scale;
    ctx.setLineDash([4 / scale, 4 / scale]);
    const eraserRad = eraserSize / 2;
    ctx.arc(eraserHoverRef.current.x, eraserHoverRef.current.y, eraserRad, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }
};

// Draw drag-select box
export const drawDragSelectBox = (ctx, dragStateRef, scale) => {
  const drag = dragStateRef.current;
  if (drag && drag.mode === 'select') {
    const x = Math.min(drag.startX, drag.currentX);
    const y = Math.min(drag.startY, drag.currentY);
    const w = Math.abs(drag.startX - drag.currentX);
    const h = Math.abs(drag.startY - drag.currentY);

    ctx.save();
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 1.5 / scale;
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';

    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
};

// Draw distance measurement ruler
export const drawMeasurementRule = (ctx, measurePoints, roomSettings, scale) => {
  if (!measurePoints) return;
  const { start, current, isEstablished } = measurePoints;

  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const distPixels = Math.hypot(dx, dy);

  // Grid settings
  const gridSize = roomSettings?.gridSize || 40;
  const gridType = roomSettings?.gridType || 'square';
  const gridScaleNumber = roomSettings?.gridScaleNumber !== undefined ? roomSettings.gridScaleNumber : 5;
  const gridScaleUnit = roomSettings?.gridScaleUnit || 'ft';

  // Spacing unit: Hex columns spacing is staggered, row spacing is sqrt(3)*R.
  // Adjacent hex centers distance is sqrt(3)*gridSize vertically/diagonally.
  const scaleFactor = gridType === 'hexagon' ? Math.sqrt(3) * gridSize : gridSize;
  const numSpaces = distPixels / scaleFactor;
  const scaledDistance = numSpaces * gridScaleNumber;

  ctx.save();

  // 1. Draw glowing blue connector line
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(current.x, current.y);
  
  ctx.shadowColor = '#0ea5e9';
  ctx.shadowBlur = 8 * scale;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3.5 / scale;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Reset shadow for remaining elements
  ctx.shadowBlur = 0;

  // 2. Draw end cap indicators
  ctx.beginPath();
  ctx.arc(start.x, start.y, 5 / scale, 0, Math.PI * 2);
  ctx.fillStyle = '#38bdf8';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5 / scale;
  ctx.fill();
  ctx.stroke();

  if (isEstablished) {
    ctx.beginPath();
    ctx.arc(current.x, current.y, 5 / scale, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5 / scale;
    ctx.fill();
    ctx.stroke();
  }

  // 3. Draw glassmorphic distance badge
  let badgeX, badgeY;
  if (isEstablished) {
    badgeX = start.x + dx / 2;
    badgeY = start.y + dy / 2;
  } else {
    // Offset badge slightly up-right to avoid cursor block
    badgeX = current.x + 15 / scale;
    badgeY = current.y - 15 / scale;
  }

  const label = `${scaledDistance.toFixed(1)} ${gridScaleUnit}`;
  const fontSize = Math.max(10, Math.min(14, 12 / scale));
  ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
  const textWidth = ctx.measureText(label).width;
  
  const padX = 8 / scale;
  const padY = 4 / scale;
  const rectW = textWidth + padX * 2;
  const rectH = fontSize + padY * 2;
  const rx = badgeX - rectW / 2;
  const ry = badgeY - rectH / 2;
  const radius = 6 / scale;

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(rx, ry, rectW, rectH, radius);
  } else {
    ctx.rect(rx, ry, rectW, rectH);
  }
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.85)';
  ctx.lineWidth = 1 / scale;
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, badgeX, badgeY);

  ctx.restore();
};

