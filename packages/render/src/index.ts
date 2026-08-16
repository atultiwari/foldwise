/**
 * Geometry and colour for the cartoon renderer.
 *
 * Everything here is three.js-free and testable without a graphics context:
 * the mesh is built as plain typed arrays, and the colour modes are pure
 * functions of one residue's properties.
 */

export { DEFAULT_SUBDIVISIONS, catmullRom, cross, dot, normalise, reject, ribbonFrames, sampleCurve } from "./spline.js";
export type { RibbonFrames, SampledCurve } from "./spline.js";

export {
  ARROW_WIDTH, HELIX_THICKNESS, HELIX_WIDTH, PROFILE_POINTS,
  STRAND_THICKNESS, STRAND_WIDTH, TUBE_RADIUS,
  arrowProgress, profileAt, shapeOf,
} from "./profile.js";
export type { Profile, SecondaryStructure } from "./profile.js";

export { buildRibbon, updateRibbon } from "./ribbon.js";
export type { RibbonGeometry, RibbonOptions } from "./ribbon.js";

export {
  CHAIN_COLOURS, CORE, DIRECTION_RAMP, HYDROPHILIC, HYDROPHOBIC, NEGATIVE, NEUTRAL,
  POSITIVE, STRUCTURE_COLOURS, SURFACE,
  hexToRgb, luminance, mix, perceptualDistance, rampAt, rgbToHex, simulate,
} from "./palette.js";
export type { Deficiency, Rgb } from "./palette.js";

export { COLOR_MODES, colorMode, colorResidues, colorVertices } from "./colorModes.js";
export type { ColorInput, ColorMode, ColorModeKey, ResidueContext } from "./colorModes.js";

export { boundingSphere, damp, fitDistance, needsReframe } from "./camera.js";
export type { Bounds } from "./camera.js";

export { Stage } from "./stage.js";
export type { ChainView, StageOptions } from "./stage.js";
