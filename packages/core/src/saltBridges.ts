/**
 * Salt bridges between oppositely charged side chains.
 *
 * Barlow & Thornton (1983) JMB 168:867 define one as any charged nitrogen of
 * Arg/Lys/His within 4 A of a carboxylate oxygen of Asp/Glu. That is an
 * all-atom test, and the viewer carries a single point per side chain -- so
 * this works on charged-group *centroids* instead, with a wider cutoff.
 *
 * That approximation is measured, not assumed: the pipeline computes the real
 * all-atom answer and `test/interactions.test.ts` checks how close this gets.
 * See docs/VALIDATION.md.
 */

import { residueInfo } from "./composition.js";
import { distance, pointCount, type Coords } from "./vec3.js";

export interface SaltBridge {
  readonly i: number;
  readonly j: number;
  /** Centroid separation, angstrom. */
  readonly distance: number;
}

export interface SaltBridgeOptions {
  /**
   * Maximum centroid separation. Wider than Barlow & Thornton's 4 A because a
   * centroid sits further from its partner than the closest atom pair does;
   * calibrated against the all-atom answer in the reference fixture.
   */
  readonly cutoff?: number;
  /** Chain index per residue, so inter-chain bridges can be told apart. */
  readonly chainOf?: ArrayLike<number>;
}

export const DEFAULT_SALT_BRIDGE_CUTOFF = 5.0;

/**
 * Find salt bridges from charged-group centroids.
 *
 * `centres` is the side-chain functional-group centroid the pipeline emits as
 * `sc` -- for a charged residue that is its charged group, so the geometry is
 * chemically meaningful rather than a Cb stand-in.
 */
export function saltBridges(
  centres: Coords,
  sequence: string,
  options: SaltBridgeOptions = {},
): SaltBridge[] {
  const residues = pointCount(centres);
  if (sequence.length !== residues) {
    throw new RangeError(
      `sequence has ${sequence.length} residues but ${residues} centres were given`,
    );
  }

  const cutoff = options.cutoff ?? DEFAULT_SALT_BRIDGE_CUTOFF;
  const charges = Array.from(sequence, (code) => residueInfo(code).charge);

  const bridges: SaltBridge[] = [];
  for (let i = 0; i < residues; i++) {
    if (charges[i] === 0) continue;
    for (let j = i + 1; j < residues; j++) {
      if (charges[j] === 0) continue;
      if (charges[i]! * charges[j]! >= 0) continue; // same sign repels

      const d = distance(centres, i, centres, j);
      if (d <= cutoff) bridges.push({ i, j, distance: d });
    }
  }
  return bridges;
}

/** How many of a native set of bridges survive in another conformation. */
export function nativeBridgesFormed(
  native: readonly SaltBridge[],
  centres: Coords,
  cutoff = DEFAULT_SALT_BRIDGE_CUTOFF,
): number {
  let formed = 0;
  for (const bridge of native) {
    if (distance(centres, bridge.i, centres, bridge.j) <= cutoff) formed += 1;
  }
  return formed;
}

/**
 * Disulfide bonds between cysteines.
 *
 * The S-S bond is 2.05 A, but we hold side-chain centroids rather than sulfur
 * positions, so the threshold is on the centroid separation. Disulfides are
 * covalent and unambiguous, which makes them a useful check that the
 * side-chain geometry is being read correctly at all.
 */
export function disulfides(
  centres: Coords,
  sequence: string,
  cutoff = 3.0,
): Array<{ readonly i: number; readonly j: number; readonly distance: number }> {
  const residues = pointCount(centres);
  const found: Array<{ i: number; j: number; distance: number }> = [];
  for (let i = 0; i < residues; i++) {
    if (sequence[i] !== "C") continue;
    for (let j = i + 1; j < residues; j++) {
      if (sequence[j] !== "C") continue;
      const d = distance(centres, i, centres, j);
      if (d <= cutoff) found.push({ i, j, distance: d });
    }
  }
  return found;
}
