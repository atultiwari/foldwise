/**
 * Keeping the chain a chain.
 *
 * Every frame of the animation is steered toward a target and then pulled back
 * onto the exact native virtual-bond lengths. This is what lets the app say
 * that at any point on the timeline, every Ca-Ca distance is correct -- nothing
 * ever stretches, however hard the morph pulls.
 *
 * The relaxation is Jakobsen's position-based dynamics: satisfy each distance
 * constraint in turn, repeat, and let the errors wash out. Cheap and stable.
 */

import { SpatialHash } from "./spatialHash.js";

/**
 * Default floor on how close two non-adjacent alpha carbons may come.
 *
 * Only a default: the real threshold is taken from the native structure, which
 * is the one arrangement we know is physically possible. See
 * `minimumNonBondedDistance`.
 */
export const CLASH_DISTANCE = 4.0;

/** Sequence separation below which a close approach is bonding, not clashing. */
const BONDED_SEPARATION = 2;

/**
 * Cap on declash passes for the thorough end-of-frame call.
 *
 * The loop exits as soon as nothing overlaps, which is almost always within a
 * handful of passes. The cap only matters for the rare frame where two
 * residues are wedged: separating them displaces each into its neighbours, and
 * the disturbance has to be walked out of the chain before it settles.
 */
const DECLASH_PASSES = 60;

/**
 * Residues are pushed to slightly beyond the threshold rather than exactly to
 * it. The bond relaxation that has to run afterwards pulls them partway back,
 * so aiming for the boundary lands just inside it.
 */
const CLEARANCE_MARGIN = 1.15;

/** Fraction of the overlap removed per pass. Full correction oscillates. */
const PUSH_FRACTION = 0.5;

/**
 * Closest approach between residues more than `BONDED_SEPARATION` apart.
 *
 * Real structures routinely put non-bonded alpha carbons closer than any round
 * number one might pick as a clash threshold, so the animation's floor is
 * derived from the answer rather than invented. Anything the folded state does
 * is by definition allowed.
 */
export function minimumNonBondedDistance(
  coords: ArrayLike<number>,
  residues: number,
): number {
  let closest = Infinity;
  for (let i = 0; i < residues; i++) {
    for (let j = i + BONDED_SEPARATION + 1; j < residues; j++) {
      const d = Math.hypot(
        coords[j * 3]! - coords[i * 3]!,
        coords[j * 3 + 1]! - coords[i * 3 + 1]!,
        coords[j * 3 + 2]! - coords[i * 3 + 2]!,
      );
      if (d < closest) closest = d;
    }
  }
  return Number.isFinite(closest) ? closest : CLASH_DISTANCE;
}

/**
 * Iteratively pull every consecutive pair back to its native separation.
 *
 * Sweep direction alternates: always sweeping the same way pushes error toward
 * one end of the chain and leaves a visible kink there.
 */
export function relaxBonds(
  coords: Float64Array,
  residues: number,
  bondLengths: ArrayLike<number>,
  iterations: number,
): void {
  for (let iteration = 0; iteration < iterations; iteration++) {
    const forward = iteration % 2 === 0;
    for (let step = 1; step < residues; step++) {
      const i = forward ? step : residues - step;
      const a = (i - 1) * 3;
      const b = i * 3;

      const dx = coords[b]! - coords[a]!;
      const dy = coords[b + 1]! - coords[a + 1]!;
      const dz = coords[b + 2]! - coords[a + 2]!;
      const length = Math.hypot(dx, dy, dz) || 1e-6;
      const correction = ((length - bondLengths[i]!) / length) * 0.5;

      coords[a] = coords[a]! + dx * correction;
      coords[a + 1] = coords[a + 1]! + dy * correction;
      coords[a + 2] = coords[a + 2]! + dz * correction;
      coords[b] = coords[b]! - dx * correction;
      coords[b + 1] = coords[b + 1]! - dy * correction;
      coords[b + 2] = coords[b + 2]! - dz * correction;
    }
  }
}

/**
 * Set every bond to exactly its native length, working outward from the middle.
 *
 * Relaxation converges but never quite arrives. This finishes the job: each
 * residue is placed at the exact distance from its already-fixed neighbour, so
 * the result is correct to floating-point rather than to a tolerance. Starting
 * from the centre halves the distance any accumulated drift has to travel.
 */
