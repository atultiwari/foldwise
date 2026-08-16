import { describe, expect, it } from "vitest";

import {
  BURIED_THRESHOLD,
  buriedFraction,
  chainMass,
  classCounts,
  gravy,
  netCharge,
  relativeAccessibility,
  residueInfo,
  RESIDUE_TABLE,
  UNKNOWN_RESIDUE,
} from "../src/composition.js";
import {
  ENERGY_CUTOFF,
  amideHydrogens,
  bondEnergy,
  donorMask,
  hydrogenBonds,
  nativeBondsFormed,
  type BackboneCoords,
} from "../src/hbonds.js";
import {
  DEFAULT_SALT_BRIDGE_CUTOFF,
  disulfides,
  nativeBridgesFormed,
  saltBridges,
} from "../src/saltBridges.js";
import { loadReference, type ReferenceCase } from "./fixtures/load.js";

describe("residue table", () => {
  it("has all twenty standard amino acids, each exactly once", () => {
    expect(RESIDUE_TABLE).toHaveLength(20);
    expect(new Set(RESIDUE_TABLE.map((r) => r.code)).size).toBe(20);
    expect(new Set(RESIDUE_TABLE.map((r) => r.three)).size).toBe(20);
  });

  it("puts isoleucine at the hydrophobic extreme and arginine at the other", () => {
    // Kyte & Doolittle's scale runs from +4.5 (Ile) to -4.5 (Arg).
    const sorted = [...RESIDUE_TABLE].sort((a, b) => b.hydropathy - a.hydropathy);
    expect(sorted[0]!.code).toBe("I");
    expect(sorted.at(-1)!.code).toBe("R");
    expect(sorted[0]!.hydropathy).toBe(4.5);
    expect(sorted.at(-1)!.hydropathy).toBe(-4.5);
  });

  it("charges exactly the five ionisable side chains", () => {
    const positive = RESIDUE_TABLE.filter((r) => r.charge === 1).map((r) => r.code);
    const negative = RESIDUE_TABLE.filter((r) => r.charge === -1).map((r) => r.code);
    expect(positive.sort()).toEqual(["H", "K", "R"]);
    expect(negative.sort()).toEqual(["D", "E"]);
  });

  it("orders maximum accessible area by side-chain size", () => {
    // Glycine has no side chain and tryptophan has the largest.
    const sorted = [...RESIDUE_TABLE].sort((a, b) => a.maxAsa - b.maxAsa);
    expect(sorted[0]!.code).toBe("G");
    expect(sorted.at(-1)!.code).toBe("W");
  });

  it("falls back to a neutral unknown for anything else", () => {
    expect(residueInfo("Z")).toBe(UNKNOWN_RESIDUE);
    expect(residueInfo("X").charge).toBe(0);
  });

  it("accepts lower case", () => {
    expect(residueInfo("w").three).toBe("TRP");
  });
});

describe("sequence properties", () => {
  it("computes ubiquitin's mass to within a dalton of the published value", () => {
    // Ubiquitin is 8.6 kDa.
    const ubiquitin = loadReference().cases.find((c) => c.pdbId === "1UBI")!;
    expect(chainMass(ubiquitin.seq) / 1000).toBeCloseTo(8.6, 1);
  });

  it("counts net charge", () => {
    expect(netCharge("DDEE")).toBe(-4);
    expect(netCharge("RKH")).toBe(3);
    expect(netCharge("DRDR")).toBe(0);
    expect(netCharge("AAAA")).toBe(0);
  });

  it("computes GRAVY as the mean hydropathy", () => {
    expect(gravy("II")).toBeCloseTo(4.5, 10);
    expect(gravy("IR")).toBeCloseTo(0, 10);
    expect(gravy("")).toBe(0);
  });

  it("partitions every residue into exactly one class", () => {
    const sequence = RESIDUE_TABLE.map((r) => r.code).join("");
    const counts = classCounts(sequence);
    const total = Object.values(counts).reduce((sum, v) => sum + v, 0);
    expect(total).toBe(20);
  });
});

