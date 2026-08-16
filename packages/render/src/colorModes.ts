/**
 * What each residue is coloured by.
 *
 * Every mode is a pure function of one residue's properties, which makes them
 * trivial to test, trivial to add to, and impossible to accidentally couple to
 * the renderer's state.
 */

import { residueInfo } from "@foldwise/core";

import {
  CHAIN_COLOURS, CORE, DIRECTION_RAMP, HYDROPHILIC, HYDROPHOBIC,
  NEGATIVE, NEUTRAL, POSITIVE, STRUCTURE_COLOURS, SURFACE,
  mix, rampAt, type Rgb,
} from "./palette.js";
import { shapeOf } from "./profile.js";

export type ColorModeKey =
  | "structure" | "direction" | "hydropathy" | "charge"
  | "flexibility" | "burial" | "chain";

export interface ResidueContext {
  readonly index: number;
  readonly residues: number;
  readonly code: string;
  readonly secondaryStructure: string;
  /** B-factor, normalised to [0, 1] across the structure. */
  readonly flexibility?: number;
  /** Relative solvent accessibility, 0 buried to 1 exposed. */
  readonly accessibility?: number;
  readonly chainIndex?: number;
}

export interface ColorMode {
  readonly key: ColorModeKey;
  readonly label: string;
  /** Plain-English explanation, shown beside the control. */
  readonly hint: string;
  readonly color: (context: ResidueContext) => Rgb;
  /**
   * Whether the mode carries meaning in hue alone. Modes that do need a second
   * channel elsewhere in the interface -- a legend, a label, or a pattern.
   */
  readonly categorical: boolean;
}

/** Kyte-Doolittle runs -4.5 to +4.5. */
const HYDROPATHY_RANGE = 4.5;

export const COLOR_MODES: readonly ColorMode[] = [
  {
    key: "structure",
    label: "Secondary structure",
    hint: "Helices, sheets, and the loops between them.",
    categorical: true,
    color: ({ secondaryStructure, index }) =>
      STRUCTURE_COLOURS[shapeOf(secondaryStructure[index] ?? "C")],
  },
  {
    key: "direction",
    label: "Chain direction",
    hint: "Blue where the chain starts, red where it ends.",
    categorical: false,
    color: ({ index, residues }) =>
      rampAt(DIRECTION_RAMP, residues > 1 ? index / (residues - 1) : 0),
  },
  {
    key: "hydropathy",
    label: "Water-loving or water-hating",
    hint: "Orange residues hide from water; teal ones seek it.",
    categorical: false,
    color: ({ code }) => {
      const t = (residueInfo(code).hydropathy + HYDROPATHY_RANGE) / (HYDROPATHY_RANGE * 2);
      return mix(HYDROPHILIC, HYDROPHOBIC, t);
    },
  },
  {
    key: "charge",
    label: "Electric charge",
    hint: "Positive, negative, and neutral side chains.",
    categorical: true,
    color: ({ code }) => {
      const charge = residueInfo(code).charge;
      if (charge > 0) return POSITIVE;
      if (charge < 0) return NEGATIVE;
      return NEUTRAL;
    },
  },
  {
    key: "flexibility",
    label: "Flexibility",
    hint: "Measured wobble from the experiment — warmer means floppier.",
    categorical: false,
    color: ({ flexibility }) => rampAt(DIRECTION_RAMP, flexibility ?? 0),
  },
  {
    key: "burial",
    label: "Core or surface",
    hint: "How deeply buried each residue ends up.",
    categorical: false,
    color: ({ accessibility }) => mix(CORE, SURFACE, accessibility ?? 0.5),
  },
  {
    key: "chain",
    label: "Chain",
    hint: "One colour per polypeptide chain.",
    categorical: true,
    color: ({ chainIndex }) => CHAIN_COLOURS[(chainIndex ?? 0) % CHAIN_COLOURS.length]!,
  },
];

const byKey = new Map(COLOR_MODES.map((mode) => [mode.key, mode]));

export function colorMode(key: ColorModeKey): ColorMode {
  const mode = byKey.get(key);
  if (mode === undefined) throw new RangeError(`unknown colour mode: ${key}`);
  return mode;
}

export interface ColorInput {
  readonly sequence: string;
  readonly secondaryStructure: string;
  readonly bFactors?: ArrayLike<number>;
  readonly accessibility?: ArrayLike<number>;
  readonly chainOf?: ArrayLike<number>;
}

/**
 * Colour every residue, as a flat RGB array ready for a vertex attribute.
 */
export function colorResidues(key: ColorModeKey, input: ColorInput): Float32Array {
  const mode = colorMode(key);
  const residues = input.sequence.length;
  const flexibility = input.bFactors === undefined ? undefined : normalise(input.bFactors);
  const out = new Float32Array(residues * 3);

  for (let index = 0; index < residues; index++) {
    const [r, g, b] = mode.color({
      index,
      residues,
      code: input.sequence[index] ?? "X",
      secondaryStructure: input.secondaryStructure,
      ...(flexibility === undefined ? {} : { flexibility: flexibility[index]! }),
      ...(input.accessibility === undefined ? {} : { accessibility: input.accessibility[index]! }),
      ...(input.chainOf === undefined ? {} : { chainIndex: input.chainOf[index]! }),
    });
    out[index * 3] = r;
    out[index * 3 + 1] = g;
    out[index * 3 + 2] = b;
  }
  return out;
}

/** Spread a per-residue colour array onto the ribbon's vertices. */
export function colorVertices(
  residueColors: ArrayLike<number>,
  residueOf: ArrayLike<number>,
): Float32Array {
  const out = new Float32Array(residueOf.length * 3);
  for (let vertex = 0; vertex < residueOf.length; vertex++) {
    const residue = residueOf[vertex]!;
    out[vertex * 3] = residueColors[residue * 3]!;
    out[vertex * 3 + 1] = residueColors[residue * 3 + 1]!;
    out[vertex * 3 + 2] = residueColors[residue * 3 + 2]!;
  }
  return out;
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
