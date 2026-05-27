/**
 * Quaternion and Vector Mathematics for 3D Dice physics and rotation alignments.
 * Decoupled from React and Three.js dependencies for standalone testability.
 */

export const qMultiply = (q1, q2) => {
  const [x1, y1, z1, w1] = q1;
  const [x2, y2, z2, w2] = q2;
  return [
    w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
    w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
    w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
    w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2
  ];
};

export const qNormalize = (q) => {
  const [x, y, z, w] = q;
  const len = Math.sqrt(x * x + y * y + z * z + w * w);
  if (len === 0) return [0, 0, 0, 1];
  return [x / len, y / len, z / len, w / len];
};

export const qRotateVector = (q, v) => {
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

export const qLerp = (q1, q2, t) => {
  const dot = q1[0] * q2[0] + q1[1] * q2[1] + q1[2] * q2[2] + q1[3] * q2[3];
  const q2Target = dot < 0 ? [-q2[0], -q2[1], -q2[2], -q2[3]] : q2;
  
  return qNormalize([
    q1[0] * (1 - t) + q2Target[0] * t,
    q1[1] * (1 - t) + q2Target[1] * t,
    q1[2] * (1 - t) + q2Target[2] * t,
    q1[3] * (1 - t) + q2Target[3] * t
  ]);
};

export const qFromAxisAngle = (axis, angle) => {
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

export const getRotationToAlignNormal = (localNormal, targetWorldNormal = [0, 0, 1]) => {
  const [lx, ly, lz] = localNormal;
  const [wx, wy, wz] = targetWorldNormal;
  
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

export const normalize = (v) => {
  const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  return len > 0 ? [v[0]/len, v[1]/len, v[2]/len] : [0,0,0];
};