describe("relativeAccessibility", () => {
  it("is 1 for a fully exposed residue", () => {
    expect(relativeAccessibility("G", [104])[0]!).toBeCloseTo(1, 10);
  });

  it("clamps above the theoretical maximum rather than exceeding 1", () => {
    expect(relativeAccessibility("G", [999])[0]!).toBe(1);
  });

  it("normalises by residue, not by raw area", () => {
    // The same 60 square angstrom is mostly buried on tryptophan and mostly
    // exposed on glycine. This is why raw SASA is the wrong burial measure.
    const [tryptophan] = relativeAccessibility("W", [60]);
    const [glycine] = relativeAccessibility("G", [60]);
    expect(tryptophan!).toBeLessThan(BURIED_THRESHOLD);
    expect(glycine!).toBeGreaterThan(BURIED_THRESHOLD);
  });

  it("rejects a length mismatch", () => {
    expect(() => relativeAccessibility("GG", [1])).toThrow(/2 residues but 1/);
  });
});

describe("buriedFraction", () => {
  it("counts residues below the threshold", () => {
    expect(buriedFraction([0.1, 0.2, 0.9, 0.8])).toBe(0.5);
  });

  it("is zero for an empty chain", () => {
    expect(buriedFraction([])).toBe(0);
  });
});

/**
 * Backbone of a fixture case.
 *
 * Real coordinates rather than a parametric helix: getting a synthetic
 * backbone's carbonyl geometry right is fiddly enough that a wrong one reads
 * as a bug in the code under test.
 */
function backboneOf(testCase: ReferenceCase): BackboneCoords {
  return {
    n: testCase.coords["n"]!,
    ca: testCase.coords["ca"]!,
    c: testCase.coords["c"]!,
    o: testCase.coords["o"]!,
  };
}

/** Proline cannot donate, and neither can the first residue of a segment. */
function donorsFor(testCase: ReferenceCase): boolean[] {
  return donorMask(
    testCase.seq,
    Array.from({ length: testCase.seq.length }, (_, i) => i === 0),
  );
}

