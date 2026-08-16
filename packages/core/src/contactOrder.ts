/**
 * Contact order -- how far through the chain a protein's contacts reach.
 *
 * Plaxco, Simons & Baker (1998) JMB 277:985 showed that relative contact order
 * predicts folding rate across small two-state proteins better than anything
 * else known at the time: local contacts form fast, long-range ones slowly.
 *
 * This is the number that drives the per-residue folding schedule in the
 * trajectory engine, so the ordering it produces is a real prediction of
 * folding theory rather than an animator's choice.
 */

import { nativeContacts, type Contact, type ContactOptions } from "./contacts.js";
import type { Coords } from "./vec3.js";

/**
 * The contact definition to use for contact order -- which is NOT the one used
 * for the folding coordinate Q, and the difference is large enough to matter.
 *
 * Q excludes near-neighbours (|i-j| < 3) because residues that are almost
 * bonded are in contact trivially and say nothing about whether the chain has
 * folded. Contact order includes them, because they are part of what makes a
 * protein's contacts local.
 *
 * Applying Q's exclusion to contact order roughly doubles the answer: ubiquitin
 * reads 28.5% instead of the ~15% in the literature. The two conventions are
 * kept explicitly separate here so that mistake cannot be made silently.
 */
export const CONTACT_ORDER_OPTIONS: ContactOptions = {
  /**
   * Plaxco's criterion is any two heavy atoms within 6 A. Our model carries no
   * side chains beyond Cb, so we approximate it with a slightly wider Ca
   * cutoff. Calibrated on ubiquitin, whose published relative contact order is
   * about 15%; this reproduces 15.3%.
   */
  cutoff: 6.5,
  minSeparation: 1,
};

export interface ContactOrder {
  /** Mean sequence separation of contacting pairs, in residues. */
  readonly absolute: number;
  /** The same, as a fraction of chain length. Usually quoted as a percentage. */
  readonly relative: number;
}

/**
 * Relative contact order straight from coordinates, using the contact-order
 * convention rather than Q's.
 *
 * Prefer this over calling `contactOrder` with your own contact set unless you
 * specifically need a different definition -- see `CONTACT_ORDER_OPTIONS`.
 */
export function relativeContactOrder(coords: Coords, chainLength: number): ContactOrder {
  return contactOrder(nativeContacts(coords, CONTACT_ORDER_OPTIONS), chainLength);
}

/**
 * Contact order over a set of native contacts.
 *
 * Inter-chain contacts have no meaningful sequence separation and are excluded,
 * which matches the published definition -- it was formulated for single-domain
 * monomers.
 *
 * The answer depends entirely on how `contacts` was built. Passing a Q-style
 * contact set here gives a number that is not comparable to published values.
 */
export function contactOrder(contacts: readonly Contact[], chainLength: number): ContactOrder {
  if (chainLength <= 0) throw new RangeError("chainLength must be positive");

  const intraChain = contacts.filter((contact) => contact.separation > 0);
  if (intraChain.length === 0) return { absolute: 0, relative: 0 };

  const total = intraChain.reduce((sum, contact) => sum + contact.separation, 0);
  const absolute = total / intraChain.length;
  return { absolute, relative: absolute / chainLength };
}

/**
 * Mean sequence separation of each residue's own contacts, normalised to [0, 1].
 *
 * Residues whose partners are all nearby in sequence score low and fold early;
 * residues that have to reach across the molecule score high and fold last.
 * Residues with no contacts sit at the midpoint rather than at zero, because
 * "no information" is not the same as "entirely local".
 */
export function perResidueContactOrder(
  contacts: readonly Contact[],
  residues: number,
): Float64Array {
  const totals = new Float64Array(residues);
  const counts = new Float64Array(residues);

  for (const contact of contacts) {
    if (contact.separation <= 0) continue;
    totals[contact.i]! += contact.separation;
    counts[contact.i]! += 1;
    totals[contact.j]! += contact.separation;
    counts[contact.j]! += 1;
  }

  const out = new Float64Array(residues);
  for (let i = 0; i < residues; i++) {
    out[i] = counts[i]! > 0 ? totals[i]! / counts[i]! / residues : 0.5;
  }
  return out;
}
