export default function DieIcon({ type, value, size = 'w-12 h-12', className = '', isKept = true, isDiscarded = false, userColor = null }) {
  let fillClass = 'fill-slate-950/80';
  let strokeClass = 'stroke-slate-700/80';
  let textClass = 'fill-slate-200';

  if (isDiscarded) {
    fillClass = 'fill-slate-950/20';
    strokeClass = 'stroke-slate-900';
    textClass = 'fill-slate-600 line-through';
  } else if (isKept) {
    if (userColor) {
      fillClass = 'fill-slate-950/70';
      strokeClass = ''; 
    } else {
      fillClass = 'fill-slate-950/80';
    }
  }

  let path;
  let textY;

  switch (type) {
    case 4: // Tetrahedron (Triangle)
      path = 'M 50,10 L 92,86 L 8,86 Z';
      textY = '64';
      break;
    case 6: // Cube (Square)
      path = 'M 20,10 H 80 A 10,10 0 0 1 90,20 V 80 A 10,10 0 0 1 80,90 H 20 A 10,10 0 0 1 10,80 V 20 A 10,10 0 0 1 20,10 Z';
      textY = '56';
      break;
    case 8: // Octahedron (Diamond)
      path = 'M 50,8 L 92,50 L 50,92 L 8,50 Z';
      textY = '56';
      break;
    case 10: // Decahedron (Kite)
      path = 'M 50,8 L 88,38 L 50,92 L 12,38 Z';
      textY = '54';
      break;
    case 12: // Dodecahedron (Pentagon)
      path = 'M 50,8 L 92,38 L 76,88 L 24,88 L 8,38 Z';
      textY = '57';
      break;
    case 20: // Icosahedron (Hexagon)
      path = 'M 50,8 L 88,30 V 70 L 50,92 L 12,70 V 30 Z';
      textY = '56';
      break;
    case 100: // Zocchihedron (Circle)
    default:
      path = 'M 50,50 m -42,0 a 42,42 0 1,0 84,0 a 42,42 0 1,0 -84,0';
      textY = '56';
      break;
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={`${size} ${className}`}
      style={{ overflow: 'visible' }}
    >
      <path
        d={path}
        className={`${fillClass} ${strokeClass} transition-all duration-300`}
        style={strokeClass === '' ? { stroke: userColor || '#4f46e5' } : {}}
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <text
        x="50"
        y={textY}
        textAnchor="middle"
        dominantBaseline="middle"
        className={`${textClass} font-mono font-black text-[35px] transition-all duration-300`}
        style={isDiscarded ? { textDecoration: 'line-through' } : {}}
      >
        {value}
      </text>
    </svg>
  );
}