describe("hydrogen bonds", () => {
  it("puts each amide hydrogen one angstrom from its nitrogen", () => {
    const ubiquitin = loadReference().cases.find((c) => c.pdbId === "1UBI")!;
    const backbone = backboneOf(ubiquitin);
    const h = amideHydrogens(backbone);
    for (let i = 1; i < 10; i++) {
      const d = Math.hypot(
        h[i * 3]! - backbone.n[i * 3]!,
        h[i * 3 + 1]! - backbone.n[i * 3 + 1]!,
        h[i * 3 + 2]! - backbone.n[i * 3 + 2]!,
      );
      expect(d).toBeCloseTo(1, 9);
    }
  });

  it("scores an ideal donor-acceptor geometry as a bond", () => {
    const backbone: BackboneCoords = {
      o: [0, 0, 0, 0, 0, 0],
      c: [-1.23, 0, 0, 0, 0, 0],
      n: [0, 0, 0, 2.9, 0, 0],
      ca: [0, 0, 0, 5, 0, 0],
    };
    const energy = bondEnergy(backbone, [0, 0, 0, 1.9, 0, 0], 1, 0);
    expect(energy).toBeLessThan(ENERGY_CUTOFF);
    expect(energy).toBeGreaterThan(-6);
  });

  it("scores a distant pair as no bond", () => {
    const backbone: BackboneCoords = {
      o: [0, 0, 0, 0, 0, 0],
      c: [-1.23, 0, 0, 0, 0, 0],
      n: [0, 0, 0, 13, 0, 0],
      ca: [0, 0, 0, 15, 0, 0],
    };
    expect(bondEnergy(backbone, [0, 0, 0, 12, 0, 0], 1, 0)).toBeGreaterThan(ENERGY_CUTOFF);
  });

  it("reproduces the pipeline's hydrogen-bond map exactly", () => {
    // The pipeline computes this map in Python to assign secondary structure.
    // Two implementations of the same criterion should agree bond for bond; if
    // they do not, one of them is wrong and the ribbon is built on sand.
    for (const testCase of loadReference().cases) {
      const backbone = backboneOf(testCase);
      const ours = new Set(
        hydrogenBonds(backbone, { isDonor: donorsFor(testCase) }).map(
          (b) => `${b.acceptor}|${b.donor}`,
        ),
      );
      const theirs = new Set(
        testCase.expected.hydrogenBonds.map(([a, d]) => `${a}|${d}`),
      );
      const shared = [...theirs].filter((k) => ours.has(k)).length;
      expect(shared / theirs.size).toBeGreaterThan(0.99);
      expect(ours.size).toBe(theirs.size);
    }
  });

  it("finds the i to i+4 ladder inside a known alpha helix", () => {
    // Ubiquitin's only long helix runs from residue 23 to 34.
    const ubiquitin = loadReference().cases.find((c) => c.pdbId === "1UBI")!;
    const bonds = hydrogenBonds(backboneOf(ubiquitin), {
      isDonor: donorsFor(ubiquitin),
    });
    // Both ends must be inside the helix. Bounding only one of them lets
    // through the beta-sheet bonds between strands 1 and 5, whose partners sit
    // sixty residues apart.
    const inside = (i: number) => i >= 22 && i <= 33;
    const inHelix = bonds.filter((b) => inside(b.acceptor) && inside(b.donor));

    // Twelve helical residues give eight i->i+4 bonds, and within the helix
    // proper that is the only spacing present.
    expect(inHelix).toHaveLength(8);
    expect(inHelix.every((b) => b.donor - b.acceptor === 4)).toBe(true);
  });

  it("finds nothing in an extended chain", () => {
    const residues = 12;
    const n: number[] = [], ca: number[] = [], c: number[] = [], o: number[] = [];
    for (let i = 0; i < residues; i++) {
      ca.push(i * 3.8, 0, 0);
      n.push(i * 3.8 - 1.2, 0.5, 0);
      c.push(i * 3.8 + 1.2, 0.5, 0);
      o.push(i * 3.8 + 1.5, 1.6, 0);
    }
    expect(hydrogenBonds({ n, ca, c, o })).toHaveLength(0);
  });

  it("never lets the first residue donate", () => {
    // Its amide H would be oriented by a carbonyl that is not there.
    const bonds = hydrogenBonds(backboneOf(loadReference().cases[0]!));
    expect(bonds.some((b) => b.donor === 0)).toBe(false);
  });

  it("respects an explicit donor mask", () => {
    const ubiquitin = loadReference().cases.find((c) => c.pdbId === "1UBI")!;
    const backbone = backboneOf(ubiquitin);
    const all = hydrogenBonds(backbone);
    const blocked = all[0]!.donor;
    const masked = hydrogenBonds(backbone, {
      isDonor: Array.from({ length: ubiquitin.seq.length }, (_, i) => i !== blocked),
    });
    expect(masked.length).toBeLessThan(all.length);
    expect(masked.some((b) => b.donor === blocked)).toBe(false);
  });

  it("counts all native bonds as formed in the native state", () => {
    const backbone = backboneOf(loadReference().cases[0]!);
    const native = hydrogenBonds(backbone);
    expect(nativeBondsFormed(native, backbone)).toBe(native.length);
  });

  it("counts none as formed once the structure is pulled apart", () => {
    const backbone = backboneOf(loadReference().cases[0]!);
    const native = hydrogenBonds(backbone);
    expect(native.length).toBeGreaterThan(0);

    // Scale uniformly, so every interatomic distance grows by the same factor.
    // Stretching along one axis only would leave bonds lying in the other two
    // plane intact, which is how this test first talked itself into passing.
    const blowUp = (a: ArrayLike<number>) => Array.from(a, (v) => v * 4);
    expect(
      nativeBondsFormed(native, {
        n: blowUp(backbone.n),
        ca: blowUp(backbone.ca),
        c: blowUp(backbone.c),
        o: blowUp(backbone.o),
      }),
    ).toBe(0);
  });

  it("returns zero when there are no native bonds to count", () => {
    expect(nativeBondsFormed([], backboneOf(loadReference().cases[0]!))).toBe(0);
  });
});

