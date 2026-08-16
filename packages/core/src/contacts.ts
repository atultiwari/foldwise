/**
 * Native contact maps and how much of one has formed.
 *
 * The fraction of native contacts, Q, is the standard reaction coordinate for
 * folding: it runs from near 0 in the unfolded state to 1 in the native one,
 * and it is what the energy funnel is plotted against.
 */

import { distance, distanceSquared, pointCount, type Coords } from "./vec3.js";

export interface Contact {
  readonly i: number;
  readonly j: number;
  /** Separation in the native structure, angstrom. */
  readonly distance: number;
  /** Residues apart in sequence, or 0 when the two are on different chains. */
  readonly separation: number;
}

export interface ContactOptions {
  /** Two residues are in contact below this separation. Angstrom. */
  readonly cutoff?: number;
  /**
   * Ignore pairs closer than this in sequence. Neighbours are always within
   * range simply by being bonded, so counting them would say nothing about
   * the fold.
   */
  readonly minSeparation?: number;
  /** Chain index per residue. Pairs on different chains are always kept. */
  readonly chainOf?: ArrayLike<number>;
}

export const DEFAULT_CUTOFF = 8;
export const DEFAULT_MIN_SEPARATION = 3;

/**
 * Every residue pair in contact in the given (native) coordinates.
 *
 * O(n^2), which is fine to roughly 2000 residues. Above that, switch to a
 * spatial hash -- the interface does not change.
 */
export function nativeContacts(coords: Coords, options: ContactOptions = {}): Contact[] {
  const cutoff = options.cutoff ?? DEFAULT_CUTOFF;
  const minSeparation = options.minSeparation ?? DEFAULT_MIN_SEPARATION;
  const chainOf = options.chainOf;
  const cutoffSquared = cutoff * cutoff;
  const n = pointCount(coords);

  const contacts: Contact[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sameChain = chainOf === undefined || chainOf[i] === chainOf[j];
      if (sameChain && j - i < minSeparation) continue;

      const d2 = distanceSquared(coords, i, coords, j);
      if (d2 > cutoffSquared) continue;

      contacts.push({
        i,
        j,
        distance: Math.sqrt(d2),
        separation: sameChain ? j - i : 0,
      });
    }
  }
  return contacts;
}

/**
 * Fraction of native contacts present in `coords`, the folding coordinate Q.
 *
 * A contact counts as formed while it is within `tolerance` times its native
 * distance. The 1.2 default is the usual convention and gives Q a smooth
 * approach to 1 rather than a step.
 */
export function fractionFormed(
  contacts: readonly Contact[],
  coords: Coords,
  tolerance = 1.2,
): number {
  if (contacts.length === 0) return 1;
  let formed = 0;
  for (const contact of contacts) {
    if (distance(coords, contact.i, coords, contact.j) <= contact.distance * tolerance) {
      formed++;
    }
  }
  return formed / contacts.length;
}

/** Contacts per residue -- a crude but effective measure of local burial. */
export function contactDensity(contacts: readonly Contact[], residues: number): Float64Array {
  const density = new Float64Array(residues);
  for (const { i, j } of contacts) {
    density[i]! += 1;
    density[j]! += 1;
  }
  return density;
}
