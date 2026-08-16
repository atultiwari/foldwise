/**
 * When each residue finds its native geometry.
 *
 * This is the one part of the animation that carries a real claim. The route
 * between unfolded and folded has never been filmed, but folding theory does
 * predict the *order*: local structure forms first because its partners are
 * already nearby, and contacts that have to reach across the molecule close
 * last. Plaxco, Simons & Baker (1998) showed contact order predicts folding
 * rate; here it predicts the sequence of events.
 *
 * So the specific movie is a model, but the ordering is not arbitrary.
 */

import {
  contactDensity,
  nativeContacts,
  perResidueContactOrder,
  type Coords,
} from "@foldwise/core";

/** Contacts within this range make a residue locally crowded. */
const DENSITY_CUTOFF = 10;

/** Weight on how far a residue's contacts reach: the dominant term. */
const CONTACT_ORDER_WEIGHT = 0.62;

/** Weight on local crowding. Negative -- a packed neighbourhood forms early. */
const DENSITY_WEIGHT = -0.14;

const BASE = 0.06;

/**
 * Secondary structure nudges. Helices and strands are local hydrogen-bonded
 * patterns that nucleate quickly; loops are what is left over and close last.
 */
const SS_BIAS: Readonly<Record<string, number>> = {
  H: -0.13, G: -0.13, I: -0.13,
  E: -0.06, B: -0.06,
  T: 0.11, S: 0.11, C: 0.11,
};

/** Smoothing half-width, in residues. Neighbours fold together, not apart. */
const SMOOTHING = 2;

/** The schedule is spread across this window of the timeline. */
export const FIRST_ONSET = 0.04;
export const LAST_ONSET = 0.82;

/** How long a residue takes to go from coil geometry to native, in timeline units. */
export const TRANSITION_WIDTH = 0.12;

export interface OnsetOptions {
  readonly chainOf?: ArrayLike<number>;
}

/**
 * A folding time in [FIRST_ONSET, LAST_ONSET] for every residue.
 *
 * The raw score is turned into a rank before being spread across the window.
 * Absolute scores cluster -- most residues in a globular protein look much like
 * each other -- and ranking guarantees the animation keeps moving throughout
 * rather than stalling and then snapping.
 */
export function foldingOnsets(
  native: Coords,
  secondaryStructure: string,
  options: OnsetOptions = {},
): Float64Array {
  const residues = secondaryStructure.length;
  if (residues === 0) return new Float64Array(0);
  if (native.length !== residues * 3) {
    throw new RangeError(
      `secondary structure has ${residues} residues but ${native.length / 3} coordinates were given`,
    );
  }

  const contacts = nativeContacts(native, options.chainOf === undefined ? {} : { chainOf: options.chainOf });
  const reach = perResidueContactOrder(contacts, residues);

  const density = contactDensity(
    nativeContacts(native, {
      cutoff: DENSITY_CUTOFF,
      minSeparation: 1,
      ...(options.chainOf === undefined ? {} : { chainOf: options.chainOf }),
    }),
    residues,
  );
  const crowding = normalise(density);

  const raw = new Float64Array(residues);
  for (let i = 0; i < residues; i++) {
    raw[i] =
      BASE +
      CONTACT_ORDER_WEIGHT * reach[i]! +
      (SS_BIAS[secondaryStructure[i]!] ?? SS_BIAS["C"]!) +
      DENSITY_WEIGHT * crowding[i]!;
  }

  return spreadByRank(smooth(raw, SMOOTHING), residues);
}

function normalise(values: ArrayLike<number>): Float64Array {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    if (values[i]! < min) min = values[i]!;
    if (values[i]! > max) max = values[i]!;
  }
  const range = max - min || 1;
  const out = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = (values[i]! - min) / range;
  return out;
}

/** Triangular smoothing, so neighbours fold at similar times. */
function smooth(values: Float64Array, halfWidth: number): Float64Array {
  const out = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) {
    let total = 0;
    let weightSum = 0;
    for (let offset = -halfWidth; offset <= halfWidth; offset++) {
      const j = i + offset;
      if (j < 0 || j >= values.length) continue;
      const weight = 1 / (1 + Math.abs(offset));
      total += values[j]! * weight;
      weightSum += weight;
    }
    out[i] = total / weightSum;
  }
  return out;
}

function spreadByRank(scores: Float64Array, residues: number): Float64Array {
  const order = Array.from({ length: residues }, (_, i) => i).sort(
    (a, b) => scores[a]! - scores[b]! || a - b,
  );
  const onsets = new Float64Array(residues);
  const span = LAST_ONSET - FIRST_ONSET;
  order.forEach((residue, rank) => {
    onsets[residue] = FIRST_ONSET + span * (residues > 1 ? rank / (residues - 1) : 0);
  });
  return onsets;
}

/**
 * How far each residue has folded at a given point on the timeline.
 *
 * Smoothstep rather than a linear ramp: a residue eases into and out of its
 * transition instead of starting and stopping abruptly.
 */
export function formationAt(onsets: ArrayLike<number>, progress: number): Float64Array {
  const out = new Float64Array(onsets.length);
  for (let i = 0; i < onsets.length; i++) {
    const t = (progress - onsets[i]!) / TRANSITION_WIDTH;
    out[i] = smoothstep(t);
  }
  return out;
}

function smoothstep(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}
