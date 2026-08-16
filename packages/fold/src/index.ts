/**
 * The folding trajectory engine.
 *
 * Generates the animation between a calibrated unfolded coil and the deposited
 * native structure, with every virtual bond held at its exact native length
 * throughout. See docs/VALIDATION.md for the invariants this guarantees.
 */

export { hashString, randomDirection, rotateAbout, seededRandom } from "./random.js";
export { SpatialHash } from "./spatialHash.js";
export { CLASH_DISTANCE, bondLengthsOf, declash, minimumNonBondedDistance, relaxBonds, snapBonds } from "./constraints.js";
export { generateCoil, selfAvoidingWalk } from "./coil.js";
export type { CoilResult } from "./coil.js";
export { FIRST_ONSET, LAST_ONSET, TRANSITION_WIDTH, foldingOnsets, formationAt } from "./onset.js";
export type { OnsetOptions } from "./onset.js";
export { blendTarget, steerToward } from "./morph.js";
export {
  BASE_FRAMES, LARGE_FRAMES, LARGE_PROTEIN, MAX_FOLDABLE_RESIDUES,
  buildTrajectory, frameAt, frameCountFor, formationOfFrame, isFoldable, rmsdCurve,
} from "./trajectory.js";
export type { Trajectory, TrajectoryInput } from "./trajectory.js";
export { handleRequest, toResponse } from "./worker.js";
export type { BuildRequest, BuildResponse, ErrorResponse, WorkerResponse } from "./worker.js";
