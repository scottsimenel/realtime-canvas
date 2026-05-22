import { useRef, useEffect, useState, useCallback } from 'react';

export default function Canvas({
  socketRef,
  elements,
  setElements,
  locks,
  setLocks,
  users,
  currentUser,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const dragStateRef = useRef(null);
  const lastCursorEmitRef = useRef(0);
  const imageCache = useRef({});
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [redrawTrigger, setRedrawTrigger] = useState(0);

  // Trigger state update to force re-render/redraw on asynchronous assets (like images) loading
  const triggerRedraw = useCallback(() => {
    setRedrawTrigger((prev) => prev + 1);
  }, []);

  // Get image from cache or load it. Depends on triggerRedraw instead of drawCanvas.
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

  // Drawing loop (wrapped in useCallback to satisfy hooks dependency rules)
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw grid background
    const gridSpacing = 40;
    ctx.strokeStyle = '#1e293b'; // slate-800
    ctx.lineWidth = 1;
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

    // Draw element shapes
    elements.forEach((element) => {
      const lockHolderId = locks[element.id];
      const isLockedByMe = lockHolderId === currentUser?.id;
      const isLockedByOther = lockHolderId && lockHolderId !== currentUser?.id;
      const lockHolder = isLockedByOther ? users.find((u) => u.id === lockHolderId) : null;

      ctx.save();

      // Render shapes
      if (element.type === 'rectangle') {
        ctx.fillStyle = element.properties?.fill || '#3b82f6';
        ctx.fillRect(element.x, element.y, element.width, element.height);

        ctx.strokeStyle = element.properties?.stroke || '#2563eb';
        ctx.lineWidth = element.properties?.strokeWidth || 2;
        ctx.strokeRect(element.x, element.y, element.width, element.height);
      } else if (element.type === 'circle') {
        const rx = element.width / 2;
        const ry = element.height / 2;
        const cx = element.x + rx;
        const cy = element.y + ry;

        ctx.fillStyle = element.properties?.fill || '#10b981';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = element.properties?.stroke || '#059669';
        ctx.lineWidth = element.properties?.strokeWidth || 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (element.type === 'image') {
        const img = getOrLoadImage(element.properties?.url);
        if (img && img.width > 0) {
          ctx.drawImage(img, element.x, element.y, element.width, element.height);
        } else {
          // Draw image placeholder
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(element.x, element.y, element.width, element.height);

          ctx.fillStyle = '#64748b';
          ctx.font = '12px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            img ? 'Failed to load Image' : 'Loading Image...',
            element.x + element.width / 2,
            element.y + element.height / 2
          );
        }

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.strokeRect(element.x, element.y, element.width, element.height);
      }

      // Draw lock highlighting
      if (isLockedByMe || isLockedByOther) {
        const lockColor = isLockedByMe
          ? currentUser?.color || '#3b82f6'
          : lockHolder?.color || '#f43f5e';

        ctx.strokeStyle = lockColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(
          element.x - 4,
          element.y - 4,
          element.width + 8,
          element.height + 8
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
            element.x - 4,
            element.y - 24,
            textWidth + 12,
            20
          );

          // Draw label text
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, element.x + 2, element.y - 14);
        } else if (isLockedByMe) {
          ctx.fillStyle = lockColor;
          ctx.font = '500 11px Inter, system-ui, sans-serif';
          const labelText = '✨ Moving';
          const textWidth = ctx.measureText(labelText).width;

          ctx.fillRect(
            element.x - 4,
            element.y - 24,
            textWidth + 12,
            20
          );

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, element.x + 2, element.y - 14);
        }
      }

      ctx.restore();
    });
  }, [canvasSize, elements, locks, users, currentUser, getOrLoadImage]);

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

  // Translate client coordinates to canvas relative coordinates
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
    };
  };

  // Check if coordinates hit an element, checking top-most first
  const getElementAtCoords = (x, y) => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (el.type === 'rectangle' || el.type === 'image') {
        if (x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) {
          return el;
        }
      } else if (el.type === 'circle') {
        const rx = el.width / 2;
        const ry = el.height / 2;
        const cx = el.x + rx;
        const cy = el.y + ry;
        const dx = x - cx;
        const dy = y - cy;
        // Ellipse formula: (dx/rx)^2 + (dy/ry)^2 <= 1
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
          return el;
        }
      }
    }
    return null;
  };

  const throttleCursorMove = (x, y) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    const now = Date.now();
    if (now - lastCursorEmitRef.current > 30) { // Emit cursor every 30ms
      socket.emit('cursor-move', { x, y });
      lastCursorEmitRef.current = now;
    }
  };

  const handleMouseDown = (e) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    const coords = getCanvasCoords(e);
    const element = getElementAtCoords(coords.x, coords.y);

    if (element) {
      const lockHolderId = locks[element.id];
      if (lockHolderId && lockHolderId !== currentUser?.id) {
        return; // Locked by someone else
      }

      // Start drag optimistically
      dragStateRef.current = {
        elementId: element.id,
        offsetX: coords.x - element.x,
        offsetY: coords.y - element.y,
        hasLock: false,
      };

      // Request server-side lock
      socket.emit('element-lock', { elementId: element.id }, (response) => {
        if (response && response.success) {
          if (dragStateRef.current && dragStateRef.current.elementId === element.id) {
            dragStateRef.current.hasLock = true;
            // Update local lock mapping instantly
            setLocks((prev) => ({ ...prev, [element.id]: currentUser.id }));
          }
        } else {
          // Lock failed (another client locked it in the meantime)
          if (dragStateRef.current && dragStateRef.current.elementId === element.id) {
            dragStateRef.current = null;
          }
        }
      });
    }
  };

  const handleMouseMove = (e) => {
    const coords = getCanvasCoords(e);
    throttleCursorMove(coords.x, coords.y);

    const drag = dragStateRef.current;
    if (drag) {
      const newX = Math.round(coords.x - drag.offsetX);
      const newY = Math.round(coords.y - drag.offsetY);

      // Local UI update for zero-latency feel
      setElements((prev) =>
        prev.map((el) => {
          if (el.id === drag.elementId) {
            return { ...el, x: newX, y: newY };
          }
          return el;
        })
      );

      // Only push positions to server if the lock is confirmed
      if (drag.hasLock) {
        const socket = socketRef.current;
        if (socket && socket.connected) {
          socket.emit('element-update', {
            elementId: drag.elementId,
            updates: { x: newX, y: newY },
          });
        }
      }
    }
  };

  const handleMouseUp = () => {
    const drag = dragStateRef.current;
    if (drag) {
      if (drag.hasLock) {
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
    }
  };

  const handleMouseLeave = () => {
    handleMouseUp();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#0b0f19] select-none overflow-hidden cursor-crosshair border border-slate-800/80 rounded-xl shadow-inner shadow-black/50"
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
              {/* Cursor Icon SVG */}
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
              {/* Colored Name Tag */}
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
