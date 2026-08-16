/**
 * Optimal rigid-body superposition (Kabsch 1976).
 *
 * Solved through the quaternion form: build Horn's 4x4 key matrix from the
 * covariance of the two centred point sets and take the eigenvector of its
 * largest eigenvalue. That eigenvector *is* the rotation quaternion, so the
 * result is a proper rotation by construction -- unlike the SVD form, which
 * can return a reflection unless you correct for it.
 *
 * That distinction is not academic. A reflection would superpose a molecule
 * perfectly onto its own mirror image, and proteins are chiral.
 */

import { assertSameLength, assertTriples, centroid, type Coords } from "./vec3.js";

export interface Superposition {
  /** Row-major 3x3 rotation, applied after centring the mobile set. */
  readonly rotation: readonly number[];
  /** Centroid of the mobile set, subtracted before rotating. */
  readonly mobileCentre: readonly [number, number, number];
  /** Centroid of the target set, added after rotating. */
  readonly targetCentre: readonly [number, number, number];
  /** RMSD after optimal superposition. */
  readonly rmsd: number;
}

/** Find the transform that best fits `mobile` onto `target`. Mutates neither. */
export function kabsch(mobile: Coords, target: Coords): Superposition {
  assertTriples(mobile);
  assertTriples(target);
  assertSameLength(mobile, target);

  const n = mobile.length / 3;
  const mobileCentre = centroid(mobile);
  const targetCentre = centroid(target);

  // Covariance of the centred sets.
  let xx = 0, xy = 0, xz = 0;
  let yx = 0, yy = 0, yz = 0;
  let zx = 0, zy = 0, zz = 0;
  for (let i = 0; i < n; i++) {
    const ax = mobile[i * 3]! - mobileCentre[0];
    const ay = mobile[i * 3 + 1]! - mobileCentre[1];
    const az = mobile[i * 3 + 2]! - mobileCentre[2];
    const bx = target[i * 3]! - targetCentre[0];
    const by = target[i * 3 + 1]! - targetCentre[1];
    const bz = target[i * 3 + 2]! - targetCentre[2];
    xx += ax * bx; xy += ax * by; xz += ax * bz;
    yx += ay * bx; yy += ay * by; yz += ay * bz;
    zx += az * bx; zy += az * by; zz += az * bz;
  }

  // Horn's key matrix.
  const key: number[][] = [
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ];

  const [qw, qx, qy, qz] = largestEigenvector(key);
  const rotation = quaternionToMatrix(qw, qx, qy, qz);

  return {
    rotation,
    mobileCentre,
    targetCentre,
    rmsd: rmsdAfter(mobile, target, rotation, mobileCentre, targetCentre),
  };
}

/** Apply a superposition, returning a new array. Never mutates `coords`. */
export function applyTransform(coords: Coords, transform: Superposition): Float64Array {
  assertTriples(coords);
  const { rotation: r, mobileCentre: mc, targetCentre: tc } = transform;
  const out = new Float64Array(coords.length);
  for (let i = 0; i < coords.length; i += 3) {
    const x = coords[i]! - mc[0];
    const y = coords[i + 1]! - mc[1];
    const z = coords[i + 2]! - mc[2];
    out[i] = r[0]! * x + r[1]! * y + r[2]! * z + tc[0];
    out[i + 1] = r[3]! * x + r[4]! * y + r[5]! * z + tc[1];
    out[i + 2] = r[6]! * x + r[7]! * y + r[8]! * z + tc[2];
  }
  return out;
}

function rmsdAfter(
  mobile: Coords,
  target: Coords,
  r: readonly number[],
  mc: readonly [number, number, number],
  tc: readonly [number, number, number],
): number {
  const n = mobile.length / 3;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x = mobile[i * 3]! - mc[0];
    const y = mobile[i * 3 + 1]! - mc[1];
    const z = mobile[i * 3 + 2]! - mc[2];
    const fx = r[0]! * x + r[1]! * y + r[2]! * z + tc[0];
    const fy = r[3]! * x + r[4]! * y + r[5]! * z + tc[1];
    const fz = r[6]! * x + r[7]! * y + r[8]! * z + tc[2];
    const dx = fx - target[i * 3]!;
    const dy = fy - target[i * 3 + 1]!;
    const dz = fz - target[i * 3 + 2]!;
    sum += dx * dx + dy * dy + dz * dz;
  }
  return Math.sqrt(sum / n);
}

function quaternionToMatrix(w: number, x: number, y: number, z: number): number[] {
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
}

const JACOBI_SWEEPS = 64;
const JACOBI_TOLERANCE = 1e-14;

/**
 * Eigenvector of the largest eigenvalue of a symmetric 4x4, by cyclic Jacobi.
 *
 * Four dimensions is small enough that the simple algorithm is both fast and
 * numerically excellent, and it avoids pulling in a linear-algebra dependency
 * for one operation.
 */
function largestEigenvector(input: number[][]): [number, number, number, number] {
  const a = input.map((row) => [...row]);
  const v = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];

  for (let sweep = 0; sweep < JACOBI_SWEEPS; sweep++) {
    let offDiagonal = 0;
    for (let p = 0; p < 4; p++) {
      for (let q = p + 1; q < 4; q++) offDiagonal += a[p]![q]! * a[p]![q]!;
    }
    if (offDiagonal < JACOBI_TOLERANCE) break;

    for (let p = 0; p < 4; p++) {
      for (let q = p + 1; q < 4; q++) {
        if (Math.abs(a[p]![q]!) < 1e-18) continue;
        const theta = (a[q]![q]! - a[p]![p]!) / (2 * a[p]![q]!);
        const t =
          Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;

        for (let k = 0; k < 4; k++) {
          const akp = a[k]![p]!;
          const akq = a[k]![q]!;
          a[k]![p] = c * akp - s * akq;
          a[k]![q] = s * akp + c * akq;
        }
        for (let k = 0; k < 4; k++) {
          const apk = a[p]![k]!;
          const aqk = a[q]![k]!;
          a[p]![k] = c * apk - s * aqk;
          a[q]![k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 4; k++) {
          const vkp = v[k]![p]!;
          const vkq = v[k]![q]!;
          v[k]![p] = c * vkp - s * vkq;
          v[k]![q] = s * vkp + c * vkq;
        }
      }
    }
  }

  let best = 0;
  for (let i = 1; i < 4; i++) if (a[i]![i]! > a[best]![best]!) best = i;
  return [v[0]![best]!, v[1]![best]!, v[2]![best]!, v[3]![best]!];
}
