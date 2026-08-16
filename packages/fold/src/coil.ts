/**
 * The unfolded state.
 *
 * Nobody has ever measured the shape of a particular denatured chain -- it has
 * no single shape. What *has* been measured is how big it is: across 28
 * chemically denatured proteins, Kohn et al. (2004) found the radius of
 * gyration follows Rg = 1.93 * N^0.598 A.
 *
 * So the coil here is invented, but its size is not. Self-avoiding walks are
 * drawn, measured, and the one closest to the measured law is kept. What the
 * viewer shows as "unfolded" is therefore the right size with plausible local
 * geometry, in an arrangement that is arbitrary but reproducible.
 *
 * It is one representative of the denatured ensemble, not the ensemble.
 */

import { radiusOfGyration, denaturedRadiusOfGyration } from "@foldwise/core";

import { randomDirection, rotateAbout, seededRandom } from "./random.js";
import { SpatialHash } from "./spatialHash.js";

/** Candidate directions tried per residue; the roomiest one wins. */
const CANDIDATES = 10;

/** Grid cell size for the self-avoidance lookup, angstrom. */
const CELL_SIZE = 4.4;

/** A candidate this far from everything already placed is good enough. */
const GOOD_ENOUGH_CLEARANCE = 4.4;

/** Deflection from the previous bond direction, degrees. */
const MIN_TURN = 35;
const TURN_RANGE = 60;

/**
 * Candidate walks drawn while looking for one the right size.
 *
 * Bisecting on stiffness does not work, and the reason is worth recording. The
 * radius of gyration of a *single* self-avoiding walk is dominated by which
 * path it happened to take, not by the stiffness it was drawn at: across five
 * seeds at fixed stiffness, ubiquitin-length walks ranged from 17 to 36 A,
 * while the whole stiffness sweep moved the mean by about 9 A. Bisecting a
 * parameter whose effect is smaller than the noise around it is bisecting
 * noise.
 *
 * So the search is over draws instead. Stiffness is still swept, because it
 * shifts the distribution and so improves the odds, but the walk that gets
 * returned is chosen by measuring it.
 */
const CANDIDATE_WALKS = 48;

/** Distinct stiffness values swept across the candidates. */
const STIFFNESS_STEPS = 8;

/** Close enough to stop looking, as a fraction of the target. */
const GOOD_ENOUGH_RG = 0.01;

/** Odd 32-bit constant (golden ratio) for decorrelating derived seeds. */
const SEED_STRIDE = 0x9e3779b9;

/**
 * A denatured chain can be enormous. Past a few times the native size it stops
 * being informative and just makes the camera zoom out until nothing is
 * visible, so the target is capped.
 */
const MAX_EXPANSION = 3;

export interface CoilResult {
  readonly coords: Float64Array;
  /** The radius of gyration we were aiming for. */
  readonly targetRg: number;
  /** What the returned coil actually achieved. */
  readonly actualRg: number;
}

/**
 * One self-avoiding walk at a given stiffness.
 *
 * `stiffness` runs 0 (extended, nearly straight) to 1 (compact, tightly
 * kinked). Each step tries several directions and keeps whichever lands
 * furthest from the residues already placed, which is what stops the walk
 * threading back through itself.
 */
