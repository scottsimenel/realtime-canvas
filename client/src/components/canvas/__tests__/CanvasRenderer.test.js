import { describe, expect, test, vi } from 'vitest';
import { drawGrid } from '../CanvasRenderer.js';

const createMockCtx = () => ({
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  strokeStyle: '',
  lineWidth: 0,
});

describe('CanvasRenderer drawGrid', () => {
  test('does not draw when showGrid is false', () => {
    const ctx = createMockCtx();
    drawGrid(ctx, false, 'square', 40, false, 800, 600, 1);
    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  test('applies default colors and 1px weight when gridColor and gridLineWidth are omitted', () => {
    const ctxWithoutBg = createMockCtx();
    drawGrid(ctxWithoutBg, true, 'square', 40, false, 800, 600, 1);
    expect(ctxWithoutBg.strokeStyle).toBe('#1e293b');
    expect(ctxWithoutBg.lineWidth).toBe(1);
    expect(ctxWithoutBg.stroke).toHaveBeenCalled();

    const ctxWithBg = createMockCtx();
    drawGrid(ctxWithBg, true, 'square', 40, true, 800, 600, 2);
    expect(ctxWithBg.strokeStyle).toBe('#47556960');
    expect(ctxWithBg.lineWidth).toBe(0.5); // 1 / scale (2)
  });

  test('applies custom gridColor over default colors', () => {
    const ctx = createMockCtx();
    drawGrid(ctx, true, 'square', 40, true, 800, 600, 1, '#38bdf8', 1);
    expect(ctx.strokeStyle).toBe('#38bdf8');
  });

  test('applies custom gridLineWidth scaled inversely by zoom factor', () => {
    const ctx = createMockCtx();
    // 4px line width at scale 2 should set ctx.lineWidth to 2
    drawGrid(ctx, true, 'square', 40, false, 800, 600, 2, '#ffffff', 4);
    expect(ctx.lineWidth).toBe(2);
    expect(ctx.strokeStyle).toBe('#ffffff');
  });

  test('falls back to 1px weight if gridLineWidth is invalid or zero', () => {
    const ctxZero = createMockCtx();
    drawGrid(ctxZero, true, 'square', 40, false, 800, 600, 1, null, 0);
    expect(ctxZero.lineWidth).toBe(1);

    const ctxNegative = createMockCtx();
    drawGrid(ctxNegative, true, 'square', 40, false, 800, 600, 1, null, -5);
    expect(ctxNegative.lineWidth).toBe(1);
  });

  test('renders hexagon grid with custom color and weight', () => {
    const ctx = createMockCtx();
    drawGrid(ctx, true, 'hexagon', 30, false, 300, 300, 1.5, '#f59e0b', 3);
    expect(ctx.strokeStyle).toBe('#f59e0b');
    expect(ctx.lineWidth).toBe(2); // 3 / 1.5 = 2
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});
