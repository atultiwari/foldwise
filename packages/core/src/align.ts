/**
 * Comparing two structures honestly.
 *
 * Two constraints shape everything here, and both would have been expensive to
 * discover late.
 *
 * **Alignment is by residue number, never by array index.** ΔF508 has a
 * residue deleted, so after position 508 the two chains' indices are
 * permanently off by one. Aligning by index would misalign the entire
 * C-terminal half and return a confident, meaningless RMSD.
 *
 * **Crystallographic noise exceeds the biological difference.** Two structures
 * of the same protein solved independently typically differ by a few tenths of
 * an ångström from crystal packing, temperature and refinement alone —
 * while HbA and HbS differ by one residue in 574. A deviation plot without a
 * noise floor lights up the whole molecule and hides the residue that matters,
 * teaching the reader something false. So a floor is estimated and reported
 * alongside, and the caller is expected to show it.
 */

import { kabsch, applyTransform } from "./kabsch.js";
import type { Coords } from "./vec3.js";

export interface AlignmentInput {
  readonly ca: Coords;
  /** Author residue numbers, one per residue. */
  readonly resNums: ArrayLike<number>;
  /** Chain index per residue, so the same number in two chains is not conflated. */
  readonly chainOf?: ArrayLike<number>;
}

export interface Alignment {
  /** Indices into the first structure, in correspondence order. */
  readonly a: Int32Array;
  /** Indices into the second, same order. */
  readonly b: Int32Array;
  /** How many residues were matched. */
  readonly count: number;
  /** Residues present in the first but not the second, and vice versa. */
  readonly onlyInA: number;
  readonly onlyInB: number;
}

/**
 * Match residues by (chain, author residue number).
 *
 * Chain is part of the key: residue 6 of chain B is not residue 6 of chain D,
 * and a homomultimer has the same numbering in every chain.
 */
export function alignByResidueNumber(a: AlignmentInput, b: AlignmentInput): Alignment {
  const key = (input: AlignmentInput, i: number) =>
    `${input.chainOf?.[i] ?? 0}:${input.resNums[i]}`;

  const inB = new Map<string, number>();
  for (let i = 0; i < b.resNums.length; i++) inB.set(key(b, i), i);

  const indicesA: number[] = [];
  const indicesB: number[] = [];
  for (let i = 0; i < a.resNums.length; i++) {
    const match = inB.get(key(a, i));
    if (match !== undefined) {
      indicesA.push(i);
      indicesB.push(match);
    }
  }

  return {
    a: Int32Array.from(indicesA),
    b: Int32Array.from(indicesB),
    count: indicesA.length,
    onlyInA: a.resNums.length - indicesA.length,
    onlyInB: b.resNums.length - indicesB.length,
  };
}

/** Gather the aligned subset of a coordinate array. */
export function gather(coords: Coords, indices: ArrayLike<number>): Float64Array {
  const out = new Float64Array(indices.length * 3);
  for (let i = 0; i < indices.length; i++) {
    const source = indices[i]! * 3;
    out[i * 3] = coords[source]!;
    out[i * 3 + 1] = coords[source + 1]!;
    out[i * 3 + 2] = coords[source + 2]!;
  }
  return out;
}

export interface Comparison {
  readonly alignment: Alignment;
  /** RMSD over the aligned residues, after optimal superposition. */
  readonly rmsd: number;
  /**
   * Per-residue deviation after superposition, indexed to match
   * `alignment.a`. Ångström.
   */
  readonly deviation: Float64Array;
  /**
   * An estimate of how much deviation means nothing.
   *
   * Taken as the median deviation, which for two structures of the same
   * protein is dominated by crystallographic and refinement differences rather
   * than by biology. Deviations below this are noise; the handful above it are
   * where to look.
   */
  readonly noiseFloor: number;
  /** The second structure superposed onto the first, for overlay rendering. */
  readonly superposed: Float64Array;
}

