import { assertTriples, centroid, type Coords } from "./vec3.js";

/**
 * Radius of gyration -- the root-mean-square distance of the points from their
 * centroid.
 *
 * This is the single most informative number about how compact a chain is, and
 * it is what the folding animation is calibrated against: a denatured chain of
 * N residues has Rg ~ 1.93 * N^0.598 A (Kohn et al., PNAS 2004).
 *
 * Unweighted by default. Passing per-point masses gives the mass-weighted form,
 * which is what a scattering experiment measures.
 */
export function radiusOfGyration(coords: Coords, masses?: ArrayLike<number>): number {
  assertTriples(coords);
  const n = coords.length / 3;
  if (n === 0) return 0;

  if (masses !== undefined && masses.length !== n) {
    throw new RangeError(`expected ${n} masses, got ${masses.length}`);
  }

  const [cx, cy, cz] = massWeightedCentre(coords, masses);

  let sum = 0;
  let totalMass = 0;
  for (let i = 0; i < n; i++) {
    const m = masses?.[i] ?? 1;
    const dx = coords[i * 3]! - cx;
    const dy = coords[i * 3 + 1]! - cy;
    const dz = coords[i * 3 + 2]! - cz;
    sum += m * (dx * dx + dy * dy + dz * dz);
    totalMass += m;
  }
  return Math.sqrt(sum / totalMass);
}

function massWeightedCentre(
  coords: Coords,
  masses: ArrayLike<number> | undefined,
): [number, number, number] {
  if (masses === undefined) return centroid(coords);

  const n = coords.length / 3;
  let x = 0;
  let y = 0;
  let z = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const m = masses[i]!;
    x += m * coords[i * 3]!;
    y += m * coords[i * 3 + 1]!;
    z += m * coords[i * 3 + 2]!;
    total += m;
  }
  return [x / total, y / total, z / total];
}

/**
 * The expected radius of gyration of a chemically denatured chain, in angstrom.
 *
 * Kohn et al. (2004) PNAS 101:12491, from small-angle X-ray scattering across
 * 28 denatured proteins. This is a measured scaling law, not a model.
 */
export function denaturedRadiusOfGyration(residues: number): number {
  return 1.93 * residues ** 0.598;
}
