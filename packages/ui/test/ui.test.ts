import { describe, expect, it } from "vitest";

import {
  areaPath, donutArc, extentOf, runsOf, sparklinePath, ticks,
} from "../src/charts.js";
import {
  DEFAULT_VIEW, MODE_PRESETS, applyPreset, decodeView, encodeView, presetFor,
} from "../src/urlState.js";
import { chainIndices, coverage, flatten, globalIndex, parseStructure, residueCount, unobservedResidues } from "../src/structure.js";

describe("view state in the URL", () => {
  it("encodes nothing when everything is at its default", () => {
    // A link to the default view should be the bare address, not a page of
    // parameters that say nothing.
    expect(encodeView(DEFAULT_VIEW)).toBe("");
  });

  it("round-trips a fully specified view", () => {
    const view = {
      structure: "abl-imatinib", progress: 0.625, mode: "chemistry",
      representation: "surface", color: "hydropathy", selected: 315,
      compare: "abl-t315i", playing: true,
    } as const;
    expect(decodeView(encodeView(view))).toEqual(view);
  });

  it("uses short keys, because these get pasted into messages", () => {
    const encoded = encodeView({ ...DEFAULT_VIEW, structure: "nbd1-wt", selected: 508 });
    expect(encoded).toBe("?p=nbd1-wt&s=508");
  });

  it("stores the timeline as a fraction, not a frame number", () => {
    // Frame counts depend on chain length and on the engine's settings; a link
    // pinned to frame 64 would drift the moment either changed.
    const encoded = encodeView({ ...DEFAULT_VIEW, progress: 0.5 });
    expect(encoded).toBe("?t=0.5");
  });

  it("falls back to defaults for a mangled parameter rather than failing", () => {
    // URLs arrive truncated by chat clients and edited by hand.
    const view = decodeView("?p=hba-deoxy&t=banana&r=hologram&c=&s=-99");
    expect(view.structure).toBe("hba-deoxy");
    expect(view.progress).toBe(DEFAULT_VIEW.progress);
    expect(view.representation).toBe(DEFAULT_VIEW.representation);
    expect(view.selected).toBe(DEFAULT_VIEW.selected);
  });

  it("clamps a timeline position outside the range", () => {
    expect(decodeView("?t=5").progress).toBe(DEFAULT_VIEW.progress);
    expect(decodeView("?t=-3").progress).toBe(DEFAULT_VIEW.progress);
  });

  it("accepts a leading question mark or not", () => {
    expect(decodeView("?p=x").structure).toBe("x");
    expect(decodeView("p=x").structure).toBe("x");
  });

  it("ignores parameters it does not know", () => {
    expect(decodeView("?p=x&utm_source=twitter").structure).toBe("x");
  });

  it("applies the preset for a mode the link names but does not spell out", () => {
    // Encoding omits fields the preset supplies, so decoding has to put them
    // back -- otherwise a shared link shows the Chemistry tab selected with
    // the Fold tab's colouring.
    const view = decodeView("?m=chemistry");
    expect(view.color).toBe("hydropathy");
    expect(view.progress).toBe(1);
  });

  it("lets an explicit parameter override the preset", () => {
    expect(decodeView("?m=chemistry&c=charge").color).toBe("charge");
  });

  it("round-trips a preset view without spelling it out", () => {
    const chemistry = applyPreset(DEFAULT_VIEW, "chemistry");
    expect(decodeView(encodeView(chemistry))).toEqual(chemistry);
  });

  it("handles an empty query", () => {
    expect(decodeView("")).toEqual(DEFAULT_VIEW);
  });
});

describe("mode presets", () => {
  it("has a label and a hint for each", () => {
    for (const preset of MODE_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.hint.length).toBeGreaterThan(0);
    }
  });

  it("jumps anatomy and chemistry to the folded state", () => {
    const scrubbed = { ...DEFAULT_VIEW, progress: 0.3, playing: true };
    expect(applyPreset(scrubbed, "anatomy").progress).toBe(1);
    expect(applyPreset(scrubbed, "chemistry").progress).toBe(1);
    expect(applyPreset(scrubbed, "anatomy").playing).toBe(false);
  });

  it("leaves the timeline alone for the fold preset", () => {
    const scrubbed = { ...DEFAULT_VIEW, progress: 0.3, playing: true };
    expect(applyPreset(scrubbed, "fold").progress).toBe(0.3);
    expect(applyPreset(scrubbed, "fold").playing).toBe(true);
  });

  it("keeps the selected residue when switching mode", () => {
    // Switching preset should not throw away what the reader was looking at.
    const view = { ...DEFAULT_VIEW, selected: 42 };
    expect(applyPreset(view, "chemistry").selected).toBe(42);
  });

  it("falls back to the first preset for an unknown mode", () => {
    // @ts-expect-error deliberately invalid
    expect(presetFor("sideways").key).toBe("fold");
  });
});

