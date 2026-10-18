/**
 * Standardized SVG icon paths (24x24 viewBox, stroke-based by default).
 * Clean, lightweight, zero-dependency modern icon system.
 */
const ICONS = {
  // Navigation & Tools
  'mouse-pointer': (
    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
  ),
  'hand': (
    <path d="M18 11V6a2 2 0 0 0-4 0v5m0-3a2 2 0 0 0-4 0v6m0-4a2 2 0 0 0-4 0v7a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-6a2 2 0 0 0-4 0" />
  ),
  'pencil': (
    <>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      <path d="M15 5l4 4" />
    </>
  ),
  'eraser': (
    <>
      <path d="M20 20H7L3 16C2 15 2 13 3 12L13 2C14 1 16 1 17 2L21 6C22 7 22 9 21 10L14 17" />
      <path d="M7 12l5 5" />
    </>
  ),
  'ruler': (
    <>
      <path d="M21.3 8.7L8.7 21.3c-.4.4-1 .4-1.4 0l-4.6-4.6c-.4-.4-.4-1 0-1.4L15.3 2.7c.4-.4 1-.4 1.4 0l4.6 4.6c.4.4.4 1 0 1.4z" />
      <path d="M14.5 3.5l-2 2" />
      <path d="M11.5 6.5l-3.5 3.5" />
      <path d="M8.5 9.5l-2 2" />
      <path d="M5.5 12.5l-3.5 3.5" />
    </>
  ),
  'trash': (
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </>
  ),
  'sparkles': (
    <>
      <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'clear-drawings': (
    <>
      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
      <path d="M18 6l-6 6-4-4" />
      <path d="M6 18l12-12" />
    </>
  ),

  // Dock & Sidebar Toggles
  'shapes': (
    <>
      <path d="M8.5 3.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
      <path d="M14 14h7v7h-7z" />
      <path d="M3 21l6-9h-6z" />
    </>
  ),
  'dices': (
    <>
      <rect x="2" y="7" width="13" height="13" rx="2" />
      <path d="M15 4h4a2 2 0 0 1 2 2v4" />
      <circle cx="6.5" cy="11.5" r="1" fill="currentColor" />
      <circle cx="10.5" cy="15.5" r="1" fill="currentColor" />
      <circle cx="8.5" cy="13.5" r="1" fill="currentColor" />
    </>
  ),
  'sliders': (
    <>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </>
  ),
  'maximize': (
    <>
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </>
  ),
  'minimize': (
    <>
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </>
  ),

  // Header, Navigation & Collaboration
  'undo': (
    <>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </>
  ),
  'redo': (
    <>
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
    </>
  ),
  'save': (
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </>
  ),
  'log-out': (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  'users': (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  'user': (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  'link': (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  'check': (
    <polyline points="20 6 9 17 4 12" />
  ),
  'x': (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  'plus': (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  'minus': (
    <line x1="5" y1="12" x2="19" y2="12" />
  ),
  'search': (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),

  // Folders & Assets
  'folder': (
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  ),
  'folder-open': (
    <>
      <path d="M2 19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-8l-2-3H4a2 2 0 0 0-2 2z" />
      <line x1="2" y1="13" x2="22" y2="13" />
    </>
  ),
  'folder-plus': (
    <>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </>
  ),
  'folder-up': (
    <>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <polyline points="9 13 12 10 15 13" />
      <line x1="12" y1="10" x2="12" y2="17" />
    </>
  ),
  'image': (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </>
  ),
  'eye': (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </>
  ),
  'pipette': (
    <>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      <path d="M5 19l-3 3" />
    </>
  ),
  'palette': (
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.66 0 3-1.34 3-3 0-.78-.3-1.48-.79-2-.48-.51-.77-1.19-.77-2 0-1.66 1.34-3 3-3h1.56c3.09 0 5.6-2.51 5.6-5.6C22.6 5.56 17.84 2 12 2zm-5.5 8c-.83 0-1.5-.67-1.5-1.5S5.67 7 6.5 7 8 7.67 8 8.5 7.33 10 6.5 10zm3-4c-.83 0-1.5-.67-1.5-1.5S8.67 3 9.5 3s1.5.67 1.5 1.5S10.33 6 9.5 6zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 3 14.5 3s1.5.67 1.5 1.5S15.33 6 14.5 6zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 7 17.5 7s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
  ),

  // Chevrons & Layer Ordering
  'chevron-up': (
    <polyline points="18 15 12 9 6 15" />
  ),
  'chevron-down': (
    <polyline points="6 9 12 15 18 9" />
  ),
  'chevron-right': (
    <polyline points="9 18 15 12 9 6" />
  ),
  'chevron-left': (
    <polyline points="15 18 9 12 15 6" />
  ),
  'chevrons-up': (
    <>
      <polyline points="17 11 12 6 7 11" />
      <polyline points="17 18 12 13 7 18" />
    </>
  ),
  'chevrons-down': (
    <>
      <polyline points="7 13 12 18 17 13" />
      <polyline points="7 6 12 11 17 6" />
    </>
  ),
  'arrow-left': (
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </>
  ),

  // Inspection, Locks & Layer Management
  'locate': (
    <>
      <circle cx="12" cy="12" r="7" />
      <line x1="12" y1="1" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="1" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="23" y2="12" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  'lock': (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  'unlock': (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </>
  ),
  'grip-vertical': (
    <>
      <circle cx="9" cy="5" r="1.5" fill="currentColor" />
      <circle cx="9" cy="12" r="1.5" fill="currentColor" />
      <circle cx="9" cy="19" r="1.5" fill="currentColor" />
      <circle cx="15" cy="5" r="1.5" fill="currentColor" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" />
      <circle cx="15" cy="19" r="1.5" fill="currentColor" />
    </>
  ),
  'mouse-pointer-click': (
    <>
      <path d="M14 4.1 12 6" />
      <path d="m5.1 8-2.9-.8" />
      <path d="m6 12-1.9 2" />
      <path d="M7.2 2.2 8 5.1" />
      <path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" />
    </>
  ),
  'upload': (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>
  ),
  'message-square': (
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  ),

  // Status & Utility
  'refresh': (
    <>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>
  ),
  'loader': (
    <>
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </>
  ),
  'mail': (
    <>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </>
  ),
  'alert-circle': (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),

  // Geometric Shape Selector Icons (Clean, uniform SVG representations)
  'shape-rectangle': (
    <rect x="3" y="5" width="18" height="14" rx="2" />
  ),
  'shape-circle': (
    <circle cx="12" cy="12" r="8" />
  ),
  'shape-triangle': (
    <polygon points="12 4 21 20 3 20" />
  ),
  'shape-star': (
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  ),
  'shape-hexagon': (
    <polygon points="12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5" />
  ),
};

/**
 * Universal SVG Icon component.
 * 
 * @param {Object} props
 * @param {string} props.name - The icon key from ICONS.
 * @param {string} [props.className='w-5 h-5'] - Tailwind CSS classes for sizing and colors.
 * @param {number} [props.size] - Optional width/height in pixels.
 * @param {number} [props.strokeWidth=2] - SVG stroke line width.
 * @param {string} [props.fill='none'] - SVG fill rule.
 * @param {string} [props.stroke='currentColor'] - SVG stroke color.
 * @returns {React.ReactElement|null}
 */
export default function Icon({
  name,
  className = 'w-5 h-5',
  size,
  strokeWidth = 2,
  fill = 'none',
  stroke = 'currentColor',
  ...rest
}) {
  const iconContent = ICONS[name];
  if (!iconContent) {
    console.warn(`[Icon] Unknown icon name: "${name}"`);
    return null;
  }

  const customStyle = size ? { width: `${size}px`, height: `${size}px`, ...rest.style } : rest.style;

  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} inline-block shrink-0`}
      style={customStyle}
      aria-hidden="true"
      {...rest}
    >
      {iconContent}
    </svg>
  );
}

export { ICONS };
