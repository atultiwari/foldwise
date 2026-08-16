import { describe, expect, it } from "vitest";

import { COLOR_MODES, colorMode, colorResidues, colorVertices } from "../src/colorModes.js";
import {
  CHAIN_COLOURS, STRUCTURE_COLOURS,
  hexToRgb, luminance, perceptualDistance, rampAt, rgbToHex, simulate,
  type Deficiency, type Rgb,
} from "../src/palette.js";
import { loadReference } from "../../core/test/fixtures/load.js";

const ubiquitin = loadReference().cases.find((c) => c.pdbId === "1UBI")!;

const DEFICIENCIES: readonly Deficiency[] = ["protanopia", "deuteranopia", "tritanopia"];

/**
 * Two colours count as distinguishable above this CIE76 distance.
 *
 * The conventional reading of ΔE: under 1 is imperceptible, 2–10 is visible at
 * a glance, and above 10 the colours read as clearly different. These are large
 * flat regions of a 3D model, the easiest case, so 15 gives margin over the
 * "clearly different" line.
 *
 * Set at 18 to begin with, on no particular basis — and it rejected two pairs
 * of the Okabe–Ito palette, which is the field's canonical colour-blind-safe
 * qualitative set. A check that fails the reference palette is miscalibrated,
 * not vigilant. The two palette changes it prompted before that were still
 * warranted: those pairs measured 13.6 and 14.9, and fail at 15 as well.
 */
const DISTINGUISHABLE = 15;

describe("colour conversion", () => {
  it("round-trips through hex", () => {
    expect(rgbToHex(hexToRgb("#3b82f6"))).toBe("#3b82f6");
  });

  it("clamps out-of-range channels", () => {
    expect(rgbToHex([-1, 0.5, 2])).toBe("#0080ff");
  });

  it("samples a ramp at its ends and midpoint", () => {
    const ramp: Rgb[] = [[0, 0, 0], [1, 1, 1]];
    expect(rampAt(ramp, 0)).toEqual([0, 0, 0]);
    expect(rampAt(ramp, 1)).toEqual([1, 1, 1]);
    expect(rampAt(ramp, 0.5)[0]).toBeCloseTo(0.5, 10);
  });

  it("clamps a ramp sampled out of range", () => {
    const ramp: Rgb[] = [[0, 0, 0], [1, 1, 1]];
    expect(rampAt(ramp, -5)).toEqual([0, 0, 0]);
    expect(rampAt(ramp, 5)).toEqual([1, 1, 1]);
  });

  it("handles degenerate ramps", () => {
    expect(rampAt([], 0.5)).toEqual([0, 0, 0]);
    expect(rampAt([[1, 0, 0]], 0.5)).toEqual([1, 0, 0]);
  });
});

/**
 * The check that matters.
 *
 * Around one man in twelve has a red-green colour vision deficiency. A viewer
 * that encodes secondary structure as red against green is unusable for them,
 * and in a teaching tool that is a student who cannot do the exercise -- not a
 * cosmetic complaint. So the palettes are simulated and measured rather than
 * assumed to be fine.
 */
