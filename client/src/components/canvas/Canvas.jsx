import { useRef, useEffect, useState, useCallback } from 'react';
import { EVENTS } from '../../../../shared/protocol.js';
import {
  getHandleAtCoords,
  checkEraserIntersectsPath,
  splitPathElement,
  getElementAtCoords,
  getHoveredElement,
  getGroupBoundingBox,
  getGroupHandleAtCoords,
  checkElementIntersectsBox,
  calculateFocalZoomPan,
  scalePanOffsetForZoom
} from './CanvasSelection.js';
import {
  drawBackground,
  drawGrid,
  drawElements,
  drawSelectionOutlines,
  drawActiveLocalStroke,
  drawEraserCursor,
  drawDragSelectBox,
  drawMeasurementRule
} from './CanvasRenderer.js';

const getSnappedCenter = (cx, cy, gridType, gridSize) => {
  if (gridType === 'hexagon') {
    const R = gridSize;
    const hSpacing = 1.5 * R;
    const vSpacing = Math.sqrt(3) * R;

    const approxCol = Math.round(cx / hSpacing);
    
    let minDistance = Infinity;
    let snapCx = cx;
    let snapCy = cy;

    for (let dCol = -2; dCol <= 2; dCol++) {
      const col = approxCol + dCol;
      if (col < 0) continue;
      const tcx = col * hSpacing;
      const isOdd = Math.abs(col) % 2 === 1;
      const yOffset = isOdd ? vSpacing / 2 : 0;
      
      const approxRow = Math.round((cy - yOffset) / vSpacing);
      for (let dRow = -2; dRow <= 2; dRow++) {
        const row = approxRow + dRow;
        if (row < 0) continue;
        const tcy = row * vSpacing + yOffset;
        
        const dist = Math.hypot(cx - tcx, cy - tcy);
        if (dist < minDistance) {
          minDistance = dist;
          snapCx = tcx;
          snapCy = tcy;
        }
      }
    }
    return { x: snapCx, y: snapCy };
  } else {
    const snapCx = Math.round((cx - gridSize / 2) / gridSize) * gridSize + gridSize / 2;
    const snapCy = Math.round((cy - gridSize / 2) / gridSize) * gridSize + gridSize / 2;
    return { x: snapCx, y: snapCy };
  }
};

const hasElementsChanged = (before, after) => {
  if (before.length !== after.length) return true;
  for (let i = 0; i < before.length; i++) {
    const b = before[i];
    const a = after.find((item) => item.id === b.id);
    if (!a) return true;
    if (
      b.x !== a.x ||
      b.y !== a.y ||
      b.width !== a.width ||
      b.height !== a.height ||
      (b.properties?.rotation || 0) !== (a.properties?.rotation || 0)
    ) {
      return true;
    }
  }
  return false;
};

