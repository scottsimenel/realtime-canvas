import { describe, expect, test } from 'vitest';
import {
  qMultiply,
  qNormalize,
  qRotateVector,
  qLerp,
  qFromAxisAngle,
  getRotationToAlignNormal,
  normalize
} from '../DiceMath.js';

describe('DiceMath utilities', () => {
  test('qMultiply multiplies two quaternions correctly', () => {
    // Identity * Identity = Identity
    const q1 = [0, 0, 0, 1];
    const q2 = [0, 0, 0, 1];
    expect(qMultiply(q1, q2)).toEqual([0, 0, 0, 1]);
  });

  test('qNormalize normalizes a quaternion', () => {
    const q = [0, 2, 0, 0];
    expect(qNormalize(q)).toEqual([0, 1, 0, 0]);
    expect(qNormalize([0, 0, 0, 0])).toEqual([0, 0, 0, 1]);
  });

  test('qRotateVector rotates a vector by a quaternion', () => {
    // Rotate [1, 0, 0] by 90 degrees around Z axis
    // Quaternion for Z-axis 90 deg rotation: [0, 0, sin(45deg), cos(45deg)]
    const sin45 = Math.sin(Math.PI / 4);
    const cos45 = Math.cos(Math.PI / 4);
    const q = [0, 0, sin45, cos45];
    const v = [1, 0, 0];
    const rotated = qRotateVector(q, v);
    
    expect(rotated[0]).toBeCloseTo(0, 5);
    expect(rotated[1]).toBeCloseTo(1, 5);
    expect(rotated[2]).toBeCloseTo(0, 5);
  });

  test('qLerp interpolates between two quaternions', () => {
    const q1 = [0, 0, 0, 1];
    const q2 = [0, 0, 0.7071, 0.7071];
    const q = qLerp(q1, q2, 0.5);
    expect(q[2]).toBeGreaterThan(0);
    expect(q[3]).toBeGreaterThan(0);

    // Negative dot product
    const qNeg = qLerp([0, 0, 0, 1], [0, 0, 0, -1], 0.5);
    expect(qNeg).toEqual([0, 0, 0, 1]);
  });

  test('qFromAxisAngle constructs a quaternion from axis and angle', () => {
    const axis = [0, 0, 1];
    const angle = Math.PI / 2;
    const q = qFromAxisAngle(axis, angle);
    const sin45 = Math.sin(Math.PI / 4);
    const cos45 = Math.cos(Math.PI / 4);
    
    expect(q[0]).toBeCloseTo(0, 5);
    expect(q[1]).toBeCloseTo(0, 5);
    expect(q[2]).toBeCloseTo(sin45, 5);
    expect(q[3]).toBeCloseTo(cos45, 5);

    expect(qFromAxisAngle([0, 0, 0], Math.PI)).toEqual([0, 0, 0, 1]);
  });

  test('getRotationToAlignNormal aligns vectors correctly', () => {
    // Aligning identical vectors should return identity
    const q = getRotationToAlignNormal([0, 0, 1], [0, 0, 1]);
    expect(q).toEqual([0, 0, 0, 1]);

    // Aligning opposing vectors
    const qOpp = getRotationToAlignNormal([0, 0, 1], [0, 0, -1]);
    expect(qOpp[3]).toBe(0); // Should represent a 180-degree rotation (w component is 0)

    // Opposing vector with different local axis
    const qOpp2 = getRotationToAlignNormal([1, 0, 0], [-1, 0, 0]);
    expect(qOpp2[3]).toBe(0);
  });

  test('normalize normalizes a 3D vector', () => {
    const v = [3, 0, 4];
    expect(normalize(v)).toEqual([0.6, 0, 0.8]);
    expect(normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });
});