export function selfAvoidingWalk(
  residues: number,
  bondLengths: ArrayLike<number>,
  random: () => number,
  stiffness: number,
): Float64Array {
  const coords = new Float64Array(residues * 3);
  if (residues === 0) return coords;

  const grid = new SpatialHash(CELL_SIZE);
  const exponent = Math.exp(-3 * (stiffness - 0.5));

  let direction = randomDirection(random);
  grid.insert(0, 0, 0, 0);

  if (residues > 1) {
    coords[3] = direction[0] * bondLengths[1]!;
    coords[4] = direction[1] * bondLengths[1]!;
    coords[5] = direction[2] * bondLengths[1]!;
    grid.insert(1, coords[3]!, coords[4]!, coords[5]!);
  }

  for (let i = 2; i < residues; i++) {
    const px = coords[(i - 1) * 3]!;
    const py = coords[(i - 1) * 3 + 1]!;
    const pz = coords[(i - 1) * 3 + 2]!;

    let bestClearance = -Infinity;
    let best: [number, number, number] = [px, py, pz];
    let bestDirection = direction;

    for (let attempt = 0; attempt < CANDIDATES; attempt++) {
      const turn = (MIN_TURN + TURN_RANGE * random() ** exponent) * (Math.PI / 180);
      const axis = perpendicular(direction, randomDirection(random));
      if (axis === null) continue;

      const candidate = rotateAbout(direction, axis, turn);
      const x = px + candidate[0] * bondLengths[i]!;
      const y = py + candidate[1] * bondLengths[i]!;
      const z = pz + candidate[2] * bondLengths[i]!;

      let clearance = Infinity;
      grid.near(x, y, z, (j) => {
        if (j >= i - 2) return;
        const d = Math.hypot(x - coords[j * 3]!, y - coords[j * 3 + 1]!, z - coords[j * 3 + 2]!);
        if (d < clearance) clearance = d;
      });

      if (clearance > bestClearance) {
        bestClearance = clearance;
        best = [x, y, z];
        bestDirection = candidate;
      }
      if (clearance > GOOD_ENOUGH_CLEARANCE) break;
    }

    coords[i * 3] = best[0];
    coords[i * 3 + 1] = best[1];
    coords[i * 3 + 2] = best[2];
    direction = bestDirection;
    grid.insert(i, best[0], best[1], best[2]);
  }

  return coords;
}

/** Unit vector perpendicular to `direction`, or null if the two are parallel. */
function perpendicular(
  direction: readonly [number, number, number],
  hint: readonly [number, number, number],
): [number, number, number] | null {
  const x = direction[1] * hint[2] - direction[2] * hint[1];
  const y = direction[2] * hint[0] - direction[0] * hint[2];
  const z = direction[0] * hint[1] - direction[1] * hint[0];
  const norm = Math.hypot(x, y, z);
  return norm < 1e-4 ? null : [x / norm, y / norm, z / norm];
}

/**
 * Generate a coil whose radius of gyration matches the denatured-state law.
 *
 * Candidate walks are drawn and measured, and the closest to the target is
 * kept. This selects one representative of the denatured ensemble that happens
 * to be the right size -- it does not reproduce the ensemble, and does not
 * claim to. What the viewer shows is a chain of the measured size with
 * plausible local geometry, which is the honest limit of what can be shown for
 * a state that has no single shape.
 *
 * Deterministic: seeds are derived from the protein's own identifier, so the
 * same protein yields the same coil everywhere, every time.
 */
export function generateCoil(
  residues: number,
  bondLengths: ArrayLike<number>,
  seed: number,
  nativeRg: number,
): CoilResult {
  const targetRg = Math.min(
    denaturedRadiusOfGyration(residues),
    MAX_EXPANSION * nativeRg,
  );

  let best: Float64Array = new Float64Array(residues * 3);
  let bestError = Infinity;
  let bestRg = 0;

  for (let candidate = 0; candidate < CANDIDATE_WALKS; candidate++) {
    const stiffness = (candidate % STIFFNESS_STEPS) / (STIFFNESS_STEPS - 1);
    const coords = selfAvoidingWalk(
      residues,
      bondLengths,
      seededRandom((seed + Math.imul(candidate, SEED_STRIDE)) >>> 0),
      stiffness,
    );
    const rg = radiusOfGyration(coords);
    const error = Math.abs(rg - targetRg);

    if (error < bestError) {
      bestError = error;
      best = Float64Array.from(coords);
      bestRg = rg;
    }
    if (bestError / targetRg < GOOD_ENOUGH_RG) break;
  }

  return { coords: best, targetRg, actualRg: bestRg };
}
