import React, { useEffect, useRef, useState } from 'react';

// --- Quaternion Math Utilities ---
const qIdentity = () => [0, 0, 0, 1];

const qMultiply = (q1, q2) => {
  const [x1, y1, z1, w1] = q1;
  const [x2, y2, z2, w2] = q2;
  return [
    w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
    w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
    w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
    w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2
  ];
};

const qNormalize = (q) => {
  const [x, y, z, w] = q;
  const len = Math.sqrt(x * x + y * y + z * z + w * w);
  if (len === 0) return [0, 0, 0, 1];
  return [x / len, y / len, z / len, w / len];
};

const qRotateVector = (q, v) => {
  const [vx, vy, vz] = v;
  const [qx, qy, qz, qw] = q;
  
  const ix = qw * vx + qy * vz - qz * vy;
  const iy = qw * vy - qx * vz + qz * vx;
  const iz = qw * vz + qx * vy - qy * vx;
  const iw = -qx * vx - qy * vy - qz * vz;
  
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy - ix * -qz + iz * -qx,
    iz * qw + iw * -qz + ix * -qy - iy * -qx
  ];
};

const qLerp = (q1, q2, t) => {
  const dot = q1[0] * q2[0] + q1[1] * q2[1] + q1[2] * q2[2] + q1[3] * q2[3];
  const q2Target = dot < 0 ? [-q2[0], [-q2[1]], -q2[2], -q2[3]] : q2;
  
  return qNormalize([
    q1[0] * (1 - t) + q2Target[0] * t,
    q1[1] * (1 - t) + q2Target[1] * t,
    q1[2] * (1 - t) + q2Target[2] * t,
    q1[3] * (1 - t) + q2Target[3] * t
  ]);
};

const qFromAxisAngle = (axis, angle) => {
  const halfAngle = angle * 0.5;
  const sin = Math.sin(halfAngle);
  const cos = Math.cos(halfAngle);
  
  const len = Math.sqrt(axis[0]*axis[0] + axis[1]*axis[1] + axis[2]*axis[2]);
  if (len === 0) return [0, 0, 0, 1];
  
  return [
    (axis[0] / len) * sin,
    (axis[1] / len) * sin,
    (axis[2] / len) * sin,
    cos
  ];
};

const getRotationToAlignNormal = (localNormal, targetWorldNormal = [0, 0, 1]) => {
  const lnX = localNormal[0], lnY = localNormal[1], lnZ = localNormal[2];
  const lnLen = Math.sqrt(lnX*lnX + lnY*lnY + lnZ*lnZ);
  const lx = lnX / lnLen, ly = lnY / lnLen, lz = lnZ / lnLen;
  
  const wx = targetWorldNormal[0], wy = targetWorldNormal[1], wz = targetWorldNormal[2];
  
  const ax = ly * wz - lz * wy;
  const ay = lz * wx - lx * wz;
  const az = lx * wy - ly * wx;
  
  const dotVal = lx * wx + ly * wy + lz * wz;
  
  if (dotVal > 0.9999) {
    return [0, 0, 0, 1];
  }
  if (dotVal < -0.9999) {
    const px = Math.abs(lx) < 0.8 ? 1 : 0;
    const py = Math.abs(lx) < 0.8 ? 0 : 1;
    const pz = 0;
    
    const axP = ly * pz - lz * py;
    const ayP = lz * px - lx * pz;
    const azP = lx * py - ly * px;
    const lenP = Math.sqrt(axP*axP + ayP*ayP + azP*azP);
    
    return [axP / lenP, ayP / lenP, azP / lenP, 0];
  }
  
  const s = Math.sqrt((1 + dotVal) * 2);
  const invS = 1 / s;
  return [ax * invS, ay * invS, az * invS, s * 0.5];
};

// --- Geometry Generators ---
const normalize = (v) => {
  const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  return len > 0 ? [v[0]/len, v[1]/len, v[2]/len] : [0,0,0];
};

const getD4Geom = () => {
  const vertices = [
    [1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]
  ].map(normalize);
  const faces = [
    [0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]
  ];
  return { vertices, faces };
};

