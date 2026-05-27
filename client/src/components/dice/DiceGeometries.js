import * as THREE from 'three';
import { normalize } from './DiceMath.js';

export const getD4Geom = () => {
  const vertices = [
    [1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]
  ].map(normalize);
  const faces = [
    [0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]
  ];
  return { vertices, faces };
};

export const getD6Geom = () => {
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

export const getD8Geom = () => {
  const vertices = [
    [0, 0, 1], [1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0], [0, 0, -1]
  ].map(normalize);
  const faces = [
    [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1],
    [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]
  ];
  return { vertices, faces };
};

export const getD10Geom = () => {
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
    faces.push([0, u1, l1, u2]);
    faces.push([1, l1, u1, l2]);
  }
  
  return { vertices: vertices.map(normalize), faces };
};

export const getD12Geom = () => {
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
    [0, 8, 1, 14, 12],
    [0, 16, 3, 10, 8],
    [0, 12, 4, 17, 16],
    [1, 8, 10, 2, 18],
    [1, 18, 19, 5, 14],
    [2, 10, 3, 13, 15],
    [2, 15, 6, 19, 18],
    [3, 16, 17, 7, 13],
    [4, 12, 14, 5, 9],
    [4, 9, 11, 7, 17],
    [5, 19, 6, 11, 9],
    [6, 15, 13, 7, 11]
  ];
  return { vertices, faces };
};

export const getD20Geom = () => {
  const t = (1 + Math.sqrt(5)) / 2;
  const vertices = [
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [-1, -t, 0], [1, -t, 0], [-1, t, 0], [1, t, 0],
    [-t, 0, -1], [-t, 0, 1], [t, 0, -1], [t, 0, 1]
  ].map(normalize);
  
  const faces = [
    [0, 1, 9], [0, 11, 1], [0, 4, 5], [0, 9, 4], [0, 5, 11],
    [1, 7, 6], [1, 6, 9], [1, 11, 7], [2, 8, 3], [2, 3, 10],
    [2, 5, 4], [2, 4, 8], [2, 10, 5], [3, 6, 7], [3, 8, 6],
    [3, 7, 10], [4, 9, 8], [5, 10, 11], [6, 8, 9], [7, 11, 10]
  ];
  return { vertices, faces };
};

export const getGeometryData = (type) => {
  switch (type) {
    case 4: return getD4Geom();
    case 8: return getD8Geom();
    case 10: case 100: return getD10Geom();
    case 12: return getD12Geom();
    case 20: return getD20Geom();
    case 6: default: return getD6Geom();
  }
};

// Calculate face normals pointing outwards
export const getFaceNormal = (face, vertices) => {
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
  const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
  return len > 0 ? [nx/len, ny/len, nz/len] : [0,0,1];
};

export const createThreeGeometry = (vertices, faces) => {
  const geom = new THREE.BufferGeometry();
  const triIndices = [];
  
  faces.forEach(face => {
    if (face.length === 3) {
      triIndices.push(face[0], face[1], face[2]);
    } else if (face.length === 4) {
      triIndices.push(face[0], face[1], face[2]);
      triIndices.push(face[0], face[2], face[3]);
    } else if (face.length === 5) {
      triIndices.push(face[0], face[1], face[2]);
      triIndices.push(face[0], face[2], face[3]);
      triIndices.push(face[0], face[3], face[4]);
    }
  });
  
  const vertexData = [];
  vertices.forEach(v => {
    vertexData.push(v[0], v[1], v[2]);
  });
  
  geom.setAttribute('position', new THREE.Float32BufferAttribute(vertexData, 3));
  geom.setIndex(triIndices);
  geom.computeVertexNormals();
  return geom;
};
