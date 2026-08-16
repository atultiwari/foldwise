/**
 * Pure logic for the application shell: URL state, chart geometry, and the
 * structure schema. No React, no DOM, no three.js.
 */

export {
  COLOR_MODE_KEYS, DEFAULT_VIEW, MODES, MODE_PRESETS, REPRESENTATIONS,
  applyPreset, decodeView, encodeView, presetFor, viewStateSchema,
} from "./urlState.js";
export type { ColorModeKey, Mode, ModePreset, Representation, ViewState } from "./urlState.js";

export { areaPath, donutArc, extentOf, runsOf, sparklinePath, ticks } from "./charts.js";
export type { Band, Extent, SparklineOptions } from "./charts.js";

export {
  chainIndices, coverage, flatten, globalIndex, isFoldable, parseStructure,
  residueCount, structureSchema, unobservedResidues,
} from "./structure.js";
export type { Chain, FlatStructure, Structure } from "./structure.js";