export function snapBonds(
  coords: Float64Array,
  residues: number,
  bondLengths: ArrayLike<number>,
): void {
  const middle = residues >> 1;

  for (let i = middle + 1; i < residues; i++) {
    place(coords, i, i - 1, bondLengths[i]!);
  }
  for (let i = middle - 1; i >= 0; i--) {
    place(coords, i, i + 1, bondLengths[i + 1]!);
  }
}

function place(coords: Float64Array, moving: number, anchor: number, length: number): void {
  const a = anchor * 3;
  const m = moving * 3;
  let dx = coords[m]! - coords[a]!;
  let dy = coords[m + 1]! - coords[a + 1]!;
  let dz = coords[m + 2]! - coords[a + 2]!;
  let norm = Math.hypot(dx, dy, dz);

  if (norm < 1e-9) {
    // Degenerate: the two residues coincide, so there is no direction to
    // preserve. Any direction satisfies the constraint; pick a fixed one so
    // the result stays deterministic.
    dx = 1;
    dy = 0;
    dz = 0;
    norm = 1;
  }

  const scale = length / norm;
  coords[m] = coords[a]! + dx * scale;
  coords[m + 1] = coords[a + 1]! + dy * scale;
  coords[m + 2] = coords[a + 2]! + dz * scale;
}

/**
 * Push apart residues that have collapsed into each other.
 *
 * `threshold` should come from `minimumNonBondedDistance` on the native
 * structure. An earlier version used a fixed 4 A and damped the push by how
 * folded each residue was, so that it would not fight the native structure's
 * own close contacts -- but that damping went to zero exactly where the chain
 * is most crowded, and residues ended up 0.7 A apart, passing straight through
 * one another. Taking the floor from the native structure removes the conflict,
 * so the push no longer has to be switched off.
 *
 * Repeated: one partial push does not clear a deep overlap, and the bond
 * relaxation between passes can reintroduce a shallow one.
 */
export function declash(
  coords: Float64Array,
  residues: number,
  bondLengths: ArrayLike<number>,
  threshold: number,
  passes: number = DECLASH_PASSES,
): void {
  for (let pass = 0; pass < passes; pass++) {
    const grid = new SpatialHash(threshold + 0.6);
    for (let i = 0; i < residues; i++) {
      grid.insert(i, coords[i * 3]!, coords[i * 3 + 1]!, coords[i * 3 + 2]!);
    }

    const aim = threshold * CLEARANCE_MARGIN;
    let overlaps = 0;
    for (let i = 0; i < residues; i++) {
      const x = coords[i * 3]!;
      const y = coords[i * 3 + 1]!;
      const z = coords[i * 3 + 2]!;

      grid.near(x, y, z, (j) => {
        if (j <= i + BONDED_SEPARATION) return;

        const dx = coords[j * 3]! - x;
        const dy = coords[j * 3 + 1]! - y;
        const dz = coords[j * 3 + 2]! - z;
        const distance = Math.hypot(dx, dy, dz);
        if (distance >= aim || distance < 1e-9) return;
        if (distance < threshold) overlaps += 1;

        const push = ((aim - distance) / distance) * PUSH_FRACTION * 0.5;
        coords[i * 3] = coords[i * 3]! - dx * push;
        coords[i * 3 + 1] = coords[i * 3 + 1]! - dy * push;
        coords[i * 3 + 2] = coords[i * 3 + 2]! - dz * push;
        coords[j * 3] = coords[j * 3]! + dx * push;
        coords[j * 3 + 1] = coords[j * 3 + 1]! + dy * push;
        coords[j * 3 + 2] = coords[j * 3 + 2]! + dz * push;
      });
    }

    // Reconcile with exact bond lengths inside the loop, not after it. Running
    // the snap only at the end lets it re-place every residue from the middle
    // outward and undo the separation that was just achieved; doing it each
    // pass means the next push starts from an already-legal chain and the two
    // constraints converge together instead of fighting.
    relaxBonds(coords, residues, bondLengths, 4);
    snapBonds(coords, residues, bondLengths);
    if (overlaps === 0) break;
  }
}

/** Native Ca-Ca separations, including the long ones that span chain breaks. */
export function bondLengthsOf(native: ArrayLike<number>, residues: number): Float64Array {
  const lengths = new Float64Array(residues);
  for (let i = 1; i < residues; i++) {
    lengths[i] = Math.hypot(
      native[i * 3]! - native[(i - 1) * 3]!,
      native[i * 3 + 1]! - native[(i - 1) * 3 + 1]!,
      native[i * 3 + 2]! - native[(i - 1) * 3 + 2]!,
    );
  }
  return lengths;
}