describe("charts", () => {
  it("widens the extent of a flat series so a constant line still draws", () => {
    expect(extentOf([5, 5, 5])).toEqual({ min: 4.5, max: 5.5 });
  });

  it("ignores non-finite values in an extent", () => {
    expect(extentOf([1, Number.NaN, 3])).toEqual({ min: 1, max: 3 });
  });

  it("survives a series with no finite values at all", () => {
    expect(extentOf([Number.NaN, Number.POSITIVE_INFINITY])).toEqual({ min: 0, max: 1 });
  });

  it("draws a sparkline spanning the full width", () => {
    const path = sparklinePath([0, 1, 0], { width: 100, height: 20 });
    expect(path.startsWith("M0.00")).toBe(true);
    expect(path).toContain("L100.00");
  });

  it("puts the largest value nearest the top", () => {
    // SVG y grows downward, so the maximum must have the smaller coordinate.
    const path = sparklinePath([0, 10], { width: 10, height: 20 });
    const [first, second] = path.split("L").map((p) => Number(p.replace("M", "").split(" ")[1]));
    expect(second!).toBeLessThan(first!);
  });

  it("returns an empty path for an empty series", () => {
    expect(sparklinePath([], { width: 10, height: 10 })).toBe("");
    expect(areaPath([], { width: 10, height: 10 })).toBe("");
  });

  it("closes an area path back to the baseline", () => {
    const path = areaPath([1, 2, 3], { width: 30, height: 10 });
    expect(path.endsWith("Z")).toBe(true);
    expect(path).toContain("L30.00 10");
  });

  it("centres a single-point sparkline", () => {
    expect(sparklinePath([5], { width: 100, height: 20 })).toContain("M50.00");
  });
});

describe("donutArc", () => {
  it("draws nothing at zero", () => {
    expect(donutArc(10, 10, 8, 0)).toBe("");
  });

  it("draws two arcs for a full circle", () => {
    // A single arc from a point back to itself renders as nothing at all.
    const path = donutArc(10, 10, 8, 1);
    expect(path.match(/A/g)).toHaveLength(2);
  });

  it("starts at twelve o'clock", () => {
    expect(donutArc(10, 10, 8, 0.25).startsWith("M10 2")).toBe(true);
  });

  it("sets the large-arc flag past halfway", () => {
    expect(donutArc(10, 10, 8, 0.25)).toContain("0 0 1");
    expect(donutArc(10, 10, 8, 0.75)).toContain("0 1 1");
  });

  it("clamps out-of-range fractions", () => {
    expect(donutArc(10, 10, 8, -1)).toBe("");
    expect(donutArc(10, 10, 8, 2).match(/A/g)).toHaveLength(2);
  });
});

describe("runsOf", () => {
  it("collapses a per-residue string into runs", () => {
    // One rectangle per residue is thousands of DOM nodes on a large
    // structure; one per run is a few dozen.
    expect(runsOf("HHHEEC")).toEqual([
      { start: 0, end: 3, value: "H" },
      { start: 3, end: 5, value: "E" },
      { start: 5, end: 6, value: "C" },
    ]);
  });

  it("handles an empty string and a single run", () => {
    expect(runsOf("")).toEqual([]);
    expect(runsOf("CCC")).toEqual([{ start: 0, end: 3, value: "C" }]);
  });

  it("covers every residue exactly once", () => {
    const sequence = "HHEECCCHHHTTEE";
    const bands = runsOf(sequence);
    expect(bands[0]!.start).toBe(0);
    expect(bands.at(-1)!.end).toBe(sequence.length);
    for (let i = 1; i < bands.length; i++) expect(bands[i]!.start).toBe(bands[i - 1]!.end);
  });
});

describe("ticks", () => {
  it("produces round numbers inside the range", () => {
    const values = ticks({ min: 0, max: 10 });
    expect(values[0]!).toBeGreaterThanOrEqual(0);
    expect(values.at(-1)!).toBeLessThanOrEqual(10);
    for (const value of values) expect(Number.isFinite(value)).toBe(true);
  });

  it("handles a zero-width range", () => {
    expect(ticks({ min: 5, max: 5 })).toEqual([5]);
  });

  it("works across magnitudes", () => {
    for (const max of [0.01, 1, 1000, 100000]) {
      expect(ticks({ min: 0, max }).length).toBeGreaterThan(1);
    }
  });
});