const getD6Geom = () => {
  const vertices = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
  ].map(normalize);
  const faces = [
    [0, 3, 2, 1], // Back
    [4, 5, 6, 7], // Front
    [0, 1, 5, 4], // Bottom
    [2, 3, 7, 6], // Top
    [0, 4, 7, 3], // Left
    [1, 2, 6, 5]  // Right
  ];
  return { vertices, faces };
};

const getD8Geom = () => {
  const vertices = [
    [0, 0, 1], [1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0], [0, 0, -1]
  ].map(normalize);
  const faces = [
    [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1],
    [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]
  ];
  return { vertices, faces };
};

const getD10Geom = () => {
  const vertices = [];
  const r = 1.0;
  const h = 1.25;
  const h2 = 0.32;
  
  vertices.push([0, 0, h]);
  vertices.push([0, 0, -h]);
  
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI) / 5;
    vertices.push([r * Math.cos(angle), r * Math.sin(angle), h2]);
  }
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI) / 5 + Math.PI / 5;
    vertices.push([r * Math.cos(angle), r * Math.sin(angle), -h2]);
  }
  
  const faces = [];
  for (let i = 0; i < 5; i++) {
    const u1 = 2 + i;
    const u2 = 2 + ((i + 1) % 5);
    const l1 = 7 + i;
    const l2 = 7 + ((i + 4) % 5);
    
    // Top 5 kite faces
    faces.push([0, u1, l1, u2]);
    // Bottom 5 kite faces
    faces.push([1, l2, u2, l1]);
  }
  
  return { vertices: vertices.map(normalize), faces };
};

const getD12Geom = () => {
  const t = (1 + Math.sqrt(5)) / 2;
  const inv_t = 1 / t;
  const vertices = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
    [0, -inv_t, -t], [0, -inv_t, t], [0, inv_t, -t], [0, inv_t, t],
    [-inv_t, -t, 0], [-inv_t, t, 0], [1/t, -t, 0], [1/t, t, 0],
    [-t, 0, -inv_t], [-t, 0, inv_t], [t, 0, -inv_t], [t, 0, inv_t]
  ].map(normalize);
  
  const faces = [
    [0, 8, 10, 2, 16],
    [0, 16, 17, 1, 12],
    [0, 12, 14, 4, 8],
    [1, 9, 11, 3, 17],
    [1, 12, 14, 5, 9],
    [2, 10, 6, 15, 13],
    [2, 16, 17, 3, 13],
    [3, 11, 7, 15, 13],
    [4, 14, 5, 19, 18],
    [4, 8, 10, 6, 18],
    [5, 9, 11, 7, 19],
    [6, 18, 19, 7, 15]
  ];
  return { vertices, faces };
};

const getD20Geom = () => {
  const t = (1 + Math.sqrt(5)) / 2;
  const vertices = [
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [-1, -t, 0], [1, -t, 0], [-1, t, 0], [1, t, 0],
    [-t, 0, -1], [-t, 0, 1], [t, 0, -1], [t, 0, 1]
  ].map(normalize);
  
  const faces = [
    [0, 5, 11], [0, 11, 1], [0, 1, 4], [0, 4, 9], [0, 9, 5],
    [2, 3, 10], [2, 10, 8], [2, 8, 4], [2, 4, 5], [2, 5, 3],
    [6, 7, 10], [6, 10, 1], [6, 1, 11], [6, 11, 8], [6, 8, 7],
    [9, 11, 5], [4, 8, 11], [10, 7, 1], [3, 9, 5], [2, 3, 10] // wait, let's keep it simple
  ];
  
  // Standard 20 faces for icosahedron
  const standardFaces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
  ];
  
  return { vertices, faces: standardFaces };
};

const getGeometry = (type) => {
  switch (type) {
    case 4: return getD4Geom();
    case 8: return getD8Geom();
    case 10: case 100: return getD10Geom();
    case 12: return getD12Geom();
    case 20: return getD20Geom();
    case 6: default: return getD6Geom();
  }
};