export interface CompareOptions {
  /**
   * Compare only this chain index on both sides.
   *
   * The sensible default for two crystal structures of the same protein.
   * Superposing whole assemblies assumes the chains sit in the same relative
   * arrangement, and for crystallographic multimers they usually do not: the
   * two ABL structures each contain two copies, packed differently, and fitting
   * both at once gives an RMSD of 25.6 Å for two molecules that are nearly
   * identical. Restricted to one chain the same pair fits properly.
   */
  readonly chain?: number;
}

export function compareStructures(
  a: AlignmentInput,
  b: AlignmentInput,
  options: CompareOptions = {},
): Comparison {
  const alignment = restrict(alignByResidueNumber(a, b), a, b, options.chain);
  if (alignment.count < 3) {
    throw new RangeError(
      `only ${alignment.count} residues align; a superposition needs at least 3`,
    );
  }

  const subsetA = gather(a.ca, alignment.a);
  const subsetB = gather(b.ca, alignment.b);

  // Fit on the aligned subset only. Including unmatched residues would drag
  // the superposition toward regions that have no counterpart.
  const transform = kabsch(subsetB, subsetA);
  const fittedSubset = applyTransform(subsetB, transform);
  // The whole of b, moved by the same transform, so an overlay draws every
  // residue including those with no partner.
  const superposed = applyTransform(b.ca, transform);

  const deviation = new Float64Array(alignment.count);
  for (let i = 0; i < alignment.count; i++) {
    deviation[i] = Math.hypot(
      fittedSubset[i * 3]! - subsetA[i * 3]!,
      fittedSubset[i * 3 + 1]! - subsetA[i * 3 + 1]!,
      fittedSubset[i * 3 + 2]! - subsetA[i * 3 + 2]!,
    );
  }

  return {
    alignment,
    rmsd: transform.rmsd,
    deviation,
    noiseFloor: median(deviation),
    superposed,
  };
}

/** Drop correspondences outside the requested chain. */
function restrict(
  alignment: Alignment,
  a: AlignmentInput,
  b: AlignmentInput,
  chain: number | undefined,
): Alignment {
  if (chain === undefined) return alignment;

  const keptA: number[] = [];
  const keptB: number[] = [];
  for (let i = 0; i < alignment.count; i++) {
    const indexA = alignment.a[i]!;
    const indexB = alignment.b[i]!;
    if ((a.chainOf?.[indexA] ?? 0) !== chain) continue;
    if ((b.chainOf?.[indexB] ?? 0) !== chain) continue;
    keptA.push(indexA);
    keptB.push(indexB);
  }

  const inChain = (input: AlignmentInput) => {
    let total = 0;
    for (let i = 0; i < input.resNums.length; i++) {
      if ((input.chainOf?.[i] ?? 0) === chain) total += 1;
    }
    return total;
  };

  return {
    a: Int32Array.from(keptA),
    b: Int32Array.from(keptB),
    count: keptA.length,
    onlyInA: inChain(a) - keptA.length,
    onlyInB: inChain(b) - keptB.length,
  };
}

function median(values: Float64Array): number {
  if (values.length === 0) return 0;
  const sorted = Float64Array.from(values).sort();
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

/**
 * Residues that deviate meaningfully more than the rest.
 *
 * Returns indices into the alignment, ordered worst first. `multiple` is how
 * many times the noise floor a deviation must reach before it is worth a
 * reader's attention.
 */
export function notableDeviations(
  comparison: Comparison,
  multiple = 3,
  limit = 12,
): number[] {
  const threshold = Math.max(comparison.noiseFloor * multiple, 0.5);
  const indices: number[] = [];
  for (let i = 0; i < comparison.deviation.length; i++) {
    if (comparison.deviation[i]! >= threshold) indices.push(i);
  }
  return indices
    .sort((x, y) => comparison.deviation[y]! - comparison.deviation[x]!)
    .slice(0, limit);
}
