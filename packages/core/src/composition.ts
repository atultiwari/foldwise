/**
 * Per-residue chemistry: what each amino acid is, and what it wants.
 *
 * These tables drive the hydropathy and charge colour modes, the burial model,
 * and the composition read-outs. Every number here is a published constant, not
 * a tuned parameter.
 */

export type ResidueClass = "hydrophobic" | "polar" | "positive" | "negative" | "special";

export interface ResidueInfo {
  readonly code: string;
  readonly three: string;
  readonly name: string;
  /** Kyte & Doolittle (1982) JMB 157:105. Positive is water-hating. */
  readonly hydropathy: number;
  /** Formal charge of the side chain at pH 7. */
  readonly charge: -1 | 0 | 1;
  /** Residue mass in the chain, daltons (free amino acid minus water). */
  readonly mass: number;
  /**
   * Theoretical maximum solvent-accessible surface area, square angstrom.
   * Tien et al. (2013) PLoS ONE 8:e80635. Used to turn absolute SASA into
   * relative solvent accessibility, which is what "buried" actually means.
   */
  readonly maxAsa: number;
  readonly klass: ResidueClass;
}

const table: readonly ResidueInfo[] = [
  { code: "A", three: "ALA", name: "Alanine",       hydropathy:  1.8, charge:  0, mass:  71.08, maxAsa: 129, klass: "hydrophobic" },
  { code: "R", three: "ARG", name: "Arginine",      hydropathy: -4.5, charge:  1, mass: 156.19, maxAsa: 274, klass: "positive" },
  { code: "N", three: "ASN", name: "Asparagine",    hydropathy: -3.5, charge:  0, mass: 114.10, maxAsa: 195, klass: "polar" },
  { code: "D", three: "ASP", name: "Aspartate",     hydropathy: -3.5, charge: -1, mass: 115.09, maxAsa: 193, klass: "negative" },
  { code: "C", three: "CYS", name: "Cysteine",      hydropathy:  2.5, charge:  0, mass: 103.14, maxAsa: 167, klass: "special" },
  { code: "Q", three: "GLN", name: "Glutamine",     hydropathy: -3.5, charge:  0, mass: 128.13, maxAsa: 225, klass: "polar" },
  { code: "E", three: "GLU", name: "Glutamate",     hydropathy: -3.5, charge: -1, mass: 129.12, maxAsa: 223, klass: "negative" },
  { code: "G", three: "GLY", name: "Glycine",       hydropathy: -0.4, charge:  0, mass:  57.05, maxAsa: 104, klass: "special" },
  { code: "H", three: "HIS", name: "Histidine",     hydropathy: -3.2, charge:  1, mass: 137.14, maxAsa: 224, klass: "positive" },
  { code: "I", three: "ILE", name: "Isoleucine",    hydropathy:  4.5, charge:  0, mass: 113.16, maxAsa: 197, klass: "hydrophobic" },
  { code: "L", three: "LEU", name: "Leucine",       hydropathy:  3.8, charge:  0, mass: 113.16, maxAsa: 201, klass: "hydrophobic" },
  { code: "K", three: "LYS", name: "Lysine",        hydropathy: -3.9, charge:  1, mass: 128.17, maxAsa: 236, klass: "positive" },
  { code: "M", three: "MET", name: "Methionine",    hydropathy:  1.9, charge:  0, mass: 131.19, maxAsa: 224, klass: "hydrophobic" },
  { code: "F", three: "PHE", name: "Phenylalanine", hydropathy:  2.8, charge:  0, mass: 147.18, maxAsa: 240, klass: "hydrophobic" },
  { code: "P", three: "PRO", name: "Proline",       hydropathy: -1.6, charge:  0, mass:  97.12, maxAsa: 159, klass: "special" },
  { code: "S", three: "SER", name: "Serine",        hydropathy: -0.8, charge:  0, mass:  87.08, maxAsa: 155, klass: "polar" },
  { code: "T", three: "THR", name: "Threonine",     hydropathy: -0.7, charge:  0, mass: 101.10, maxAsa: 172, klass: "polar" },
  { code: "W", three: "TRP", name: "Tryptophan",    hydropathy: -0.9, charge:  0, mass: 186.21, maxAsa: 285, klass: "hydrophobic" },
  { code: "Y", three: "TYR", name: "Tyrosine",      hydropathy: -1.3, charge:  0, mass: 163.18, maxAsa: 263, klass: "polar" },
  { code: "V", three: "VAL", name: "Valine",        hydropathy:  4.2, charge:  0, mass:  99.13, maxAsa: 174, klass: "hydrophobic" },
];

const byCode: ReadonlyMap<string, ResidueInfo> = new Map(table.map((r) => [r.code, r]));

/** Anything not one of the twenty -- an unresolved or exotic residue. */
export const UNKNOWN_RESIDUE: ResidueInfo = {
  code: "X",
  three: "UNK",
  name: "Unknown",
  hydropathy: 0,
  charge: 0,
  mass: 110,
  maxAsa: 200,
  klass: "special",
};

export function residueInfo(code: string): ResidueInfo {
  return byCode.get(code.toUpperCase()) ?? UNKNOWN_RESIDUE;
}

export const RESIDUE_TABLE: readonly ResidueInfo[] = table;

/** Mass of a chain in daltons, including the water released on each bond. */
export const WATER_MASS = 18.02;

export function chainMass(sequence: string): number {
  let mass = WATER_MASS;
  for (const code of sequence) mass += residueInfo(code).mass;
  return mass;
}

export function netCharge(sequence: string): number {
  let charge = 0;
  for (const code of sequence) charge += residueInfo(code).charge;
  return charge;
}

/** Mean Kyte-Doolittle hydropathy -- the GRAVY score. */
export function gravy(sequence: string): number {
  if (sequence.length === 0) return 0;
  let total = 0;
  for (const code of sequence) total += residueInfo(code).hydropathy;
  return total / sequence.length;
}

export function classCounts(sequence: string): Record<ResidueClass, number> {
  const counts: Record<ResidueClass, number> = {
    hydrophobic: 0, polar: 0, positive: 0, negative: 0, special: 0,
  };
  for (const code of sequence) counts[residueInfo(code).klass] += 1;
  return counts;
}

/**
 * Relative solvent accessibility per residue: observed SASA over the maximum
 * that residue could have.
 *
 * This, not raw area, is what "buried" means -- a tryptophan showing 60 square
 * angstrom is mostly hidden, while a glycine showing the same is wide open.
 */
export function relativeAccessibility(
  sequence: string,
  sasaPerResidue: ArrayLike<number>,
): Float64Array {
  if (sequence.length !== sasaPerResidue.length) {
    throw new RangeError(
      `sequence has ${sequence.length} residues but ${sasaPerResidue.length} areas were given`,
    );
  }
  const out = new Float64Array(sequence.length);
  for (let i = 0; i < sequence.length; i++) {
    out[i] = Math.min(1, sasaPerResidue[i]! / residueInfo(sequence[i]!).maxAsa);
  }
  return out;
}

/** Conventional threshold: below a quarter exposed counts as buried. */
export const BURIED_THRESHOLD = 0.25;

export function buriedFraction(relative: ArrayLike<number>): number {
  if (relative.length === 0) return 0;
  let buried = 0;
  for (let i = 0; i < relative.length; i++) {
    if (relative[i]! < BURIED_THRESHOLD) buried += 1;
  }
  return buried / relative.length;
}
