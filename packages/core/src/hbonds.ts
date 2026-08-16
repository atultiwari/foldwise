/**
 * Backbone hydrogen bonds, by the Kabsch-Sander electrostatic energy.
 *
 * The same criterion the pipeline uses for secondary structure, in the
 * browser's language: the pipeline assigns the native structure once, offline,
 * while this runs on every frame of the folding trajectory so the viewer can
 * report how many of the native bonds have actually formed yet.
 *
 * Kabsch & Sander (1983) Biopolymers 22:2577.
 */

import type { Coords } from "./vec3.js";

/** q1 * q2 * f, with q1 = 0.42e, q2 = 0.20e and f = 332 kcal/mol per e^2/A. */
export const COUPLING = 0.42 * 0.20 * 332.0;

/** A bond exists below this energy, kcal/mol. */
export const ENERGY_CUTOFF = -0.5;

/** Beyond this Ca separation no backbone pair can bond; used to prune. */
export const MAX_CA_DISTANCE = 9.0;

/** N-H bond length, angstrom. */
export const NH_LENGTH = 1.0;

export interface HydrogenBond {
  /** Residue whose C=O accepts. */
  readonly acceptor: number;
  /** Residue whose N-H donates. */
  readonly donor: number;
  readonly energy: number;
}

export interface BackboneCoords {
  readonly n: Coords;
  readonly ca: Coords;
  readonly c: Coords;
  readonly o: Coords;
}

export interface HydrogenBondOptions {
  /** Residues that cannot donate: proline, and the start of every segment. */
  readonly isDonor?: ArrayLike<boolean>;
  readonly energyCutoff?: number;
}

/**
 * Place the amide hydrogen on each backbone nitrogen.
 *
 * DSSP puts it one angstrom from N along the previous residue's C->O direction.
 * The first residue of a chain has no preceding carbonyl, so its position is
 * meaningless and it must not be treated as a donor.
 */
export function amideHydrogens(backbone: BackboneCoords): Float64Array {
  const { n, c, o } = backbone;
  const out = new Float64Array(n.length);
  for (let i = 3; i < n.length; i += 3) {
    const dx = c[i - 3]! - o[i - 3]!;
    const dy = c[i - 2]! - o[i - 2]!;
    const dz = c[i - 1]! - o[i - 1]!;
    const length = Math.hypot(dx, dy, dz) || 1;
    out[i] = n[i]! + (NH_LENGTH * dx) / length;
    out[i + 1] = n[i + 1]! + (NH_LENGTH * dy) / length;
    out[i + 2] = n[i + 2]! + (NH_LENGTH * dz) / length;
  }
  return out;
}

/** Energy of the bond from residue `donor`'s N-H to residue `acceptor`'s C=O. */
export function bondEnergy(
  backbone: BackboneCoords,
  hydrogens: ArrayLike<number>,
  donor: number,
  acceptor: number,
): number {
  const inverse = (
    a: ArrayLike<number>, i: number, b: ArrayLike<number>, j: number,
  ): number => {
    const d = Math.hypot(a[i * 3]! - b[j * 3]!, a[i * 3 + 1]! - b[j * 3 + 1]!, a[i * 3 + 2]! - b[j * 3 + 2]!);
    return d > 1e-6 ? 1 / d : 1e6;
  };

  const { n, c, o } = backbone;
  return (
    COUPLING *
    (inverse(o, acceptor, n, donor) +
      inverse(c, acceptor, hydrogens, donor) -
      inverse(o, acceptor, hydrogens, donor) -
      inverse(c, acceptor, n, donor))
  );
}

/** Every backbone hydrogen bond in the given conformation. */
export function hydrogenBonds(
  backbone: BackboneCoords,
  options: HydrogenBondOptions = {},
): HydrogenBond[] {
  const { ca } = backbone;
  const residues = ca.length / 3;
  const cutoff = options.energyCutoff ?? ENERGY_CUTOFF;
  const isDonor = options.isDonor;
  const hydrogens = amideHydrogens(backbone);
  const maxSquared = MAX_CA_DISTANCE * MAX_CA_DISTANCE;

  const bonds: HydrogenBond[] = [];
  for (let acceptor = 0; acceptor < residues; acceptor++) {
    for (let donor = 0; donor < residues; donor++) {
      if (Math.abs(acceptor - donor) < 2) continue;
      if (donor === 0) continue; // no preceding carbonyl to orient its H
      if (isDonor !== undefined && !isDonor[donor]) continue;

      const dx = ca[acceptor * 3]! - ca[donor * 3]!;
      const dy = ca[acceptor * 3 + 1]! - ca[donor * 3 + 1]!;
      const dz = ca[acceptor * 3 + 2]! - ca[donor * 3 + 2]!;
      if (dx * dx + dy * dy + dz * dz > maxSquared) continue;

      const energy = bondEnergy(backbone, hydrogens, donor, acceptor);
      if (energy < cutoff) bonds.push({ acceptor, donor, energy });
    }
  }
  return bonds;
}

/**
 * How many of a set of native bonds are present in another conformation.
 *
 * This is what the viewer's "H-bonds 34 / 56" read-out counts: not bonds in
 * general, but the specific bonds the folded structure has.
 */
export function nativeBondsFormed(
  native: readonly HydrogenBond[],
  backbone: BackboneCoords,
  options: HydrogenBondOptions = {},
): number {
  if (native.length === 0) return 0;
  const cutoff = options.energyCutoff ?? ENERGY_CUTOFF;
  const hydrogens = amideHydrogens(backbone);

  let formed = 0;
  for (const bond of native) {
    if (bondEnergy(backbone, hydrogens, bond.donor, bond.acceptor) < cutoff) formed += 1;
  }
  return formed;
}

/**
 * Residues that can donate an amide hydrogen.
 *
 * Proline's nitrogen is inside a ring and carries no hydrogen; the residue
 * after a chain break has no bonded predecessor to orient one.
 */
export function donorMask(sequence: string, segmentStarts: ArrayLike<boolean>): boolean[] {
  return Array.from(sequence, (code, i) => code !== "P" && !segmentStarts[i]);
}