describe("colour vision accessibility", () => {
  it("keeps secondary-structure colours apart under every deficiency", () => {
    const entries = Object.entries(STRUCTURE_COLOURS);
    for (const deficiency of DEFICIENCIES) {
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const distance = perceptualDistance(
            simulate(entries[i]![1], deficiency),
            simulate(entries[j]![1], deficiency),
          );
          expect(
            distance,
            `${entries[i]![0]} vs ${entries[j]![0]} under ${deficiency}`,
          ).toBeGreaterThan(DISTINGUISHABLE);
        }
      }
    }
  });

  it("keeps the charge colours apart under every deficiency", () => {
    const mode = colorMode("charge");
    const context = { index: 0, residues: 1, secondaryStructure: "C" };
    const swatches = ["R", "D", "A"].map((code) => mode.color({ ...context, code }));
    for (const deficiency of DEFICIENCIES) {
      for (let i = 0; i < swatches.length; i++) {
        for (let j = i + 1; j < swatches.length; j++) {
          expect(
            perceptualDistance(simulate(swatches[i]!, deficiency), simulate(swatches[j]!, deficiency)),
            `charge swatch ${i} vs ${j} under ${deficiency}`,
          ).toBeGreaterThan(DISTINGUISHABLE);
        }
      }
    }
  });

  it("keeps the first six chain colours apart under every deficiency", () => {
    const swatches = CHAIN_COLOURS.slice(0, 6);
    for (const deficiency of DEFICIENCIES) {
      for (let i = 0; i < swatches.length; i++) {
        for (let j = i + 1; j < swatches.length; j++) {
          expect(
            perceptualDistance(simulate(swatches[i]!, deficiency), simulate(swatches[j]!, deficiency)),
            `chain ${i} vs ${j} under ${deficiency}`,
          ).toBeGreaterThan(DISTINGUISHABLE);
        }
      }
    }
  });

  it("separates the hydropathy extremes on lightness as well as hue", () => {
    // Hue alone fails for anyone who cannot see the hue. A lightness gap means
    // the mode still carries information in greyscale, and in print.
    const mode = colorMode("hydropathy");
    const context = { index: 0, residues: 1, secondaryStructure: "C" };
    const hating = mode.color({ ...context, code: "I" });
    const loving = mode.color({ ...context, code: "R" });
    expect(Math.abs(luminance(hating) - luminance(loving))).toBeGreaterThan(0.05);
  });

  it("declares which modes are categorical", () => {
    // Categorical modes carry meaning in hue alone and therefore need a legend
    // elsewhere in the interface. Recording it here is what lets the UI know.
    expect(colorMode("structure").categorical).toBe(true);
    expect(colorMode("charge").categorical).toBe(true);
    expect(colorMode("chain").categorical).toBe(true);
    expect(colorMode("direction").categorical).toBe(false);
    expect(colorMode("hydropathy").categorical).toBe(false);
  });
});

describe("colour modes", () => {
  const input = {
    sequence: ubiquitin.seq,
    secondaryStructure: ubiquitin.ss,
    bFactors: Array.from({ length: ubiquitin.seq.length }, (_, i) => i),
    accessibility: Array.from({ length: ubiquitin.seq.length }, (_, i) => i / ubiquitin.seq.length),
    chainOf: Array.from({ length: ubiquitin.seq.length }, () => 0),
  };

  it("has a label and a hint for every mode", () => {
    for (const mode of COLOR_MODES) {
      expect(mode.label.length).toBeGreaterThan(0);
      expect(mode.hint.length).toBeGreaterThan(0);
    }
  });

  it("produces an in-range colour for every residue in every mode", () => {
    for (const mode of COLOR_MODES) {
      const colours = colorResidues(mode.key, input);
      expect(colours.length).toBe(ubiquitin.seq.length * 3);
      for (const channel of colours) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it("gives helices and strands different colours", () => {
    const colours = colorResidues("structure", input);
    const helix = ubiquitin.ss.indexOf("H");
    const strand = ubiquitin.ss.indexOf("E");
    expect(helix).toBeGreaterThanOrEqual(0);
    expect(strand).toBeGreaterThanOrEqual(0);
    expect(colours.slice(helix * 3, helix * 3 + 3)).not.toEqual(
      colours.slice(strand * 3, strand * 3 + 3),
    );
  });

  it("runs chain direction from one end of the ramp to the other", () => {
    const colours = colorResidues("direction", input);
    const last = ubiquitin.seq.length - 1;
    expect(colours[2]!).toBeGreaterThan(colours[last * 3 + 2]!); // blue at the start
    expect(colours[last * 3]!).toBeGreaterThan(colours[0]!); // red at the end
  });

  it("works without the optional inputs", () => {
    const bare = { sequence: "ACDEFG", secondaryStructure: "CCCCCC" };
    for (const mode of COLOR_MODES) {
      expect(colorResidues(mode.key, bare).length).toBe(18);
    }
  });

  it("rejects an unknown mode", () => {
    // @ts-expect-error deliberately invalid
    expect(() => colorMode("sparkles")).toThrow(/unknown colour mode/);
  });
});

describe("colorVertices", () => {
  it("spreads residue colours onto the vertices that belong to them", () => {
    const residueColors = new Float32Array([1, 0, 0, 0, 1, 0]);
    const residueOf = new Uint32Array([0, 0, 1]);
    expect(Array.from(colorVertices(residueColors, residueOf))).toEqual([1, 0, 0, 1, 0, 0, 0, 1, 0]);
  });
});
