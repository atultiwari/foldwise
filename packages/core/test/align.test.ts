import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  alignByResidueNumber, compareStructures, gather, notableDeviations,
} from "../src/align.js";

interface Chain { id: string; seq: string; ca: number[]; res_nums: number[] }
const load = (id: string) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../../data/structures/${id}.json`, import.meta.url)), "utf8"),
  ) as { chains: Chain[] };

const flatten = (s: { chains: Chain[] }) => ({
  ca: s.chains.flatMap((c) => c.ca),
  resNums: s.chains.flatMap((c) => c.res_nums),
  chainOf: s.chains.flatMap((c, i) => new Array(c.seq.length).fill(i)),
});

describe("alignByResidueNumber", () => {
  it("matches on residue number, not position", () => {
    const a = { ca: [0, 0, 0, 1, 0, 0, 2, 0, 0], resNums: [10, 11, 12] };
    const b = { ca: [1, 0, 0, 2, 0, 0], resNums: [11, 12] };
    const alignment = alignByResidueNumber(a, b);
    expect(Array.from(alignment.a)).toEqual([1, 2]);
    expect(Array.from(alignment.b)).toEqual([0, 1]);
    expect(alignment.onlyInA).toBe(1);
    expect(alignment.onlyInB).toBe(0);
  });

  it("keeps chains apart when they share numbering", () => {
    // A homodimer has residue 1 in both chains. Ignoring the chain would
    // match chain A's residue 1 to chain B's.
    const a = { ca: new Array(6).fill(0), resNums: [1, 1], chainOf: [0, 1] };
    const b = { ca: new Array(6).fill(0), resNums: [1, 1], chainOf: [0, 1] };
    const alignment = alignByResidueNumber(a, b);
    expect(Array.from(alignment.a)).toEqual([0, 1]);
    expect(Array.from(alignment.b)).toEqual([0, 1]);
  });

  it("reports what is present in only one side", () => {
    const a = { ca: new Array(9).fill(0), resNums: [1, 2, 3] };
    const b = { ca: new Array(9).fill(0), resNums: [3, 4, 5] };
    const alignment = alignByResidueNumber(a, b);
    expect(alignment.count).toBe(1);
    expect(alignment.onlyInA).toBe(2);
    expect(alignment.onlyInB).toBe(2);
  });
});

describe("gather", () => {
  it("picks out the aligned coordinates", () => {
    expect(Array.from(gather([0, 0, 0, 1, 2, 3, 9, 9, 9], [1]))).toEqual([1, 2, 3]);
  });
});

describe("comparing one chain rather than a whole assembly", () => {
  /**
   * Superposing whole assemblies assumes the chains sit in the same relative
   * arrangement, and for crystallographic multimers they usually do not. The
   * two ABL structures each contain two copies packed differently; fitting
   * both at once gave 25.6 Å for two molecules that are nearly identical.
   */
  it("fixes a two-chain crystal that will not superpose as a whole", () => {
    const a = flatten(load("abl-imatinib"));
    const b = flatten(load("abl-t315i-ponatinib"));
    expect(compareStructures(a, b).rmsd).toBeGreaterThan(10);
    expect(compareStructures(a, b, { chain: 0 }).rmsd).toBeLessThan(2);
  });

  it("keeps only residues from the requested chain", () => {
    const a = flatten(load("abl-imatinib"));
    const b = flatten(load("abl-t315i-ponatinib"));
    const comparison = compareStructures(a, b, { chain: 1 });
    for (let i = 0; i < comparison.alignment.count; i++) {
      expect(a.chainOf[comparison.alignment.a[i]!]).toBe(1);
      expect(b.chainOf[comparison.alignment.b[i]!]).toBe(1);
    }
  });

  it("counts unmatched residues within that chain only", () => {
    const a = flatten(load("nbd1-wt"));
    const b = flatten(load("nbd1-df508"));
    const restricted = compareStructures(a, b, { chain: 0 });
    const whole = compareStructures(a, b);
    expect(restricted.alignment.onlyInB).toBeLessThan(whole.alignment.onlyInB);
  });
});

describe("compareStructures", () => {
  it("gives zero deviation for a structure against itself", () => {
    const s = flatten(load("mpro-nirmatrelvir"));
    const comparison = compareStructures(s, s);
    expect(comparison.rmsd).toBeCloseTo(0, 6);
    expect(comparison.alignment.count).toBe(s.resNums.length);
  });

  it("is unaffected by where the second structure sits in space", () => {
    const s = flatten(load("mpro-nirmatrelvir"));
    const moved = { ...s, ca: s.ca.map((v, i) => v + (i % 3 === 0 ? 250 : 0)) };
    expect(compareStructures(s, moved).rmsd).toBeCloseTo(0, 5);
  });

  it("refuses a comparison with too little in common", () => {
    const a = { ca: [0, 0, 0], resNums: [1] };
    const b = { ca: [0, 0, 0], resNums: [99] };
    expect(() => compareStructures(a, b)).toThrow(/at least 3/);
  });

  /**
   * The case the whole module exists for.
   *
   * ΔF508 deletes a residue, so from position 509 onward the two chains'
   * array indices are permanently off by one. Aligning by index would
   * misalign the entire C-terminal half and return a confident, meaningless
   * number.
   */
  describe("CFTR NBD1, wild type against ΔF508", () => {
    const wt = flatten(load("nbd1-wt"));
    const mutant = flatten(load("nbd1-df508"));
    const comparison = compareStructures(wt, mutant);

    it("aligns a substantial part of the domain", () => {
      expect(comparison.alignment.count).toBeGreaterThan(180);
    });

    it("never matches a residue number to a different one", () => {
      for (let i = 0; i < comparison.alignment.count; i++) {
        expect(mutant.resNums[comparison.alignment.b[i]!]).toBe(
          wt.resNums[comparison.alignment.a[i]!],
        );
      }
    });

    it("does not align residue 508, which exists in only one of them", () => {
      const alignedNumbers = new Set(
        Array.from(comparison.alignment.a, (i) => wt.resNums[i]!),
      );
      expect(alignedNumbers.has(507)).toBe(true);
      expect(alignedNumbers.has(509)).toBe(true);
      expect(alignedNumbers.has(508)).toBe(false);
    });

    it("finds the fold broadly preserved, which is the clinical point", () => {
      // A folding defect, not a structural collapse. If this ever exceeded a
      // few angstrom the story told alongside it would be wrong.
      expect(comparison.rmsd).toBeLessThan(3);
    });

    it("reports a noise floor below its own RMSD", () => {
      expect(comparison.noiseFloor).toBeGreaterThan(0);
      expect(comparison.noiseFloor).toBeLessThan(comparison.rmsd);
    });

    it("picks out a handful of notable residues, not the whole chain", () => {
      // Without a noise floor every residue looks different and the reader
      // learns something false.
      const notable = notableDeviations(comparison);
      expect(notable.length).toBeGreaterThan(0);
      expect(notable.length).toBeLessThan(comparison.alignment.count / 4);
    });

    it("orders notable residues worst first", () => {
      const notable = notableDeviations(comparison);
      for (let i = 1; i < notable.length; i++) {
        expect(comparison.deviation[notable[i - 1]!]!).toBeGreaterThanOrEqual(
          comparison.deviation[notable[i]!]!,
        );
      }
    });
  });
});
