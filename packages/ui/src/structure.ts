/**
 * Loading a structure, and refusing to trust it.
 *
 * The pipeline emits these files and validates them on the way out, but the
 * browser is a separate program reading a separate artefact: a stale build, a
 * truncated download or a schema change between the two would otherwise show
 * up as a crash somewhere deep in the geometry code, with nothing pointing at
 * the cause.
 *
 * This schema mirrors `pipeline/foldwise/model.py`. The two must stay in step,
 * and a mismatch fails here, loudly, at the boundary.
 */

import { z } from "zod";

const gapSchema = z.object({
  after_index: z.number().int().nonnegative(),
  after_res_num: z.number().int(),
  before_res_num: z.number().int(),
  missing_count: z.number().int().nonnegative(),
  ca_distance: z.number(),
});

const chainSchema = z
  .object({
    id: z.string(),
    seq: z.string().min(1),
    ss: z.string(),
    res_nums: z.array(z.number().int()),
    ins_codes: z.string(),
    ca: z.array(z.number()),
    n: z.array(z.number()),
    c: z.array(z.number()),
    o: z.array(z.number()),
    cb: z.array(z.number()),
    sc: z.array(z.number()),
    bf: z.array(z.number()),
    gaps: z.array(gapSchema).default([]),
  })
  .superRefine((chain, ctx) => {
    const residues = chain.seq.length;
    for (const field of ["ss", "ins_codes"] as const) {
      if (chain[field].length !== residues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `chain ${chain.id}: ${field} is ${chain[field].length}, expected ${residues}`,
        });
      }
    }
    for (const field of ["ca", "n", "c", "o", "cb", "sc"] as const) {
      if (chain[field].length !== residues * 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `chain ${chain.id}: ${field} is ${chain[field].length}, expected ${residues * 3}`,
        });
      }
    }
  });

const ligandSchema = z.object({
  comp_id: z.string(),
  name: z.string(),
  chain: z.string(),
  res_num: z.number().int(),
  atoms: z.array(z.object({ element: z.string(), xyz: z.tuple([z.number(), z.number(), z.number()]) })),
});

export const structureSchema = z.object({
  id: z.string(),
  pdb_id: z.string(),
  title: z.string(),
  method: z.string(),
  resolution: z.number().nullable(),
  organism: z.string().nullable(),
  classification: z.string().nullable(),
  chains: z.array(chainSchema).nonempty(),
  ligands: z.array(ligandSchema).default([]),
  disulfides: z.array(z.unknown()).default([]),
  foldability: z.enum(["fold", "static"]),
  deposited_residues: z.number().int().positive(),
  provenance: z.object({
    source: z.string(),
    licence: z.string(),
    retrieved: z.string(),
    pdb_deposited: z.string(),
    pdb_revised: z.string().nullable(),
    pipeline_version: z.string(),
  }),
});

export type Structure = z.infer<typeof structureSchema>;
export type Chain = Structure["chains"][number];

export function parseStructure(raw: unknown): Structure {
  return structureSchema.parse(raw);
}

export function residueCount(structure: Structure): number {
  return structure.chains.reduce((total, chain) => total + chain.seq.length, 0);
}

/** Fraction of the deposited construct actually resolved. */
export function coverage(structure: Structure): number {
  return residueCount(structure) / structure.deposited_residues;
}

export function unobservedResidues(structure: Structure): number {
  return structure.chains.reduce(
    (total, chain) => total + chain.gaps.reduce((sum, gap) => sum + gap.missing_count, 0),
    0,
  );
}

/** Chain index per residue, concatenated -- what the colour modes expect. */
export function chainIndices(structure: Structure): Int32Array {
  const out = new Int32Array(residueCount(structure));
  let offset = 0;
  structure.chains.forEach((chain, index) => {
    out.fill(index, offset, offset + chain.seq.length);
    offset += chain.seq.length;
  });
  return out;
}

/** Whether a folding trajectory is worth generating for this structure. */
export function isFoldable(structure: Structure): boolean {
  return structure.foldability === "fold";
}

/**
 * Every chain concatenated into one addressable molecule.
 *
 * The read-outs were originally computed on `chains[0]` alone, which for
 * haemoglobin meant reporting 141 residues of a 574-residue tetramer and
 * silently ignoring every inter-chain contact — the entire allosteric story of
 * that protein, and the whole point of the Mpro dimer entry.
 */
export interface FlatStructure {
  readonly ca: Float64Array;
  readonly sequence: string;
  readonly secondaryStructure: string;
  /** Chain index per residue, so contacts can tell intra from inter. */
  readonly chainOf: Int32Array;
  readonly resNums: Int32Array;
  readonly chainIds: readonly string[];
  readonly residues: number;
  /** Where each chain starts in the concatenated arrays. */
  readonly offsets: readonly number[];
}

export function flatten(structure: Structure): FlatStructure {
  const residues = residueCount(structure);
  const ca = new Float64Array(residues * 3);
  const chainOf = new Int32Array(residues);
  const resNums = new Int32Array(residues);
  const offsets: number[] = [];

  let offset = 0;
  let sequence = "";
  let secondaryStructure = "";

  structure.chains.forEach((chain, index) => {
    offsets.push(offset);
    ca.set(chain.ca, offset * 3);
    chainOf.fill(index, offset, offset + chain.seq.length);
    resNums.set(chain.res_nums, offset);
    sequence += chain.seq;
    secondaryStructure += chain.ss;
    offset += chain.seq.length;
  });

  return {
    ca, sequence, secondaryStructure, chainOf, resNums,
    chainIds: structure.chains.map((c) => c.id),
    residues, offsets,
  };
}

/**
 * Turn a (chain, residue-within-chain) pair into an index into the flattened
 * molecule.
 *
 * The renderer picks per chain, so without this a hover on chain D residue 5
 * reports chain A residue 5 — the wrong residue, with no sign anything is
 * amiss.
 */
export function globalIndex(flat: FlatStructure, chain: number, residue: number): number {
  const start = flat.offsets[chain];
  return start === undefined ? -1 : start + residue;
}