describe("donorMask", () => {
  it("excludes proline and every segment start", () => {
    const mask = donorMask("AAPAA", [true, false, false, true, false]);
    expect(mask).toEqual([false, true, false, false, true]);
  });
});

/**
 * The real test for salt bridges: how well a centroid-based criterion
 * reproduces the all-atom answer the pipeline computes with full side chains.
 */
describe("salt bridges against the all-atom reference", () => {
  const reference = loadReference();

  const label = (testCase: ReferenceCase, index: number): string =>
    `${testCase.chain}:${testCase.resNums[index]}`;

  for (const testCase of reference.cases) {
    describe(`${testCase.pdbId}`, () => {
      const expected = new Set(
        testCase.expected.saltBridgePairs.map((pair) => pair.join("|")),
      );
      const found = saltBridges(testCase.coords["sc"]!, testCase.seq);
      const foundLabels = new Set(
        found.map((b) =>
          [label(testCase, b.i), label(testCase, b.j)].sort().join("|"),
        ),
      );

      it("recovers most of the all-atom salt bridges", () => {
        if (expected.size === 0) return;
        const recovered = [...expected].filter((p) => foundLabels.has(p)).length;
        expect(recovered / expected.size).toBeGreaterThan(0.6);
      });

      it("does not invent large numbers of bridges that are not there", () => {
        if (expected.size === 0) return;
        const spurious = [...foundLabels].filter((p) => !expected.has(p)).length;
        expect(spurious).toBeLessThanOrEqual(expected.size);
      });
    });
  }
});

describe("saltBridges", () => {
  it("pairs opposite charges within the cutoff", () => {
    const bridges = saltBridges([0, 0, 0, 3, 0, 0], "DR");
    expect(bridges).toHaveLength(1);
    expect(bridges[0]!.distance).toBeCloseTo(3, 10);
  });

  it("ignores like charges however close", () => {
    expect(saltBridges([0, 0, 0, 1, 0, 0], "DE")).toHaveLength(0);
    expect(saltBridges([0, 0, 0, 1, 0, 0], "RK")).toHaveLength(0);
  });

  it("ignores neutral residues", () => {
    expect(saltBridges([0, 0, 0, 1, 0, 0], "AD")).toHaveLength(0);
  });

  it("respects the cutoff", () => {
    const coords = [0, 0, 0, DEFAULT_SALT_BRIDGE_CUTOFF + 0.5, 0, 0];
    expect(saltBridges(coords, "DR")).toHaveLength(0);
    expect(saltBridges(coords, "DR", { cutoff: 10 })).toHaveLength(1);
  });

  it("rejects a sequence that does not match the coordinates", () => {
    expect(() => saltBridges([0, 0, 0], "DR")).toThrow(/2 residues but 1/);
  });

  it("counts native bridges that survive a move", () => {
    const native = saltBridges([0, 0, 0, 3, 0, 0], "DR");
    expect(nativeBridgesFormed(native, [0, 0, 0, 3, 0, 0])).toBe(1);
    expect(nativeBridgesFormed(native, [0, 0, 0, 30, 0, 0])).toBe(0);
  });
});

describe("disulfides", () => {
  it("pairs nearby cysteines", () => {
    expect(disulfides([0, 0, 0, 2, 0, 0], "CC")).toHaveLength(1);
  });

  it("ignores distant cysteines", () => {
    expect(disulfides([0, 0, 0, 12, 0, 0], "CC")).toHaveLength(0);
  });

  it("ignores everything that is not a cysteine", () => {
    expect(disulfides([0, 0, 0, 2, 0, 0], "CA")).toHaveLength(0);
  });
});
