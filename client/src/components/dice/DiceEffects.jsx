import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  qMultiply,
  qNormalize,
  qRotateVector,
  qLerp,
  qFromAxisAngle,
  getRotationToAlignNormal
} from './DiceMath.js';
import {
  getGeometryData,
  getFaceNormal,
  createThreeGeometry
} from './DiceGeometries.js';
import {
  generateSparks,
  generateCelebration,
  generateCritSuccess,
  generateCritFailure
} from './DiceParticles.js';

// Dynamic canvas texture creator for the face numbers
const createTextTexture = (text) => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  
  // Draw glowing text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 85px font-mono, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  ctx.fillText(text, 64, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

// React Component
export default function DiceEffects({ activeRolls, onCriticalRoll, diceSizeMultiplier = 1.0 }) {
  const canvasWebGLRef = useRef(null);
  const canvas2dRef = useRef(null);
  
  const [isActive, setIsActive] = useState(false);
  const processedRollIds = useRef(new Set());
  
  const diceDataRef = useRef([]); // Physics states
  const sceneDiceRef = useRef([]); // Three.js meshes
  const activeParticlesRef = useRef([]); // 2D sparkles
  
  // Three.js instances
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const frameRequestRef = useRef(null);
  const rollTickRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  const spawnDiceGroup = useCallback((roll) => {
    const scene = sceneRef.current;
    if (!scene) return;
    
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const colorStr = roll.userColor || '#4f46e5';
    
    // Compile list of dice we need to roll
    const diceToCreate = [];
    if (roll.d20 && roll.d20.count > 0) {
      roll.d20.rolls.forEach((r) => {
        diceToCreate.push({ type: 20, target: r.roll1 });
        if (roll.d20.mode !== 'normal' && r.roll2 !== null) {
          diceToCreate.push({ type: 20, target: r.roll2 });
        }
      });
    }
    if (roll.dice && Array.isArray(roll.dice)) {
      roll.dice.forEach((group) => {
        group.rolls.forEach((val) => {
          diceToCreate.push({ type: group.type, target: val });
        });
      });
    }

    const maxDice = diceToCreate.slice(0, 15);
    const newDiceData = [];
    const newMeshes = [];
    
    maxDice.forEach((diceDef, index) => {
      const geomData = getGeometryData(diceDef.type);
      const geom = createThreeGeometry(geomData.vertices, geomData.faces);
      
      // Calculate face normals and centers in local space
      const faceNormals = geomData.faces.map(face => getFaceNormal(face, geomData.vertices));
      const faceCenters = geomData.faces.map(face => {
        let cx = 0, cy = 0, cz = 0;
        face.forEach(vIdx => {
          cx += geomData.vertices[vIdx][0];
          cy += geomData.vertices[vIdx][1];
          cz += geomData.vertices[vIdx][2];
        });
        return [cx / face.length, cy / face.length, cz / face.length];
      });
      
      const targetFaceIdx = diceDef.type === 100
        ? Math.floor(diceDef.target / 10)
        : (diceDef.target - 1) % geomData.faces.length;
      
      const targetLocalNormal = faceNormals[targetFaceIdx] || [0,0,1];
      
      // 3D Die Mesh Construction
      // Premium glossy material for body
      const bodyMat = new THREE.MeshPhongMaterial({
        color: new THREE.Color(colorStr),
        transparent: true,
        opacity: 0.8,
        shininess: 90,
        specular: 0x333333,
        side: THREE.DoubleSide
      });
      
      const dieMesh = new THREE.Mesh(geom, bodyMat);
      
      // Bright edge wireframe
      const edges = new THREE.EdgesGeometry(geom);
      const edgeMat = new THREE.LineBasicMaterial({ color: colorStr, linewidth: 2 });
      const wireframe = new THREE.LineSegments(edges, edgeMat);
      dieMesh.add(wireframe);
      
      // Generate numbers on planes as children
      geomData.faces.forEach((face, fIdx) => {
        let text = (fIdx + 1).toString();
        if (diceDef.type === 100) {
          text = (fIdx * 10).toString().padStart(2, '0');
        } else if (diceDef.type === 10) {
          text = ((fIdx + 1) % 10).toString();
        }
        
        const ln = faceNormals[fIdx];
        const lc = faceCenters[fIdx];
        
        // Canvas texture
        const numTex = createTextTexture(text);
        const numMat = new THREE.MeshBasicMaterial({
          map: numTex,
          transparent: true,
          depthWrite: true,
          side: THREE.DoubleSide
        });
        
        // Size scale based on shape complexity
        const sizeScale = diceDef.type === 20 ? 0.35 : 0.44;
        const textGeom = new THREE.PlaneGeometry(sizeScale, sizeScale);
        const textMesh = new THREE.Mesh(textGeom, numMat);
        
        // Position plane slightly offset outwards from center to prevent clipping
        const offset = 0.025;
        textMesh.position.set(
          lc[0] + ln[0] * offset,
          lc[1] + ln[1] * offset,
          lc[2] + ln[2] * offset
        );
        
        // Align plane normal with face normal
        textMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(ln[0], ln[1], ln[2]).normalize());
        dieMesh.add(textMesh);
      });
      
      // Set physical scale (size in pixels)
      const radius = (diceDef.type === 100 ? 46 : 38) * diceSizeMultiplier;
      dieMesh.scale.setScalar(radius);
      
      // Initial Position (mapped to Pixel coordinate system with 0,0 at screen center)
      const startX = (Math.random() - 0.5) * Math.min(500, screenWidth - 100);
      const startY = (screenHeight / 2) + 100 + index * 60; // Spawn above the visible ceiling
      const startZ = (Math.random() - 0.5) * 60;
      
      dieMesh.position.set(startX, startY, startZ);
      
      // Initial rotation
      const initQ = qNormalize([Math.random(), Math.random(), Math.random(), Math.random()]);
      dieMesh.quaternion.set(initQ[0], initQ[1], initQ[2], initQ[3]);
      
      scene.add(dieMesh);
      newMeshes.push(dieMesh);
      
      // Velocities (Linear & Angular)
      const vx = (Math.random() - 0.5) * 12;
      const vy = -6 - Math.random() * 8; // move downwards rapidly
      const vz = (Math.random() - 0.5) * 8;
      
      const wx = (Math.random() - 0.5) * 0.45;
      const wy = (Math.random() - 0.5) * 0.45;
      const wz = (Math.random() - 0.5) * 0.45;
      
      newDiceData.push({
        id: `die_${Date.now()}_${index}`,
        type: diceDef.type,
        target: diceDef.target,
        targetLocalNormal,
        x: startX,
        y: startY,
        z: startZ,
        vx,
        vy,
        vz,
        rotation: initQ,
        wx,
        wy,
        wz,
        radius,
        color: colorStr,
        life: 0,
        duration: 90 + Math.floor(Math.random() * 25),
        state: 'rolling', // 'rolling' | 'settling' | 'settled'
        hasMaxCelebrated: false
      });
    });
    
    diceDataRef.current = [...diceDataRef.current, ...newDiceData];
    sceneDiceRef.current = [...sceneDiceRef.current, ...newMeshes];
  }, [diceSizeMultiplier]);

  // 1. Listen for new rolls
  useEffect(() => {
    if (!activeRolls || activeRolls.length === 0) return;
    
    const latestRoll = activeRolls[activeRolls.length - 1];
    if (processedRollIds.current.has(latestRoll.rollId)) return;
    processedRollIds.current.add(latestRoll.rollId);
    
    setIsActive(true);
    
    // Stagger spawn shortly to ensure canvas sizing completes
    setTimeout(() => {
      spawnDiceGroup(latestRoll);
    }, 50);
  }, [activeRolls, spawnDiceGroup]);

  // 2. Setup Three.js Context
  useEffect(() => {
    if (!isActive) return;
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // WebGL Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasWebGLRef.current,
      alpha: true,
      antialias: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    
    // Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    // Camera Setup (Map viewport to pixel coordinates at z = 0)
    const fov = 45;
    const distance = height / (2 * Math.tan((fov * Math.PI) / 360));
    const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 10000);
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(-width / 4, height / 2, distance / 2);
    scene.add(dirLight);
    
    // Setup 2D overlay size
    if (canvas2dRef.current) {
      canvas2dRef.current.width = width;
      canvas2dRef.current.height = height;
    }
    
    // Resize Listener
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.setSize(w, h);
        cameraRef.current.aspect = w / h;
        const dist = h / (2 * Math.tan((fov * Math.PI) / 360));
        cameraRef.current.position.set(0, 0, dist);
        cameraRef.current.updateProjectionMatrix();
      }
      if (canvas2dRef.current) {
        canvas2dRef.current.width = w;
        canvas2dRef.current.height = h;
      }
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      
      // Cleanup meshes
      sceneDiceRef.current.forEach(mesh => {
        scene.remove(mesh);
        mesh.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      });
      sceneDiceRef.current = [];
      diceDataRef.current = [];
      
      renderer.dispose();
    };
  }, [isActive]);

  // Run Tick Loops & Animation Updates
  useEffect(() => {
    if (!isActive) return;

    const tick = (now) => {
      const timestamp = now || performance.now();
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = timestamp;
      }
      let dt = (timestamp - lastFrameTimeRef.current) / 16.6667;
      lastFrameTimeRef.current = timestamp;

      // Cap dt to prevent massive physics jumps on extreme lag spikes or backgrounding
      if (dt > 4.0) dt = 4.0;
      if (dt < 0) dt = 0;

      rollTickRef.current = (rollTickRef.current + 1) % 1000;
      
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Physics Parameters (relative to screen pixel sizing)
      const gravity = -0.55; // gravity pulls in negative Y in three.js coordinates
      const drag = 0.992;
      const bounce = 0.58;
      const wallBounce = 0.65;
      
      // 1. Update 2D particles
      activeParticlesRef.current = activeParticlesRef.current.map(p => {
        const gravityBias = p.type === 'text' || p.type === 'ring' ? 0 : 0.08;
        const dragFactor = p.type === 'ring' ? 1.0 : 0.96;
        return {
          ...p,
          x: p.x + p.vx * dt,
          y: p.y + p.vy * dt,
          vx: p.vx * Math.pow(dragFactor, dt),
          vy: (p.vy + gravityBias * dt) * Math.pow(dragFactor, dt),
          radius: p.type === 'ring' ? p.radius + (p.growSpeed || 0) * dt : p.radius,
          alpha: 1.0 - (p.life / p.maxLife),
          life: p.life + dt
        };
      }).filter(p => p.life < p.maxLife);
      
      // Render 2D particles overlay
      const ctx = canvas2dRef.current?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        activeParticlesRef.current.forEach(p => {
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(p.alpha, 1.0));
          
          if (p.type === 'ring') {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.lineWidth || 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.stroke();
          } else if (p.type === 'text') {
            ctx.fillStyle = p.color;
            ctx.font = p.font || 'bold 24px monospace';
            ctx.shadowColor = p.shadowColor || 'black';
            ctx.shadowBlur = 8;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.text, p.x, p.y);
          } else if (p.type === 'star') {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            const spikes = 5;
            const outerRadius = p.size;
            const innerRadius = p.size / 2;
            let rot = Math.PI / 2 * 3;
            let cx = p.x;
            let cy = p.y;
            const step = Math.PI / spikes;

            ctx.moveTo(cx, cy - outerRadius);
            for (let i = 0; i < spikes; i++) {
              cx = p.x + Math.cos(rot) * outerRadius;
              cy = p.y + Math.sin(rot) * outerRadius;
              ctx.lineTo(cx, cy);
              rot += step;

              cx = p.x + Math.cos(rot) * innerRadius;
              cy = p.y + Math.sin(rot) * innerRadius;
              ctx.lineTo(cx, cy);
              rot += step;
            }
            ctx.lineTo(p.x, p.y - outerRadius);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        });
      }

      // 2. Physics updates for dice
      diceDataRef.current = diceDataRef.current.map((d, index) => {
        let { x, y, z, vx, vy, vz, rotation, wx, wy, wz, state, life, hasMaxCelebrated } = d;
        life += dt;
        
        const mesh = sceneDiceRef.current[index];
        const radius = d.radius;
        
        // Screen space limits (Three.js origin is at screen center)
        const leftLimit = -width / 2 + radius;
        const rightLimit = width / 2 - radius;
        const bottomLimit = -height / 2 + radius + 180; // Raised bottom limit to prevent clipping behind bottom toolbar

        if (state === 'rolling') {
          x += vx * dt;
          y += vy * dt;
          z += vz * dt;
          vy += gravity * dt; // Pull down
          
          vx *= Math.pow(drag, dt);
          vy *= Math.pow(drag, dt);
          vz *= Math.pow(drag, dt);
          
          // Quaternion rotation accumulation
          const wSpeed = Math.sqrt(wx*wx + wy*wy + wz*wz);
          if (wSpeed > 0.001) {
            const axis = [wx / wSpeed, wy / wSpeed, wz / wSpeed];
            const deltaQ = qFromAxisAngle(axis, wSpeed * dt);
            rotation = qNormalize(qMultiply(rotation, deltaQ));
          }
          wx *= Math.pow(0.985, dt);
          wy *= Math.pow(0.985, dt);
          wz *= Math.pow(0.985, dt);
          
          // Bounce floor (bottomLimit)
          if (y <= bottomLimit) {
            y = bottomLimit;
            vy = -vy * bounce;
            vx *= Math.pow(0.85, dt); // slide drag
            vz *= Math.pow(0.85, dt);
            
            // Randomize angular momentum slightly on bounce
            wx += (Math.random() - 0.5) * 0.15 * dt;
            wy += (Math.random() - 0.5) * 0.15 * dt;
            wz += (Math.random() - 0.5) * 0.15 * dt;
            
            if (Math.abs(vy) > 1.2) {
              const particleX = x + width / 2;
              const particleY = height / 2 - y;
              activeParticlesRef.current.push(...generateSparks(particleX, particleY, d.color, 8));
            }
          }
          
          // Bounce walls
          if (x <= leftLimit) {
            x = leftLimit;
            vx = -vx * wallBounce;
            activeParticlesRef.current.push(...generateSparks(x + width/2, height/2 - y, d.color, 5));
          } else if (x >= rightLimit) {
            x = rightLimit;
            vx = -vx * wallBounce;
            activeParticlesRef.current.push(...generateSparks(x + width/2, height/2 - y, d.color, 5));
          }
          
          // Transition to settle phase
          if (life >= d.duration - 35) {
            state = 'settling';
          }
        } else if (state === 'settling') {
          // Torque-settle
          const camZ = cameraRef.current ? cameraRef.current.position.z : 900;
          const toCam = [-x, -y, camZ - z];
          const len = Math.sqrt(toCam[0]*toCam[0] + toCam[1]*toCam[1] + toCam[2]*toCam[2]);
          const targetWorldNormal = len > 0 ? [toCam[0]/len, toCam[1]/len, toCam[2]/len] : [0, 0, 1];
          
          const qTarget = getRotationToAlignNormal(d.targetLocalNormal, targetWorldNormal);
          
          // Smoothly interpolate rotation
          const lerpFactor = 1 - Math.pow(1 - 0.13, dt);
          rotation = qLerp(rotation, qTarget, lerpFactor);
          
          // Decelerate positions
          x += vx * dt;
          y += vy * dt;
          z += vz * dt;
          vy += gravity * dt;
          
          if (y <= bottomLimit) {
            y = bottomLimit;
            vy = -vy * 0.25; // heavy damping
            vx *= Math.pow(0.65, dt);
            vz *= Math.pow(0.65, dt);
          }
          vx *= Math.pow(0.88, dt);
          vy *= Math.pow(0.88, dt);
          vz *= Math.pow(0.88, dt);
          
          wx *= Math.pow(0.65, dt);
          wy *= Math.pow(0.65, dt);
          wz *= Math.pow(0.65, dt);
          
          if (life >= d.duration) {
            state = 'settled';
            vx = vy = vz = 0;
            wx = wy = wz = 0;
            
            const finalCamZ = cameraRef.current ? cameraRef.current.position.z : 900;
            const finalToCam = [-x, -y, finalCamZ - z];
            const finalLen = Math.sqrt(finalToCam[0]*finalToCam[0] + finalToCam[1]*finalToCam[1] + finalToCam[2]*finalToCam[2]);
            const finalTargetWorldNormal = finalLen > 0 ? [finalToCam[0]/finalLen, finalToCam[1]/finalLen, finalToCam[2]/finalLen] : [0, 0, 1];
            rotation = getRotationToAlignNormal(d.targetLocalNormal, finalTargetWorldNormal);
          }
        } else if (state === 'settled') {
          y = bottomLimit;
          
          if (!hasMaxCelebrated) {
            hasMaxCelebrated = true;
            const isCrit20 = d.type === 20 && d.target === 20;
            const isCrit1 = d.type === 20 && d.target === 1;
            const isMaxVal = d.target === d.type;
            
            const particleX = x + width / 2;
            const particleY = height / 2 - y;
            
            if (isCrit20) {
              activeParticlesRef.current.push(...generateCritSuccess(particleX, particleY));
              if (onCriticalRoll) onCriticalRoll({ type: 20, value: 20 });
            } else if (isCrit1) {
              activeParticlesRef.current.push(...generateCritFailure(particleX, particleY));
              if (onCriticalRoll) onCriticalRoll({ type: 20, value: 1 });
            } else if (isMaxVal && d.type >= 6) {
              activeParticlesRef.current.push(...generateCelebration(particleX, particleY));
            } else {
              activeParticlesRef.current.push(...generateSparks(particleX, particleY, d.color, 12));
            }
          }
        }
        
        // Apply states to Three.js meshes
        if (mesh) {
          mesh.position.set(x, y, z);
          mesh.quaternion.set(rotation[0], rotation[1], rotation[2], rotation[3]);

          const camZ = cameraRef.current ? cameraRef.current.position.z : 900;
          const toCamX = -x;
          const toCamY = -y;
          const toCamZ = camZ - z;
          const toCamLen = Math.sqrt(toCamX*toCamX + toCamY*toCamY + toCamZ*toCamZ);
          const toCamNormal = toCamLen > 0 ? [toCamX/toCamLen, toCamY/toCamLen, toCamZ/toCamLen] : [0, 0, 1];

          const geomData = getGeometryData(d.type);
          const faceNormals = geomData.faces.map(face => getFaceNormal(face, geomData.vertices));

          let textChildIndex = 0;
          mesh.children.forEach(child => {
            if (child.material && child.material.map) {
              const fIdx = textChildIndex;
              textChildIndex++;

              const ln = faceNormals[fIdx] || [0, 0, 1];
              const worldNormal = qRotateVector(rotation, ln);
              const dot = worldNormal[0]*toCamNormal[0] + worldNormal[1]*toCamNormal[1] + worldNormal[2]*toCamNormal[2];

              const isTargetFace = d.type === 100
                ? (fIdx === Math.floor(d.target / 10))
                : (fIdx === ((d.target - 1) % geomData.faces.length));

              if (state === 'settled' && isTargetFace) {
                child.material.opacity = 1.0;
              } else {
                const minFaceVisibility = d.type === 20 ? 0.35 : 0.25;
                if (dot > minFaceVisibility) {
                  child.material.opacity = Math.min(1.0, (dot - minFaceVisibility) * (1 / (1 - minFaceVisibility)));
                } else {
                  child.material.opacity = 0;
                }
              }
            }
          });
        }
        
        return {
          ...d,
          x, y, z, vx, vy, vz, rotation, wx, wy, wz, state, life, hasMaxCelebrated
        };
      });

      // 3. Render Three.js WebGL Scene
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      
      // Loop control
      const allSettled = diceDataRef.current.every(d => d.state === 'settled');
      const allLifeOver = diceDataRef.current.every(d => d.life > d.duration + 100);
      
      if (diceDataRef.current.length > 0 && allSettled && allLifeOver && activeParticlesRef.current.length === 0) {
        setIsActive(false);
        diceDataRef.current = [];
        lastFrameTimeRef.current = 0;
      } else {
        frameRequestRef.current = requestAnimationFrame(tick);
      }
    };

    lastFrameTimeRef.current = 0; // ensure reset
    frameRequestRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRequestRef.current) cancelAnimationFrame(frameRequestRef.current);
    };
  }, [isActive, onCriticalRoll, diceSizeMultiplier]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 w-full h-full">
      {/* WebGL Canvas */}
      <canvas
        ref={canvasWebGLRef}
        className="w-full h-full absolute inset-0"
      />
      {/* 2D overlay for particles */}
      <canvas
        ref={canvas2dRef}
        className="w-full h-full absolute inset-0"
      />
    </div>
  );
}