const getCanvasCursorClass = (activeTool, isSpacePressed, activeDragMode, hoverCursor) => {
  if (activeTool === 'eraser') return 'cursor-none';
  if (activeTool === 'pen' || activeTool === 'measure') return 'cursor-crosshair';
  if (activeDragMode) {
    if (activeDragMode === 'pan' || activeDragMode === 'touch-gesture') return 'cursor-grabbing';
    if (activeDragMode === 'move' || activeDragMode === 'group-move') return 'cursor-move';
    if (activeDragMode === 'rotate' || activeDragMode === 'group-rotate') return 'cursor-grabbing';
    if (activeDragMode.includes('resize')) return 'cursor-crosshair';
    if (activeDragMode === 'select') return 'cursor-crosshair';
  }
  if (activeTool === 'pan' || isSpacePressed) return 'cursor-grab';
  if (hoverCursor) return hoverCursor;
  return 'cursor-default';
};

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
  showCursorNames = true,
  onCanvasInteraction,
  pushHistoryAction,
  locateElementTrigger,
  setLocateElementTrigger,
  handleSpawnImage,
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
  const [measurePoints, setMeasurePoints] = useState(null); // { start: {x,y}, current: {x,y}, isEstablished: boolean }

  const [prevActiveTool, setPrevActiveTool] = useState(activeTool);
  if (activeTool !== prevActiveTool) {
    setPrevActiveTool(activeTool);
    if (activeTool !== 'measure') {
      setMeasurePoints(null);
    }
  }

  const [userZoom, setUserZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const activePointersRef = useRef({}); // maps pointerId -> { clientX, clientY }

  // Handle locate element trigger
  useEffect(() => {
    if (!locateElementTrigger) return;

    const targetEl = elements.find((el) => el.id === locateElementTrigger);
    if (targetEl) {
      // Calculate element center in virtual space
      const vx = targetEl.x + targetEl.width / 2;
      const vy = targetEl.y + targetEl.height / 2;

      // Calculate current scale
      const { width: virtualWidth, height: virtualHeight } = virtualDimensions;
      const baseScale = Math.min(canvasSize.width / virtualWidth, canvasSize.height / virtualHeight) || 1;
      const scale = baseScale * userZoom;

      // Compute new pan offset to center viewport on the element
      const newPanX = (virtualWidth / 2 - vx) * scale;
      const newPanY = (virtualHeight / 2 - vy) * scale;

      setTimeout(() => {
        setPanOffset({ x: newPanX, y: newPanY });
        setLocateElementTrigger(null);
      }, 0);
    } else {
      setTimeout(() => {
        setLocateElementTrigger(null);
      }, 0);
    }
  }, [locateElementTrigger, elements, canvasSize, virtualDimensions, userZoom, setLocateElementTrigger]);
  const touchStartRef = useRef(null); // { distance, midpoint, userZoom, panOffset }
  const isSpacePressedRef = useRef(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [hoverCursor, setHoverCursor] = useState(null);
  const [activeDragMode, setActiveDragMode] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const setDragState = useCallback((state) => {
    dragStateRef.current = state;
    setActiveDragMode(state ? state.mode : null);
    setIsDragging(Boolean(state));
  }, []);

  const elementsRef = useRef(elements);
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

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

  // Trigger state update to force re-render/redraw on asynchronous assets loading
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
      const errorPlaceholder = new Image();
      imageCache.current[url] = errorPlaceholder;
    };
    return null;
  }, [triggerRedraw, getFullUrl]);

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

  // Drawing loop
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const {
      showBackground = true,
      backgroundImageUrl = null,
      showGrid = true,
      gridType = 'square',
      gridSize = 40,
      gridColor = null,
      gridLineWidth = 1,
    } = roomSettings || {};

    const { scale, offsetX, offsetY, virtualWidth, virtualHeight } = getViewportTransform();

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    const isBackgroundDrawn = drawBackground(ctx, showBackground, backgroundImageUrl, getOrLoadImage, virtualWidth, virtualHeight);

    drawGrid(ctx, showGrid, gridType, gridSize, isBackgroundDrawn, virtualWidth, virtualHeight, scale, gridColor, gridLineWidth);

    drawElements(ctx, elements, locks, users, currentUser, getOrLoadImage, scale);

    drawSelectionOutlines(ctx, selectedElementIds, elements, getGroupBoundingBox, scale);

    drawActiveLocalStroke(ctx, tempDrawingPathRef);

    drawEraserCursor(ctx, activeTool, eraserHoverRef, eraserSize, scale);

    drawDragSelectBox(ctx, dragStateRef, scale);

    if (measurePoints) {
      drawMeasurementRule(ctx, measurePoints, roomSettings, scale);
    }

    ctx.restore();
  }, [canvasSize, elements, locks, users, currentUser, getOrLoadImage, selectedElementIds, activeTool, eraserSize, roomSettings, getViewportTransform, measurePoints]);

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
    if (now - lastCursorEmitRef.current > 30) {
      socket.emit(EVENTS.CURSOR_MOVE, { x, y });
      lastCursorEmitRef.current = now;
    }
  };

  // Keyboard listener for element deletion
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedElementIds.length > 0 && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
          return;
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

          const deletedElements = unlockedIds
            .map((id) => elements.find((el) => el.id === id))
            .filter(Boolean)
            .map((el) => JSON.parse(JSON.stringify(el)));

          socket.emit(EVENTS.ELEMENT_DELETE, { elementIds: unlockedIds, tabId }, (response) => {
            if (response && response.success) {
              setElements((prev) => prev.filter((el) => !unlockedIds.includes(el.id)));
              setSelectedElementIds((prev) => prev.filter((id) => !unlockedIds.includes(id)));
              if (pushHistoryAction) {
                pushHistoryAction({
                  type: 'delete',
                  elements: deletedElements,
                  tabId,
                });
              }
            }
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementIds, elements, locks, currentUser, socketRef, setElements, setSelectedElementIds, tabId, pushHistoryAction]);

  // Spacebar panning key listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        isSpacePressedRef.current = true;
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
      }
    };
    const handleBlur = () => {
      isSpacePressedRef.current = false;
      setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const handlePointerDown = (e) => {
    if (
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('select') ||
      e.target.closest('textarea')
    ) {
      return;
    }

    if (onCanvasInteraction) {
      const coords = getCanvasCoords(e);
      const clickedElement = getElementAtCoords(coords.x, coords.y, elements);
      onCanvasInteraction(!clickedElement);
    }

    setHoveredElementId(null);
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    if (e.cancelable && e.pointerType === 'touch') {
      e.preventDefault();
    }

    try {
      containerRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // In case pointerId is invalid or synthetic
    }

    activePointersRef.current[e.pointerId] = { clientX: e.clientX, clientY: e.clientY };

    const activePointerIds = Object.keys(activePointersRef.current);

    if (activePointerIds.length === 2) {
      if (dragStateRef.current && dragStateRef.current.mode === 'draw') {
        tempDrawingPathRef.current = null;
      }
      if (dragStateRef.current && dragStateRef.current.mode === 'measure') {
        setMeasurePoints(null);
      }
      if (dragStateRef.current && dragStateRef.current.mode.startsWith('group-') && dragStateRef.current.lockedIds.length > 0) {
        socket.emit(EVENTS.ELEMENT_UNLOCK, { elementIds: dragStateRef.current.lockedIds, tabId });
        setLocks((prev) => {
          const next = { ...prev };
          dragStateRef.current.lockedIds.forEach((id) => delete next[id]);
          return next;
        });
      } else if (dragStateRef.current && dragStateRef.current.hasLock) {
        socket.emit(EVENTS.ELEMENT_UNLOCK, { elementId: dragStateRef.current.elementId, tabId });
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
      setDragState({ mode: 'touch-gesture' });
      triggerRedraw();
      return;
    }

    if (activePointerIds.length === 1) {
      if (activeTool === 'pan' || isSpacePressedRef.current || e.button === 1 || e.button === 4) {
        setDragState({
          mode: 'pan',
          startX: e.clientX,
          startY: e.clientY,
          startPanOffset: { ...panOffset }
        });
        return;
      }

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

          const newPan = calculateFocalZoomPan(
            start.panOffset,
            start.userZoom,
            nextZoom,
            start.midpoint,
            newMidpoint,
            canvasSize
          );

          setUserZoom(nextZoom);
          setPanOffset(newPan);
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

      if (drag.mode === 'measure') {
        const coords = getCanvasCoords(e);
        const dx = coords.x - drag.startX;
        const dy = coords.y - drag.startY;
        if (Math.hypot(dx, dy) > 5) {
          drag.hasMoved = true;
        }
        const globalGridSnapping = roomSettings?.gridSnapping === true;
        const showGrid = roomSettings?.showGrid === true;
        const snappedCoords = (globalGridSnapping && showGrid)
          ? getSnappedCenter(coords.x, coords.y, roomSettings?.gridType || 'square', roomSettings?.gridSize || 40)
          : coords;

        setMeasurePoints((prev) => {
          if (!prev) return prev;
          if (prev.current.x === snappedCoords.x && prev.current.y === snappedCoords.y) return prev;
          return { ...prev, current: snappedCoords };
        });
        triggerRedraw();
        return;
      }

      handleMouseMove(e);
    } else {
      const coords = getCanvasCoords(e);
      throttleCursorMove(coords.x, coords.y);

      if (activeTool === 'eraser') {
        eraserHoverRef.current = coords;
        triggerRedraw();
      }

      let nextCursor = null;
      const { scale } = getViewportTransform();

      if (activeTool === 'select') {
        if (selectedElementIds.length === 1) {
          const activeElement = elements.find((el) => el.id === selectedElementIds[0]);
          if (activeElement && !activeElement.properties?.locked) {
            const handle = getHandleAtCoords(coords.x, coords.y, activeElement, scale);
            if (handle === 'nw' || handle === 'se') nextCursor = 'cursor-nwse-resize';
            else if (handle === 'ne' || handle === 'sw') nextCursor = 'cursor-nesw-resize';
            else if (handle === 'rotate') nextCursor = 'cursor-grab';
          }
        } else if (selectedElementIds.length > 1) {
          const bbox = getGroupBoundingBox(selectedElementIds, elements);
          if (bbox) {
            const handle = getGroupHandleAtCoords(coords.x, coords.y, bbox, scale);
            if (handle === 'nw' || handle === 'se') nextCursor = 'cursor-nwse-resize';
            else if (handle === 'ne' || handle === 'sw') nextCursor = 'cursor-nesw-resize';
            else if (handle === 'rotate') nextCursor = 'cursor-grab';
          }
        }

        const hovered = getHoveredElement(coords.x, coords.y, elements);
        if (hovered) {
          if (hovered.properties?.tooltip?.enabled) {
            setHoveredElementId(hovered.id);
          } else {
            setHoveredElementId(null);
          }
          if (!nextCursor) {
            if (selectedElementIds.includes(hovered.id) && !hovered.properties?.locked) {
              nextCursor = 'cursor-move';
            } else {
              nextCursor = 'cursor-pointer';
            }
          }
        } else {
          setHoveredElementId(null);
        }
      } else if (activeTool === 'pan') {
        const hovered = getHoveredElement(coords.x, coords.y, elements);
        if (hovered && hovered.properties?.tooltip?.enabled) {
          setHoveredElementId(hovered.id);
        } else {
          setHoveredElementId(null);
        }
      }

      setHoverCursor((prev) => (prev !== nextCursor ? nextCursor : prev));

      if (activeTool === 'measure' && measurePoints && !measurePoints.isEstablished) {
        const globalGridSnapping = roomSettings?.gridSnapping === true;
        const showGrid = roomSettings?.showGrid === true;
        const snappedCoords = (globalGridSnapping && showGrid)
          ? getSnappedCenter(coords.x, coords.y, roomSettings?.gridType || 'square', roomSettings?.gridSize || 40)
          : coords;

        setMeasurePoints((prev) => {
          if (!prev) return prev;
          if (prev.current.x === snappedCoords.x && prev.current.y === snappedCoords.y) return prev;
          return { ...prev, current: snappedCoords };
        });
        triggerRedraw();
      }
    }
  };

  const handlePointerUp = (e) => {
    try {
      if (containerRef.current?.hasPointerCapture?.(e.pointerId)) {
        containerRef.current?.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release capture errors
    }
    delete activePointersRef.current[e.pointerId];

    const drag = dragStateRef.current;
    if (drag) {
      if (drag.mode === 'touch-gesture' || drag.mode === 'pan') {
        setDragState(null);
        triggerRedraw();
        return;
      }

      handleMouseUp();
    }
  };

  const handlePointerCancel = (e) => {
    try {
      if (containerRef.current?.hasPointerCapture?.(e.pointerId)) {
        containerRef.current?.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release capture errors
    }
    delete activePointersRef.current[e.pointerId];
    setHoverCursor(null);

    const drag = dragStateRef.current;
    if (drag) {
      if (drag.mode === 'touch-gesture' || drag.mode === 'pan') {
        setDragState(null);
        triggerRedraw();
        return;
      }

      handleMouseUp();
    }
  };

  const handlePointerLeave = (e) => {
    // If the pointer is captured, the user is actively dragging; do not abort the drag
    if (containerRef.current?.hasPointerCapture?.(e.pointerId)) {
      return;
    }

    delete activePointersRef.current[e.pointerId];
    setHoverCursor(null);

    const drag = dragStateRef.current;
    if (drag) {
      if (drag.mode === 'touch-gesture' || drag.mode === 'pan') {
        setDragState(null);
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
    const nextZoom = e.deltaY < 0
      ? Math.min(8.0, userZoom * zoomFactor)
      : Math.max(0.5, userZoom / zoomFactor);

    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPan = calculateFocalZoomPan(
        panOffset,
        userZoom,
        nextZoom,
        { x: mouseX, y: mouseY },
        { x: mouseX, y: mouseY },
        canvasSize
      );

      setUserZoom(nextZoom);
      setPanOffset(newPan);
    }

    triggerRedraw();
  };

  const handleMouseDown = (e) => {
    setHoveredElementId(null);
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    const coords = getCanvasCoords(e);
    const { scale } = getViewportTransform();

    if (activeTool === 'measure') {
      const globalGridSnapping = roomSettings?.gridSnapping === true;
      const showGrid = roomSettings?.showGrid === true;
      const snappedCoords = (globalGridSnapping && showGrid)
        ? getSnappedCenter(coords.x, coords.y, roomSettings?.gridType || 'square', roomSettings?.gridSize || 40)
        : coords;

      setDragState({
        mode: 'measure',
        startX: coords.x,
        startY: coords.y,
        hasMoved: false,
      });

      if (!measurePoints || measurePoints.isEstablished) {
        setMeasurePoints({
          start: snappedCoords,
          current: snappedCoords,
          isEstablished: false
        });
      } else {
        setMeasurePoints((prev) => ({
          ...prev,
          current: snappedCoords,
          isEstablished: true
        }));
      }
      triggerRedraw();
      return;
    }

    if (activeTool === 'pen') {
      tempDrawingPathRef.current = {
        points: [coords],
        stroke: penColor,
        strokeWidth: penSize,
      };
      setDragState({
        mode: 'draw',
      });
      triggerRedraw();
      return;
    }

    if (activeTool === 'eraser') {
      const deletedIds = [];
      const createdElements = [];

      setDragState({
        mode: 'erase',
        deletedIds,
        createdElements,
        startX: coords.x,
        startY: coords.y,
        isTouch: e.pointerType === 'touch',
        originalElementsMap: new Map(
          elements.filter((el) => el.type === 'path').map((el) => [el.id, JSON.parse(JSON.stringify(el))])
        ),
      });
      eraserHoverRef.current = coords;

      // On touch devices, defer destructive path deletions until movement or tap-up
      // so the first finger of a 2-finger pinch gesture does not accidentally delete paths.
      if (e.pointerType === 'touch') {
        triggerRedraw();
        return;
      }

      const eraserRad = eraserSize / 2;
      const elementsToErase = elements.filter(
        (el) => el.type === 'path' && checkEraserIntersectsPath(coords.x, coords.y, eraserRad, el)
      );

      if (elementsToErase.length > 0) {
        const unlockableElements = elementsToErase.filter((el) => {
          if (el.properties?.locked) return false;
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

            socket.emit(EVENTS.ELEMENT_DELETE, { elementIds: toDeleteIds, tabId });
            toCreateElements.forEach((newEl) => {
              socket.emit(EVENTS.ELEMENT_CREATE, { element: newEl, tabId });
            });

            deletedIds.push(...toDeleteIds);
            createdElements.push(...toCreateElements);
          }
        }
      }
      triggerRedraw();
      return;
    }

    if (selectedElementIds.length > 1) {
      const bbox = getGroupBoundingBox(selectedElementIds, elements);
      if (bbox) {
        const handle = getGroupHandleAtCoords(coords.x, coords.y, bbox, scale);
        if (handle) {
          setDragState({
            mode: handle === 'rotate' ? 'group-rotate' : 'group-resize',
            handleType: handle,
            bbox,
            initialMouseX: coords.x,
            initialMouseY: coords.y,
            initialElements: elements.map(el => ({ ...el, properties: { ...el.properties } })),
            lockedIds: [],
            originalElements: selectedElementIds
              .map((id) => elements.find((el) => el.id === id))
              .filter(Boolean)
              .map((el) => JSON.parse(JSON.stringify(el))),
          });

          const targetIds = selectedElementIds.filter(id => !locks[id] || locks[id] === currentUser?.id);
          socket.emit(EVENTS.ELEMENT_LOCK, { elementIds: targetIds, tabId }, (response) => {
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

    if (selectedElementIds.length === 1) {
      const activeElement = elements.find((el) => el.id === selectedElementIds[0]);
      if (activeElement) {
        const lockHolderId = locks[activeElement.id];
        const isLockedBySomeoneElse = lockHolderId && lockHolderId !== currentUser?.id;

        if (!isLockedBySomeoneElse) {
          const handle = getHandleAtCoords(coords.x, coords.y, activeElement, scale);
          if (handle) {
            setDragState({
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
              originalElements: [JSON.parse(JSON.stringify(activeElement))],
            });

            const activeId = activeElement.id;
            socket.emit(EVENTS.ELEMENT_LOCK, { elementId: activeId, tabId }, (response) => {
              if (response && response.success) {
                if (dragStateRef.current && dragStateRef.current.elementId === activeId) {
                  dragStateRef.current.hasLock = true;
                  setLocks((prev) => ({ ...prev, [activeId]: currentUser.id }));
                } else {
                  const currentElement = elementsRef.current.find((el) => el.id === activeId);
                  if (currentElement) {
                    socket.emit(EVENTS.ELEMENT_UPDATE, { element: currentElement, tabId });
                  }
                  socket.emit(EVENTS.ELEMENT_UNLOCK, { elementId: activeId, tabId });
                }
              } else {
                if (dragStateRef.current && dragStateRef.current.elementId === activeId) {
                  setDragState(null);
                }
              }
            });
            return;
          }
        }
      }
    }

    const element = getElementAtCoords(coords.x, coords.y, elements);
    if (element) {
      const lockHolderId = locks[element.id];
      if (lockHolderId && lockHolderId !== currentUser?.id) {
        setSelectedElementIds([element.id]);
        return;
      }

      if (e.shiftKey) {
        const isSelected = selectedElementIds.includes(element.id);
        const newSelection = isSelected
          ? selectedElementIds.filter(id => id !== element.id)
          : [...selectedElementIds, element.id];
        setSelectedElementIds(newSelection);
        return;
      }

      if (selectedElementIds.includes(element.id) && selectedElementIds.length > 1) {
        const bbox = getGroupBoundingBox(selectedElementIds, elements);
        if (bbox) {
          setDragState({
            mode: 'group-move',
            bbox,
            elementId: element.id,
            offsetX: coords.x,
            offsetY: coords.y,
            initialElements: elements.map(el => ({ ...el, properties: { ...el.properties } })),
            lockedIds: [],
            originalElements: selectedElementIds
              .map((id) => elements.find((el) => el.id === id))
              .filter(Boolean)
              .map((el) => JSON.parse(JSON.stringify(el))),
          });

          const targetIds = selectedElementIds.filter(id => !locks[id] || locks[id] === currentUser?.id);
          socket.emit(EVENTS.ELEMENT_LOCK, { elementIds: targetIds, tabId }, (response) => {
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

      setSelectedElementIds([element.id]);

      setDragState({
        elementId: element.id,
        mode: 'move',
        offsetX: coords.x - element.x,
        offsetY: coords.y - element.y,
        hasLock: false,
        originalElements: [JSON.parse(JSON.stringify(element))],
      });

      const targetId = element.id;
      socket.emit(EVENTS.ELEMENT_LOCK, { elementId: targetId, tabId }, (response) => {
        if (response && response.success) {
          if (dragStateRef.current && dragStateRef.current.elementId === targetId) {
            dragStateRef.current.hasLock = true;
            setLocks((prev) => ({ ...prev, [targetId]: currentUser.id }));
          } else {
            const currentElement = elementsRef.current.find((el) => el.id === targetId);
            if (currentElement) {
              socket.emit(EVENTS.ELEMENT_UPDATE, { element: currentElement, tabId });
            }
            socket.emit(EVENTS.ELEMENT_UNLOCK, { elementId: targetId, tabId });
          }
        } else {
          if (dragStateRef.current && dragStateRef.current.elementId === targetId) {
            setDragState(null);
          }
        }
      });
    } else {
      if (!e.shiftKey) {
        setSelectedElementIds([]);
      }

      setDragState({
        mode: 'select',
        startX: coords.x,
        startY: coords.y,
        currentX: coords.x,
        currentY: coords.y,
        isAddingSelection: e.shiftKey,
        initialSelection: [...selectedElementIds],
      });
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
            if (el.properties?.locked) return false;
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
                socket.emit(EVENTS.ELEMENT_DELETE, { elementIds: toDeleteIds, tabId });
                toCreateElements.forEach((newEl) => {
                  socket.emit(EVENTS.ELEMENT_CREATE, { element: newEl, tabId });
                });
              }

              if (dragStateRef.current && dragStateRef.current.mode === 'erase') {
                dragStateRef.current.deletedIds.push(...toDeleteIds);
                dragStateRef.current.createdElements.push(...toCreateElements);
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

        let finalDx = dx;
        let finalDy = dy;

        const globalGridSnapping = roomSettings?.gridSnapping === true;
        const showGrid = roomSettings?.showGrid === true;
        
        const primaryEl = drag.initialElements.find(item => item.id === drag.elementId);
        if (primaryEl && globalGridSnapping && primaryEl.properties?.snapToGrid !== false && showGrid) {
          const w = primaryEl.width;
          const h = primaryEl.height;
          const cx = primaryEl.x + dx + w / 2;
          const cy = primaryEl.y + dy + h / 2;
          const snapped = getSnappedCenter(cx, cy, roomSettings?.gridType || 'square', roomSettings?.gridSize || 40);
          
          finalDx = Math.round(snapped.x - w / 2 - primaryEl.x);
          finalDy = Math.round(snapped.y - h / 2 - primaryEl.y);
        }

        const activeIds = drag.lockedIds.length > 0
          ? drag.lockedIds
          : selectedElementIds.filter(id => !locks[id] || locks[id] === currentUser?.id);

        updatesBatch = activeIds.map((id) => {
          const initEl = drag.initialElements.find(item => item.id === id);
          if (!initEl) return null;
          return {
            elementId: id,
            updates: {
              x: initEl.x + finalDx,
              y: initEl.y + finalDy,
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
        const element = elements.find((el) => el.id === drag.elementId);
        if (!element) return;

        let updates = {};

        if (drag.mode === 'move') {
          let newX = Math.round(coords.x - drag.offsetX);
          let newY = Math.round(coords.y - drag.offsetY);

          const globalGridSnapping = roomSettings?.gridSnapping === true;
          const showGrid = roomSettings?.showGrid === true;
          const isSnapEnabled = globalGridSnapping && (element.properties?.snapToGrid !== false);

          if (isSnapEnabled && showGrid) {
            const w = element.width;
            const h = element.height;
            const cx = newX + w / 2;
            const cy = newY + h / 2;
            const snapped = getSnappedCenter(cx, cy, roomSettings?.gridType || 'square', roomSettings?.gridSize || 40);
            newX = Math.round(snapped.x - w / 2);
            newY = Math.round(snapped.y - h / 2);
          }

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

        const socket = socketRef.current;
        if (socket && socket.connected) {
          if (drag.mode.startsWith('group-')) {
            const unlockedBatch = updatesBatch.filter((item) => {
              return drag.lockedIds.includes(item.elementId) || !locks[item.elementId] || locks[item.elementId] === currentUser?.id;
            });
            if (unlockedBatch.length > 0) {
              socket.emit(EVENTS.ELEMENT_UPDATE, { batch: unlockedBatch, tabId });
            }
          } else if (drag.hasLock) {
            socket.emit(EVENTS.ELEMENT_UPDATE, {
              elementId: drag.elementId,
              updates: updatesBatch[0].updates,
              tabId,
            });
          }
        }
      }
    } else {
      const hovered = getHoveredElement(coords.x, coords.y, elements);
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
      if (drag.mode === 'measure') {
        if (drag.hasMoved) {
          setMeasurePoints((prev) => {
            if (!prev) return prev;
            return { ...prev, isEstablished: true };
          });
        }
        setDragState(null);
        triggerRedraw();
        return;
      }

      if (drag.mode === 'draw') {
        const strokePath = tempDrawingPathRef.current;
        if (strokePath && strokePath.points && strokePath.points.length >= 1) {
          const rawPoints = strokePath.points.length === 1
            ? [strokePath.points[0], { x: strokePath.points[0].x + 0.1, y: strokePath.points[0].y + 0.1 }]
            : strokePath.points;

          let minX = Infinity;
          let maxX = -Infinity;
          let minY = Infinity;
          let maxY = -Infinity;

          rawPoints.forEach((p) => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          });

          const w = Math.max(maxX - minX, 4);
          const h = Math.max(maxY - minY, 4);

          const normalizedPoints = rawPoints.map((p) => ({
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

          setElements((prev) => [...prev, element]);

          const socket = socketRef.current;
          if (socket && socket.connected) {
            socket.emit(EVENTS.ELEMENT_CREATE, { element, tabId });
          }

          if (pushHistoryAction) {
            pushHistoryAction({
              type: 'create',
              elements: [element],
              tabId,
            });
          }
        }
        tempDrawingPathRef.current = null;
        setDragState(null);
        triggerRedraw();
        return;
      }

      if (drag.mode === 'erase') {
        if (drag.deletedIds && drag.deletedIds.length === 0 && drag.startX !== undefined) {
          const eraserRad = eraserSize / 2;
          const elementsToErase = elements.filter(
            (el) => el.type === 'path' && checkEraserIntersectsPath(drag.startX, drag.startY, eraserRad, el)
          );

          if (elementsToErase.length > 0) {
            const unlockableElements = elementsToErase.filter((el) => {
              if (el.properties?.locked) return false;
              const lockHolderId = locks[el.id];
              return !lockHolderId || lockHolderId === currentUser?.id;
            });

            if (unlockableElements.length > 0) {
              const toDeleteIds = [];
              const toCreateElements = [];

              unlockableElements.forEach((el) => {
                const subPaths = splitPathElement(drag.startX, drag.startY, eraserRad, el);
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

                const socket = socketRef.current;
                if (socket && socket.connected) {
                  socket.emit(EVENTS.ELEMENT_DELETE, { elementIds: toDeleteIds, tabId });
                  toCreateElements.forEach((newEl) => {
                    socket.emit(EVENTS.ELEMENT_CREATE, { element: newEl, tabId });
                  });
                }

                drag.deletedIds.push(...toDeleteIds);
                drag.createdElements.push(...toCreateElements);
              }
            }
          }
        }

        if (pushHistoryAction && drag.deletedIds && drag.deletedIds.length > 0) {
          const elementsBefore = drag.deletedIds
            .map((id) => drag.originalElementsMap.get(id))
            .filter(Boolean);
          const elementsAfter = drag.createdElements.filter((el) =>
            elements.some((currentEl) => currentEl.id === el.id)
          );
          pushHistoryAction({
            type: 'erase',
            elementsBefore,
            elementsAfter,
            tabId,
          });
        }
        setDragState(null);
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
            socket.emit(EVENTS.ELEMENT_UNLOCK, { elementIds: activeIds, tabId });
          }
          setLocks((prev) => {
            const next = { ...prev };
            activeIds.forEach((id) => {
              delete next[id];
            });
            return next;
          });
        }

        if (pushHistoryAction && drag.originalElements) {
          const affectedIds = drag.originalElements.map((el) => el.id);
          const currentElements = affectedIds
            .map((id) => elements.find((el) => el.id === id))
            .filter(Boolean)
            .map((el) => JSON.parse(JSON.stringify(el)));

          if (hasElementsChanged(drag.originalElements, currentElements)) {
            pushHistoryAction({
              type: 'transform',
              elementsBefore: drag.originalElements,
              elementsAfter: currentElements,
              tabId,
            });
          }
        }
      } else if (drag.hasLock || drag.mode === 'move' || drag.mode === 'resize' || drag.mode === 'rotate') {
        const socket = socketRef.current;
        if (socket && socket.connected && drag.hasLock) {
          const currentElement = elements.find((el) => el.id === drag.elementId);
          if (currentElement) {
            socket.emit(EVENTS.ELEMENT_UPDATE, { element: currentElement, tabId });
          }
          socket.emit(EVENTS.ELEMENT_UNLOCK, { elementId: drag.elementId, tabId });
        }
        setLocks((prev) => {
          const next = { ...prev };
          delete next[drag.elementId];
          return next;
        });

        if (pushHistoryAction && drag.originalElements) {
          const currentElement = elements.find((el) => el.id === drag.elementId);
          if (currentElement) {
            const elCopy = JSON.parse(JSON.stringify(currentElement));
            if (hasElementsChanged(drag.originalElements, [elCopy])) {
              pushHistoryAction({
                type: 'transform',
                elementsBefore: drag.originalElements,
                elementsAfter: [elCopy],
                tabId,
              });
            }
          }
        }
      }
      setDragState(null);
      triggerRedraw();
    }
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

  const handleAssetDrop = (e) => {
    e.preventDefault();
    try {
      const textData = e.dataTransfer.getData('text/plain');
      if (!textData) return;
      const data = JSON.parse(textData);
      if (data && data.type === 'image' && data.url) {
        const coords = getCanvasCoords(e);
        if (handleSpawnImage) {
          handleSpawnImage(data.url, coords.x, coords.y);
        }
      }
    } catch (err) {
      console.error('Failed to handle asset drop:', err);
    }
  };

  const { scale, offsetX, offsetY } = getViewportTransform();

  const activeTooltipElId = hoveredElementId || (selectedElementIds.length === 1 && !isDragging ? selectedElementIds[0] : null);
  const activeTooltipElement = activeTooltipElId ? elements.find((el) => el.id === activeTooltipElId) : null;
  const showTooltip = Boolean(activeTooltipElement && activeTooltipElement.properties?.tooltip?.enabled);

  let tooltipLeft = 0;
  let tooltipTop = 0;
  let isFlipped = false;

  if (showTooltip) {
    const cx = activeTooltipElement.x + activeTooltipElement.width / 2;
    const screenCx = offsetX + cx * scale;
    const screenTopY = offsetY + activeTooltipElement.y * scale;
    const screenH = activeTooltipElement.height * scale;

    const halfTooltipWidth = 136;
    tooltipLeft = Math.max(halfTooltipWidth, Math.min(canvasSize.width - halfTooltipWidth, screenCx));

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
      style={{ touchAction: 'none' }}
      className={`touch-none relative w-full h-full bg-[#0b0f19] select-none overflow-hidden border border-slate-800/80 rounded-xl shadow-inner shadow-black/50 ${getCanvasCursorClass(activeTool, isSpacePressed, activeDragMode, hoverCursor)}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onLostPointerCapture={(e) => {
        delete activePointersRef.current[e.pointerId];
      }}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleAssetDrop}
    >
      <canvas ref={canvasRef} style={{ touchAction: 'none' }} className="touch-none absolute inset-0" />

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
          <div className="border-b border-slate-800/85 pb-1.5 flex items-center justify-between">
            <span className="font-bold text-slate-100 text-sm truncate max-w-[190px]">
              {activeTooltipElement.properties.tooltip.title || (activeTooltipElement.type.charAt(0).toUpperCase() + activeTooltipElement.type.slice(1))}
            </span>
            <span className="text-[9px] text-sky-400/80 bg-sky-500/10 px-1.5 py-0.5 rounded font-mono uppercase">
              {activeTooltipElement.type}
            </span>
          </div>

          {activeTooltipElement.properties.tooltip.trackers && activeTooltipElement.properties.tooltip.trackers.length > 0 && (
            <div className="space-y-2.5">
              {activeTooltipElement.properties.tooltip.trackers.map((tracker) => {
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

          {activeTooltipElement.properties.tooltip.stats && activeTooltipElement.properties.tooltip.stats.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-800/50">
              {activeTooltipElement.properties.tooltip.stats.map((stat) => (
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
              {showCursorNames && (
                <div
                  style={{ backgroundColor: user.color || '#f43f5e' }}
                  className="ml-4 mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-white whitespace-nowrap shadow-md border border-white/20 flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                  <span>{user.name}</span>
                </div>
              )}
            </div>
          );
        })}

      {/* Floating Zoom & Reset Controls */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute bottom-20 sm:bottom-4 right-4 z-20 flex items-center gap-1 sm:gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-1 sm:p-1.5 shadow-lg select-none"
      >
        <button
          type="button"
          onClick={() => {
            setUserZoom((prev) => {
              const next = Math.max(0.5, prev - 0.1);
              setPanOffset((pan) => scalePanOffsetForZoom(pan, prev, next));
              return next;
            });
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
            setUserZoom((prev) => {
              const next = Math.min(8.0, prev + 0.1);
              setPanOffset((pan) => scalePanOffsetForZoom(pan, prev, next));
              return next;
            });
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
