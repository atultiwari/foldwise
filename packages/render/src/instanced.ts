/**
 * Transforms for the instanced representations.
 *
 * Atoms are spheres and bonds are cylinders, and there is one of each per
 * residue -- so at 600 residues that is 1,200 draw calls if each is its own
 * object, and one if they are instanced. The matrices are computed here as
 * plain arrays so the maths is testable without a graphics context.
 *
 * Column-major 4x4, which is what both WebGL and three.js expect.
 */

import type { Coords } from "@foldwise/core";

/** Sphere radius for the atom representation, angstrom. */
export const ATOM_RADIUS = 1.7;

/** Cylinder radius for the bond representation, angstrom. */
export const BOND_RADIUS = 0.4;

/**
 * Bonds longer than this are chain breaks, not bonds.
 *
 * Consecutive alpha carbons sit 3.8 A apart. A gap in the crystal leaves the
 * flanking residues much further apart than that, and drawing a stick across
 * it would assert a connection the experiment never saw.
 */
export const MAX_BOND_LENGTH = 4.5;

/** Write an identity matrix into `out` at `offset`. */
function identity(out: Float32Array, offset: number): void {
  out.fill(0, offset, offset + 16);
  out[offset] = 1;
  out[offset + 5] = 1;
  out[offset + 10] = 1;
  out[offset + 15] = 1;
}

/** One uniformly scaled, translated sphere per residue. */
export function atomMatrices(ca: Coords, radius = ATOM_RADIUS): Float32Array {
  const residues = ca.length / 3;
  const out = new Float32Array(residues * 16);
  for (let i = 0; i < residues; i++) {
    const offset = i * 16;
    identity(out, offset);
    out[offset] = radius;
    out[offset + 5] = radius;
    out[offset + 10] = radius;
    out[offset + 12] = ca[i * 3]!;
    out[offset + 13] = ca[i * 3 + 1]!;
    out[offset + 14] = ca[i * 3 + 2]!;
  }
  return out;
}

export interface BondInstances {
  readonly matrices: Float32Array;
  /** Residue each cylinder starts from, for colouring. */
  readonly residueOf: Uint32Array;
  readonly count: number;
}

/**
 * A cylinder between each pair of bonded neighbours.
 *
 * The unit cylinder is assumed to run along +Y with length 1, centred on the
 * origin -- three.js's `CylinderGeometry` convention. Each instance is scaled
 * to the bond length, rotated onto the bond direction, and moved to its
 * midpoint.
 */
export function bondMatrices(
  ca: Coords,
  residues: number,
  radius = BOND_RADIUS,
  maxLength = MAX_BOND_LENGTH,
): BondInstances {
  const matrices = new Float32Array(Math.max(0, residues - 1) * 16);
  const residueOf = new Uint32Array(Math.max(0, residues - 1));
  let count = 0;

  for (let i = 1; i < residues; i++) {
    const ax = ca[(i - 1) * 3]!;
    const ay = ca[(i - 1) * 3 + 1]!;
    const az = ca[(i - 1) * 3 + 2]!;
    const dx = ca[i * 3]! - ax;
    const dy = ca[i * 3 + 1]! - ay;
    const dz = ca[i * 3 + 2]! - az;
    const length = Math.hypot(dx, dy, dz);
    if (length > maxLength || length < 1e-6) continue;

    const offset = count * 16;
    writeCylinder(matrices, offset, ax, ay, az, dx / length, dy / length, dz / length, length, radius);
    residueOf[count] = i - 1;
    count += 1;
  }

  return { matrices, residueOf, count };
}

/**
 * Build the matrix that takes a unit +Y cylinder onto a bond.
 *
 * The rotation is constructed directly from an orthonormal basis rather than
 * from an axis-angle: the basis is what the matrix needs anyway, and building
 * it this way has no singularity to guard except the exactly-antiparallel case.
 */
function writeCylinder(
  out: Float32Array, offset: number,
  ax: number, ay: number, az: number,
  ux: number, uy: number, uz: number,
  length: number, radius: number,
): void {
  // A vector not parallel to the bond, to seed the perpendicular axes.
  const seed: [number, number, number] = Math.abs(uy) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let rx = seed[1] * uz - seed[2] * uy;
  let ry = seed[2] * ux - seed[0] * uz;
  let rz = seed[0] * uy - seed[1] * ux;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;

  const fx = uy * rz - uz * ry;
  const fy = uz * rx - ux * rz;
  const fz = ux * ry - uy * rx;

  // Columns: X = right * radius, Y = along the bond * length, Z = forward.
  out[offset] = rx * radius;
  out[offset + 1] = ry * radius;
  out[offset + 2] = rz * radius;
  out[offset + 3] = 0;
  out[offset + 4] = ux * length;
  out[offset + 5] = uy * length;
  out[offset + 6] = uz * length;
  out[offset + 7] = 0;
  out[offset + 8] = fx * radius;
  out[offset + 9] = fy * radius;
  out[offset + 10] = fz * radius;
  out[offset + 11] = 0;
  out[offset + 12] = ax + ux * length * 0.5;
  out[offset + 13] = ay + uy * length * 0.5;
  out[offset + 14] = az + uz * length * 0.5;
  out[offset + 15] = 1;
}

/** Apply a column-major 4x4 to a point. Used by the tests, and by picking. */
export function transformPoint(
  matrix: ArrayLike<number>, offset: number, x: number, y: number, z: number,
): [number, number, number] {
  return [
    matrix[offset]! * x + matrix[offset + 4]! * y + matrix[offset + 8]! * z + matrix[offset + 12]!,
    matrix[offset + 1]! * x + matrix[offset + 5]! * y + matrix[offset + 9]! * z + matrix[offset + 13]!,
    matrix[offset + 2]! * x + matrix[offset + 6]! * y + matrix[offset + 10]! * z + matrix[offset + 14]!,
  ];
}