// Calculate face outer normals dynamically (convex star shape assumes center vector points out)
const calculateFaceNormals = (faces, vertices) => {
  return faces.map(face => {
    const v0 = vertices[face[0]];
    const v1 = vertices[face[1]];
    const v2 = vertices[face[2]];
    
    const ax = v1[0] - v0[0];
    const ay = v1[1] - v0[1];
    const az = v1[2] - v0[2];
    const bx = v2[0] - v0[0];
    const by = v2[1] - v0[1];
    const bz = v2[2] - v0[2];
    
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    
    // Face center to evaluate outer direction
    let cx = 0, cy = 0, cz = 0;
    face.forEach(vIdx => {
      cx += vertices[vIdx][0];
      cy += vertices[vIdx][1];
      cz += vertices[vIdx][2];
    });
    cx /= face.length;
    cy /= face.length;
    cz /= face.length;
    
    if (nx * cx + ny * cy + nz * cz < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    
    const len = Math.sqrt(nx*nx + nx*nx + nz*nz); // typo protection len calculation
    const realLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
    return realLen > 0 ? [nx/realLen, ny/realLen, nz/realLen] : [0,0,1];
  });
};

export default function DiceEffects({ activeRolls }) {
  const canvasRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const activeDiceRef = useRef([]);
  const activeParticlesRef = useRef([]);
  const processedRollIds = useRef(new Set());
  const requestRef = useRef(null);
  const rollTickRef = useRef(0);

  // Triggered when rolls update
  useEffect(() => {
    if (!activeRolls || activeRolls.length === 0) return;
    
    const latestRoll = activeRolls[activeRolls.length - 1];
    if (processedRollIds.current.has(latestRoll.rollId)) return;
    processedRollIds.current.add(latestRoll.rollId);
    
    setIsActive(true);
    spawnDiceGroup(latestRoll);
  }, [activeRolls]);

  // Setup/resize canvas
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isActive]);

  // Spawn dice from roll info
  const spawnDiceGroup = (roll) => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const color = roll.userColor || '#4f46e5';
    
    const spawnedList = [];
    
    // Compile list of dice we need to roll
    const diceToCreate = [];
    
    // 1. D20
    if (roll.d20 && roll.d20.count > 0) {
      roll.d20.rolls.forEach((r) => {
        // If advantage/disadvantage, roll the two underlying dice!
        diceToCreate.push({ type: 20, target: r.roll1 });
        if (roll.d20.mode !== 'normal' && r.roll2 !== null) {
          diceToCreate.push({ type: 20, target: r.roll2 });
        }
      });
    }
    
    // 2. Custom Pool Groups
    if (roll.dice && Array.isArray(roll.dice)) {
      roll.dice.forEach((group) => {
        group.rolls.forEach((val) => {
          diceToCreate.push({ type: group.type, target: val });
        });
      });
    }

    // Cap at 15 screen dice to avoid overcrowding and lag
    const activeCreationList = diceToCreate.slice(0, 15);
    
    activeCreationList.forEach((diceDef, index) => {
      const geom = getGeometry(diceDef.type);
      const normals = calculateFaceNormals(geom.faces, geom.vertices);
      
      // Determine face corresponding to target value
      // Custom mapping: Face index
      let targetFaceIdx = 0;
      if (diceDef.type === 100) {
        // d100 is 10-sided: values 00, 10, ... 90
        targetFaceIdx = Math.floor(diceDef.target / 10);
      } else {
        targetFaceIdx = (diceDef.target - 1) % geom.faces.length;
      }
      
      const targetLocalNormal = normals[targetFaceIdx] || [0,0,1];
      
      // Random starting position at top of screen
      const spawnX = screenWidth / 2 + (Math.random() - 0.5) * Math.min(600, screenWidth - 100);
      const spawnY = -80 - index * 60; // stagger spawns
      const spawnZ = (Math.random() - 0.5) * 50;
      
      // Starting velocities
      const vx = (Math.random() - 0.5) * 10;
      const vy = 5 + Math.random() * 8;
      const vz = (Math.random() - 0.5) * 6;
      
      // Starting rotation
      const initialRotation = qNormalize([
        Math.random(), Math.random(), Math.random(), Math.random()
      ]);
      
      // Angular velocity (rotation speed)
      const wx = (Math.random() - 0.5) * 0.4;
      const wy = (Math.random() - 0.5) * 0.4;
      const wz = (Math.random() - 0.5) * 0.4;
      
      const radius = diceDef.type === 100 ? 44 : 38; // size
      
      spawnedList.push({
        id: `die_${Date.now()}_${index}_${Math.random()}`,
        type: diceDef.type,
        target: diceDef.target,
        vertices: geom.vertices,
        faces: geom.faces,
        faceNormals: normals,
        targetLocalNormal,
        x: spawnX,
        y: spawnY,
        z: spawnZ,
        vx,
        vy,
        vz,
        rotation: initialRotation,
        wx,
        wy,
        wz,
        radius,
        color,
        life: 0,
        // Settle duration: about 1.5s (90 frames)
        duration: 90 + Math.floor(Math.random() * 25),
        state: 'rolling', // 'rolling' -> 'settling' -> 'settled'
        impactCount: 0
      });
    });
    
    activeDiceRef.current = [...activeDiceRef.current, ...spawnedList];
  };

  // Spark Particle Generator
  const spawnSparks = (x, y, color, count = 10) => {
    const newSparks = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      newSparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5, // slightly upward bias
        color,
        size: 2 + Math.random() * 3,
        alpha: 1.0,
        life: 0,
        maxLife: 30 + Math.floor(Math.random() * 20)
      });
    }
    activeParticlesRef.current = [...activeParticlesRef.current, ...newSparks];
  };

  // Golden Critical Hit confetti generator
  const spawnCelebration = (x, y) => {
    const newConfetti = [];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      // Gold and star colors
      const colors = ['#fbbf24', '#f59e0b', '#fb7185', '#38bdf8', '#a78bfa'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      newConfetti.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5,
        color,
        size: 3 + Math.random() * 4,
        alpha: 1.0,
        life: 0,
        maxLife: 60 + Math.floor(Math.random() * 30),
        gravity: 0.15,
        drag: 0.98
      });
    }
    activeParticlesRef.current = [...activeParticlesRef.current, ...newConfetti];
  };

  // Main animation tick
  const tick = () => {
    rollTickRef.current = (rollTickRef.current + 1) % 1000;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, screenWidth, screenHeight);
    
    // Physics parameters
    const gravity = 0.5;
    const drag = 0.99;
    const angularDrag = 0.98;
    const floorBounce = 0.55;
    const wallBounce = 0.65;
    
    // 1. Update & Render Particles
    activeParticlesRef.current = activeParticlesRef.current.map(p => {
      const g = p.gravity !== undefined ? p.gravity : 0.05;
      const d = p.drag !== undefined ? p.drag : 0.96;
      
      const nextX = p.x + p.vx;
      const nextY = p.y + p.vy;
      
      return {
        ...p,
        x: nextX,
        y: nextY,
        vx: p.vx * d,
        vy: (p.vy + g) * d,
        alpha: 1.0 - (p.life / p.maxLife),
        life: p.life + 1
      };
    }).filter(p => p.life < p.maxLife);
    
    // Render particles
    activeParticlesRef.current.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 2. Update Physics of Dice
    activeDiceRef.current = activeDiceRef.current.map(d => {
      let { x, y, z, vx, vy, vz, rotation, wx, wy, wz, state, life, impactCount } = d;
      life += 1;
      
      if (state === 'rolling') {
        // standard physics
        x += vx;
        y += vy;
        z += vz;
        vy += gravity;
        
        vx *= drag;
        vy *= drag;
        vz *= drag;
        
        // Update rotation using quaternion multiplication
        const angularSpeed = Math.sqrt(wx*wx + wy*wy + wz*wz);
        if (angularSpeed > 0.001) {
          const axis = [wx / angularSpeed, wy / angularSpeed, wz / angularSpeed];
          const deltaQ = qFromAxisAngle(axis, angularSpeed);
          rotation = qNormalize(qMultiply(rotation, deltaQ));
        }
        
        wx *= angularDrag;
        wy *= angularDrag;
        wz *= angularDrag;
        
        // Boundary check (Bottom floor)
        const radius = d.radius;
        if (y >= screenHeight - radius) {
          y = screenHeight - radius;
          vy = -vy * floorBounce;
          vx *= 0.8; // floor sliding friction
          vz *= 0.8;
          
          // Randomize angular velocity slightly on bounce to look organic
          wx += (Math.random() - 0.5) * 0.2;
          wy += (Math.random() - 0.5) * 0.2;
          wz += (Math.random() - 0.5) * 0.2;
          
          impactCount += 1;
          
          // Spawn sparks on impact
          if (Math.abs(vy) > 1.5) {
            spawnSparks(x, y, d.color, 8);
          }
        }
        
        // Wall collisions
        if (x <= radius) {
          x = radius;
          vx = -vx * wallBounce;
          spawnSparks(x, y, d.color, 5);
        } else if (x >= screenWidth - radius) {
          x = screenWidth - radius;
          vx = -vx * wallBounce;
          spawnSparks(x, y, d.color, 5);
        }
        
        // Move to settling state when nearing duration limit
        if (life >= d.duration - 35) {
          state = 'settling';
        }
      } else if (state === 'settling') {
        // Slowly align target face with screen
        // Calculate target rotation to make local target normal point directly at camera (0, 0, 1)
        const qTarget = getRotationToAlignNormal(d.targetLocalNormal, [0, 0, 1]);
        
        // Interpolate rotation
        rotation = qLerp(rotation, qTarget, 0.12);
        
        // Decelerate linear position
        x += vx;
        y += vy;
        z += vz;
        vy += gravity;
        
        // Slide / settle on floor
        const radius = d.radius;
        if (y >= screenHeight - radius) {
          y = screenHeight - radius;
          vy = -vy * 0.3; // extra damping
          vx *= 0.6;
          vz *= 0.6;
        }
        
        vx *= 0.9;
        vy *= 0.9;
        vz *= 0.9;
        
        // Angular velocity drops
        wx *= 0.7;
        wy *= 0.7;
        wz *= 0.7;
        
        // Fully rest after transition
        if (life >= d.duration) {
          state = 'settled';
          vx = vy = vz = 0;
          wx = wy = wz = 0;
          rotation = qTarget; // snap to exact alignment
          
          // Spawn critical celebration if lands max value or natural 20
          const isMaxVal = d.target === d.type;
          const isCritD20 = d.type === 20 && d.target === 20;
          if (isCritD20 || (isMaxVal && d.type >= 6)) {
            spawnCelebration(x, y);
          } else {
            // normal settle spark ring
            spawnSparks(x, y, d.color, 12);
          }
        }
      } else if (state === 'settled') {
        // just rest on the floor
        y = screenHeight - d.radius;
      }
      
      return {
        ...d,
        x, y, z, vx, vy, vz, rotation, wx, wy, wz, state, life, impactCount
      };
    });

    // 3. Render Dice
    activeDiceRef.current.forEach(die => {
      const { x, y, z, radius, color, rotation } = die;
      
      // Light source (pointing down, right, and forward)
      const light = normalize([-0.5, 0.7, 1]);
      
      // Focal length for perspective projection
      const focalLength = 300;
      
      // Project 3D vertices relative to center (x, y, z)
      const projected = die.vertices.map(v => {
        // Rotate local vertex by current quaternion
        const rotV = qRotateVector(rotation, v);
        // Scale by radius
        const rx = rotV[0] * radius;
        const ry = rotV[1] * radius;
        const rz = rotV[2] * radius;
        
        // 3D position in camera space
        const cx = x + rx;
        const cy = y + ry;
        const cz = z + rz;
        
        // Perspective projection formula
        const scale = focalLength / (focalLength + cz);
        const px = x + rx * scale;
        const py = y + ry * scale;
        
        return { x: px, y: py, z: cz };
      });
      
      // Compute world space normals for lighting & culling
      const worldNormals = die.faceNormals.map(n => qRotateVector(rotation, n));
      
      // Gather visible faces (back-face culling)
      // Since camera looks along -Z, faces are visible if worldNormal.z > 0
      const facesWithZ = die.faces.map((face, index) => {
        const wn = worldNormals[index];
        // Calculate center of face in world coordinates for layering/sorting if needed
        let avgZ = 0;
        face.forEach(vIdx => {
          avgZ += projected[vIdx].z;
        });
        avgZ /= face.length;
        
        return {
          face,
          index,
          normal: wn,
          avgZ,
          isVisible: wn[2] > -0.1 // small threshold to draw slightly turned faces
        };
      }).filter(f => f.isVisible);
      
      // Sort faces by depth (back-to-front rendering)
      facesWithZ.sort((a, b) => b.avgZ - a.avgZ);
      
      // Draw faces
      facesWithZ.forEach(faceObj => {
        const { face, index, normal } = faceObj;
        
        // Flat shading lighting intensity
        const dotProd = normal[0]*light[0] + normal[1]*light[1] + normal[2]*light[2];
        const intensity = Math.max(0.15, Math.min(0.95, (dotProd + 1) * 0.5));
        
        // Generate neon shaded colors
        ctx.save();
        ctx.beginPath();
        
        // Move to first vertex of face
        ctx.moveTo(projected[face[0]].x, projected[face[0]].y);
        for (let i = 1; i < face.length; i++) {
          ctx.lineTo(projected[face[i]].x, projected[face[i]].y);
        }
        ctx.closePath();
        
        // Style face fill
        // Shading blend: mix color with black/white based on intensity
        ctx.fillStyle = blendColor(color, '#0d0e12', 1 - intensity);
        ctx.fill();
        
        // Border outline (neon glowing border)
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = color;
        ctx.stroke();
        
        // Draw Number on Face
        // Calculate face center in screen coordinates
        let pCenterX = 0, pCenterY = 0;
        face.forEach(vIdx => {
          pCenterX += projected[vIdx].x;
          pCenterY += projected[vIdx].y;
        });
        pCenterX /= face.length;
        pCenterY /= face.length;
        
        // Values mapping
        let valueText = (index + 1).toString();
        if (die.type === 100) {
          // d100 shows 00, 10, 20...
          valueText = (index * 10).toString().padStart(2, '0');
        } else if (die.type === 10) {
          // d10 shows 0..9 (0 is 10)
          const val = (index + 1) % 10;
          valueText = val.toString();
        }
        
        // Shading numbers for readability
        // Faces that face the camera directly have normal.z close to 1.0
        // We fade the text for side faces
        const faceAlignment = normal[2]; // 0 to 1
        if (faceAlignment > 0.25) {
          ctx.globalAlpha = Math.max(0, Math.min(1, (faceAlignment - 0.25) * 1.5));
          ctx.fillStyle = faceAlignment > 0.75 ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
          ctx.font = `bold ${Math.floor(radius * 0.45)}px font-mono, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Draw text shadow
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#000000';
          
          ctx.fillText(valueText, pCenterX, pCenterY);
        }
        
        ctx.restore();
      });
      
      // Draw neon floor shadow if close to floor
      if (y > screenHeight - radius - 150) {
        const shadowDist = screenHeight - y - radius;
        const shadowAlpha = Math.max(0, 0.35 * (1 - shadowDist / 150));
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = shadowAlpha;
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
        ctx.beginPath();
        // Scale shadow based on height
        const shadowW = radius * (1 + shadowDist / 50);
        ctx.ellipse(x, screenHeight - 2, shadowW, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    // Cleanup: If all dice are settled and have rested for 1.8 seconds, fade out and stop loop
    const allSettled = activeDiceRef.current.every(d => d.state === 'settled');
    const allLifeOver = activeDiceRef.current.every(d => d.life > d.duration + 110);
    
    if (activeDiceRef.current.length > 0 && allSettled && allLifeOver && activeParticlesRef.current.length === 0) {
      // Fade canvas out
      setIsActive(false);
      activeDiceRef.current = [];
    } else {
      requestRef.current = requestAnimationFrame(tick);
    }
  };

  // Run loops
  useEffect(() => {
    if (isActive) {
      requestRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 w-full h-full"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}

// Color blending helper for flat shading
function blendColor(color, backdrop, weight) {
  // Simple hex parses
  let cHex = color.replace('#', '');
  if (cHex.length === 3) {
    cHex = cHex.split('').map(c => c + c).join('');
  }
  const r1 = parseInt(cHex.substring(0, 2), 16);
  const g1 = parseInt(cHex.substring(2, 4), 16);
  const b1 = parseInt(cHex.substring(4, 6), 16);

  let bHex = backdrop.replace('#', '');
  if (bHex.length === 3) {
    bHex = bHex.split('').map(b => b + b).join('');
  }
  const r2 = parseInt(bHex.substring(0, 2), 16);
  const g2 = parseInt(bHex.substring(2, 4), 16);
  const b2 = parseInt(bHex.substring(4, 6), 16);

  const r = Math.round(r1 * (1 - weight) + r2 * weight);
  const g = Math.round(g1 * (1 - weight) + g2 * weight);
  const b = Math.round(b1 * (1 - weight) + b2 * weight);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