describe("structure schema", () => {
  const chain = (residues: number) => ({
    id: "A",
    seq: "A".repeat(residues),
    ss: "C".repeat(residues),
    res_nums: Array.from({ length: residues }, (_, i) => i + 1),
    ins_codes: " ".repeat(residues),
    ca: new Array(residues * 3).fill(0),
    n: new Array(residues * 3).fill(0),
    c: new Array(residues * 3).fill(0),
    o: new Array(residues * 3).fill(0),
    cb: new Array(residues * 3).fill(0),
    sc: new Array(residues * 3).fill(0),
    bf: new Array(residues).fill(10),
    gaps: [],
  });

  const valid = (residues = 3) => ({
    id: "test", pdb_id: "1TST", title: "t", method: "X-RAY", resolution: 1.5,
    organism: null, classification: null,
    chains: [chain(residues)], ligands: [], disulfides: [],
    foldability: "fold", deposited_residues: 4,
    provenance: {
      source: "RCSB", licence: "CC0", retrieved: "2026-08-16",
      pdb_deposited: "1994-02-03", pdb_revised: null, pipeline_version: "0.1.0",
    },
  });

  it("accepts a well-formed structure", () => {
    expect(parseStructure(valid()).id).toBe("test");
  });

  it("rejects a chain whose arrays do not match its sequence", () => {
    // The pipeline validates on the way out, but the browser reads a separate
    // artefact: a stale build would otherwise crash deep in the geometry code.
    const broken = valid();
    broken.chains[0]!.ca = [0, 0, 0];
    expect(() => parseStructure(broken)).toThrow(/ca is 3, expected 9/);
  });

  it("rejects a secondary-structure string of the wrong length", () => {
    const broken = valid();
    broken.chains[0]!.ss = "CC";
    expect(() => parseStructure(broken)).toThrow(/ss is 2, expected 3/);
  });

  it("rejects a structure with no chains", () => {
    const broken = { ...valid(), chains: [] };
    expect(() => parseStructure(broken)).toThrow();
  });

  it("reports coverage against the deposited construct", () => {
    const structure = parseStructure(valid(3));
    expect(residueCount(structure)).toBe(3);
    expect(coverage(structure)).toBeCloseTo(0.75, 6);
  });

  it("counts unobserved residues across gaps", () => {
    const withGap = valid(3);
    withGap.chains[0]!.gaps = [
      { after_index: 0, after_res_num: 1, before_res_num: 30, missing_count: 28, ca_distance: 12 },
    ] as never;
    expect(unobservedResidues(parseStructure(withGap))).toBe(28);
  });

  it("builds a chain index per residue", () => {
    const two = valid(2);
    const structure = parseStructure({ ...two, chains: [chain(2), { ...chain(3), id: "B" }] });
    expect(Array.from(chainIndices(structure))).toEqual([0, 0, 1, 1, 1]);
  });
});

describe("flatten", () => {
  const chain = (id: string, residues: number, first: number) => ({
    id, seq: "A".repeat(residues), ss: "C".repeat(residues),
    res_nums: Array.from({ length: residues }, (_, i) => first + i),
    ins_codes: " ".repeat(residues),
    ca: Array.from({ length: residues * 3 }, (_, i) => i),
    n: new Array(residues * 3).fill(0), c: new Array(residues * 3).fill(0),
    o: new Array(residues * 3).fill(0), cb: new Array(residues * 3).fill(0),
    sc: new Array(residues * 3).fill(0), bf: new Array(residues).fill(1), gaps: [],
  });
  const structure = parseStructure({
    id: "t", pdb_id: "1TST", title: "t", method: "X-RAY", resolution: 1,
    organism: null, classification: null,
    chains: [chain("A", 2, 1), chain("B", 3, 100)],
    ligands: [], disulfides: [], foldability: "fold", deposited_residues: 5,
    provenance: { source: "s", licence: "l", retrieved: "2026-08-16",
      pdb_deposited: "1994-01-01", pdb_revised: null, pipeline_version: "0.1.0" },
  });

  it("concatenates every chain, not just the first", () => {
    // The read-outs measured chains[0] alone, so haemoglobin reported 141
    // residues of a 574-residue tetramer.
    const flat = flatten(structure);
    expect(flat.residues).toBe(5);
    expect(flat.sequence).toBe("AAAAA");
    expect(flat.ca.length).toBe(15);
  });

  it("records which chain each residue belongs to", () => {
    expect(Array.from(flatten(structure).chainOf)).toEqual([0, 0, 1, 1, 1]);
  });

  it("keeps author residue numbering", () => {
    expect(Array.from(flatten(structure).resNums)).toEqual([1, 2, 100, 101, 102]);
  });

  it("maps a chain-local index to a global one", () => {
    const flat = flatten(structure);
    expect(globalIndex(flat, 0, 1)).toBe(1);
    // Chain B residue 0 is global index 2 -- not 0, which is what dropping
    // the chain index would give.
    expect(globalIndex(flat, 1, 0)).toBe(2);
    expect(globalIndex(flat, 9, 0)).toBe(-1);
  });
});

describe("compare mode in the URL", () => {
  it("round-trips a comparison", () => {
    const view = { ...DEFAULT_VIEW, compare: "nbd1-df508" };
    expect(encodeView(view)).toBe("?cmp=nbd1-df508");
    expect(decodeView("?cmp=nbd1-df508").compare).toBe("nbd1-df508");
  });

  it("omits it when no comparison is open", () => {
    expect(encodeView(DEFAULT_VIEW)).toBe("");
    expect(decodeView("").compare).toBe("");
  });
});
