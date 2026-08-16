/**
 * Keeping the chains of a complex apart while they are unfolded.
 *
 * Each chain's trajectory is generated independently, and each self-avoiding
 * walk starts at the origin — so without this, the four chains of haemoglobin
 * begin the animation superimposed, passing straight through one another.
 * Measured before this existed: the closest approach *between* chains at frame
 * zero was 0.00 Å.
 *
 * A denatured complex is dissociated anyway. Its chains are separate molecules
 * that have not yet found each other, so drawing them apart and bringing them
 * together as they fold is both easier to read and closer to the truth than
 * drawing them interpenetrating.
 *
 * The displacement is a rigid translation applied after the chain's internal
 * geometry is settled, so it cannot disturb any bond length, and it decays to
 * exactly zero before the native state so the final frame is untouched.
 */

import { denaturedRadiusOfGyration, type Coords } from "@foldwise/core";

export interface ChainSpread {
  /** Unit vector to push along. */
  readonly direction: readonly [number, number, number];
  /** How far, in ångström, at the start of the animation. */
  readonly distance: number;
}

/** Chains have fully converged by this point on the timeline. */
export const SPREAD_END = 0.72;

/** Multiplier on each chain's expected denatured radius. */
const SPREAD_SCALE = 1.25;

export const NO_SPREAD: ChainSpread = { direction: [0, 0, 0], distance: 0 };

/**
 * How far apart to hold each chain at the start.
 *
 * Each is pushed away from the complex's overall centre, along the direction
 * its own native centre lies in — so they separate the way they will later
 * come together, and the animation reads as assembly rather than as a shuffle.
 */
export function chainSpreads(natives: readonly Coords[]): ChainSpread[] {
  if (natives.length < 2) return natives.map(() => NO_SPREAD);

  const centres = natives.map(centroidOf);
  const overall = centroidOf(centres.flatMap((c) => [...c]));

  return natives.map((native, index) => {
    const centre = centres[index]!;
    const away: [number, number, number] = [
      centre[0] - overall[0],
      centre[1] - overall[1],
      centre[2] - overall[2],
    ];
    const length = Math.hypot(...away);

    // Two chains stacked on the same centre — a symmetric dimer can be close
    // to this — have no natural direction to separate along. Fall back to
    // evenly spaced points on a sphere so they still come apart, and do it
    // deterministically so the animation is reproducible.
    const direction: [number, number, number] =
      length < 1e-3
        ? spherePoint(index, natives.length)
        : [away[0] / length, away[1] / length, away[2] / length];

    const residues = native.length / 3;
    return { direction, distance: SPREAD_SCALE * denaturedRadiusOfGyration(residues) };
  });
}

/**
 * How much of the spread survives at this point on the timeline.
 *
 * Reaches exactly zero at `SPREAD_END`, which is before the native state, so
 * the chains are packed together for the last quarter of the animation and the
 * final frame is the deposited structure untouched.
 */
export function spreadFactor(progress: number): number {
  if (progress >= SPREAD_END) return 0;
  const t = 1 - progress / SPREAD_END;
  // Smoothstep, so the chains ease together rather than arriving at a constant
  // rate and stopping dead.
  return t * t * (3 - 2 * t);
}

function centroidOf(coords: Coords): [number, number, number] {
  const n = coords.length / 3;
  if (n === 0) return [0, 0, 0];
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < n; i++) {
    x += coords[i * 3]!;
    y += coords[i * 3 + 1]!;
    z += coords[i * 3 + 2]!;
  }
  return [x / n, y / n, z / n];
}

/** Fibonacci sphere, for the degenerate case. */
function spherePoint(index: number, count: number): [number, number, number] {
  const y = count === 1 ? 0 : 1 - (index / (count - 1)) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = Math.PI * (3 - Math.sqrt(5)) * index;
  return [Math.cos(theta) * radius, y, Math.sin(theta) * radius];
}
