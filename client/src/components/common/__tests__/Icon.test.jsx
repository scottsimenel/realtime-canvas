import { describe, expect, test, vi } from 'vitest';
import Icon, { ICONS } from '../Icon.jsx';

describe('Icon component unit tests', () => {
  test('ICONS registry contains expected core iconography keys', () => {
    expect(ICONS).toBeDefined();
    const expectedKeys = [
      'mouse-pointer',
      'hand',
      'pencil',
      'eraser',
      'ruler',
      'trash',
      'sparkles',
      'shapes',
      'dices',
      'sliders',
      'maximize',
      'minimize',
      'plus',
      'minus',
      'x',
      'check',
      'link',
      'undo',
      'redo',
      'save',
      'log-out',
      'users',
      'image',
      'eye',
      'eye-off',
      'folder',
      'folder-plus',
      'folder-up',
      'search',
      'grip-vertical',
      'chevrons-up',
      'chevron-up',
      'chevron-down',
      'chevrons-down',
      'chevron-right',
      'locate',
      'lock',
      'unlock',
      'pipette',
      'upload',
      'message-square',
      'alert-circle',
      'shape-rectangle',
      'shape-circle',
      'shape-triangle',
      'shape-star',
      'shape-hexagon',
    ];

    expectedKeys.forEach((key) => {
      expect(ICONS[key], `Missing icon: ${key}`).toBeDefined();
    });
  });

  test('renders standard icon with default props', () => {
    const vdom = Icon({ name: 'pencil' });
    expect(vdom).not.toBeNull();
    expect(vdom.type).toBe('svg');
    expect(vdom.props.viewBox).toBe('0 0 24 24');
    expect(vdom.props.fill).toBe('none');
    expect(vdom.props.stroke).toBe('currentColor');
    expect(vdom.props.strokeWidth).toBe(2);
    expect(vdom.props.strokeLinecap).toBe('round');
    expect(vdom.props.strokeLinejoin).toBe('round');
    expect(vdom.props.className).toContain('w-5 h-5');
    expect(vdom.props['aria-hidden']).toBe('true');
  });

  test('applies custom className and custom strokeWidth', () => {
    const vdom = Icon({
      name: 'trash',
      className: 'w-3.5 h-3.5 text-rose-400',
      strokeWidth: 1.5,
    });
    expect(vdom).not.toBeNull();
    expect(vdom.props.className).toContain('w-3.5 h-3.5 text-rose-400');
    expect(vdom.props.strokeWidth).toBe(1.5);
  });

  test('applies custom size override and fill color', () => {
    const vdom = Icon({
      name: 'save',
      size: 24,
      fill: 'currentColor',
    });
    expect(vdom).not.toBeNull();
    expect(vdom.props.style).toEqual(
      expect.objectContaining({
        width: '24px',
        height: '24px',
      })
    );
    expect(vdom.props.fill).toBe('currentColor');
  });

  test('returns null and warns for unknown icon names', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const vdom = Icon({ name: 'non-existent-icon-xyz' });
    expect(vdom).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Icon] Unknown icon name: "non-existent-icon-xyz"')
    );
    warnSpy.mockRestore();
  });
});
