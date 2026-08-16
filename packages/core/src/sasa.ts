/**
 * Solvent-accessible surface area by the Shrake-Rupley algorithm (1973).
 *
 * Each atom is given a sphere of radius (vdW + probe); points are scattered
 * over it and counted as accessible when no other atom's sphere covers them.
 * Burying surface is what folding is *for*, so this is the quantity that makes
 * hydrophobic collapse visible as a number rather than an assertion.
 *
 * Validated against FreeSASA in `test/sasa.test.ts` -- see
 * `docs/VALIDATION.md`.
 */

import { pointCount, type Coords } from "./vec3.js";

/** Bondi (1964) van der Waals radii, angstrom. */
export const VDW_RADII: Readonly<Record<string, number>> = {
  H: 1.20,
  C: 1.70,
  N: 1.55,
  O: 1.52,
  S: 1.80,
};

/** Radius of a water molecule. */
export const PROBE_RADIUS = 1.4;

/** Enough points for a smooth surface at interactive speed. */
export const DEFAULT_POINTS = 128;

export interface SasaOptions {
  readonly probeRadius?: number;
  readonly points?: number;
}

/**
 * Evenly spaced points on the unit sphere, by the Fibonacci spiral.
 *
 * A latitude-longitude grid clusters at the poles and biases the count; the
 * golden-angle spiral does not, which is why it needs far fewer points for the
 * same accuracy.
 */
export function fibonacciSphere(count: number): Float64Array {
  if (count < 1) throw new RangeError("count must be at least 1");
  const points = new Float64Array(count * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    points[i * 3] = Math.cos(theta) * radius;
    points[i * 3 + 1] = y;
    points[i * 3 + 2] = Math.sin(theta) * radius;
  }
  return points;
}

/**
 * Accessible surface area of every atom, in square angstrom.
 *
 * `radii` are van der Waals radii; the probe is added internally.
 */
export function shrakeRupley(
  coords: Coords,
  radii: ArrayLike<number>,
  options: SasaOptions = {},
): Float64Array {
  const n = pointCount(coords);
  if (radii.length !== n) {
    throw new RangeError(`expected ${n} radii, got ${radii.length}`);
  }

  const probe = options.probeRadius ?? PROBE_RADIUS;
  const pointCountPerAtom = options.points ?? DEFAULT_POINTS;
  const sphere = fibonacciSphere(pointCountPerAtom);
  const expanded = Float64Array.from({ length: n }, (_, i) => radii[i]! + probe);

  let maxExpanded = 0;
  for (let i = 0; i < n; i++) maxExpanded = Math.max(maxExpanded, expanded[i]!);

  const areas = new Float64Array(n);
  const neighbours: number[] = [];

  for (let i = 0; i < n; i++) {
    const ri = expanded[i]!;
    const xi = coords[i * 3]!;
    const yi = coords[i * 3 + 1]!;
    const zi = coords[i * 3 + 2]!;

    // Only atoms whose spheres can reach this one can occlude it.
    neighbours.length = 0;
    const reach = ri + maxExpanded;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = coords[j * 3]! - xi;
      const dy = coords[j * 3 + 1]! - yi;
      const dz = coords[j * 3 + 2]! - zi;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= reach * reach) continue;
      const sum = ri + expanded[j]!;
      if (d2 < sum * sum) neighbours.push(j);
    }

    let accessible = 0;
    for (let p = 0; p < pointCountPerAtom; p++) {
      const px = xi + sphere[p * 3]! * ri;
      const py = yi + sphere[p * 3 + 1]! * ri;
      const pz = zi + sphere[p * 3 + 2]! * ri;

      let buried = false;
      for (const j of neighbours) {
        const dx = px - coords[j * 3]!;
        const dy = py - coords[j * 3 + 1]!;
        const dz = pz - coords[j * 3 + 2]!;
        const rj = expanded[j]!;
        if (dx * dx + dy * dy + dz * dz < rj * rj) {
          buried = true;
          break;
        }
      }
      if (!buried) accessible++;
    }

    areas[i] = 4 * Math.PI * ri * ri * (accessible / pointCountPerAtom);
  }
  return areas;
}

/** Sum per-atom areas into per-residue ones, `atomsPerResidue` at a time. */
export function perResidue(areas: ArrayLike<number>, atomsPerResidue: number): Float64Array {
  if (areas.length % atomsPerResidue !== 0) {
    throw new RangeError(
      `${areas.length} atom areas is not a multiple of ${atomsPerResidue}`,
    );
  }
  const residues = areas.length / atomsPerResidue;
  const out = new Float64Array(residues);
  for (let r = 0; r < residues; r++) {
    let sum = 0;
    for (let k = 0; k < atomsPerResidue; k++) sum += areas[r * atomsPerResidue + k]!;
    out[r] = sum;
  }
  return out;
}

export function totalArea(areas: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < areas.length; i++) sum += areas[i]!;
  return sum;
}
