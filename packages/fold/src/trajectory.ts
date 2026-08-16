/**
 * Building a whole folding trajectory.
 *
 * Frames are generated in sequence, each starting from the one before it. That
 * continuity is what makes the animation read as a single chain moving rather
 * than a series of independently solved poses.
 */

import { radiusOfGyration, superposedRmsd, type Coords } from "@foldwise/core";

import { generateCoil } from "./coil.js";
import { bondLengthsOf, minimumNonBondedDistance } from "./constraints.js";
import { formationAt, foldingOnsets } from "./onset.js";
import { blendTarget, steerToward } from "./morph.js";
import { hashString } from "./random.js";
import { NO_SPREAD, spreadFactor, type ChainSpread } from "./spread.js";

/** Frames for a small protein. Enough that scrubbing feels continuous. */
export const BASE_FRAMES = 96;

/** Frames above `LARGE_PROTEIN`. Big chains move further and need finer steps. */
export const LARGE_FRAMES = 192;
export const LARGE_PROTEIN = 150;

/**
 * Above this many residues, generating a trajectory costs more than it is
 * worth and the structure is shown in its native state only.
 */
export const MAX_FOLDABLE_RESIDUES = 700;

export interface TrajectoryInput {
  /** Stable identifier; seeds the coil so the same protein always starts alike. */
  readonly id: string;
  /** Native alpha-carbon coordinates, flat. */
  readonly native: Coords;
  /** DSSP string, one character per residue. */
  readonly secondaryStructure: string;
  /** Chain index per residue, for multi-chain structures. */
  readonly chainOf?: ArrayLike<number>;
  readonly frames?: number;
  /**
   * Holds this chain away from the rest of its complex while unfolded.
   *
   * Computed across all chains by `chainSpreads`; without it the chains of a
   * multi-chain structure all start at the origin and interpenetrate.
   */
  readonly spread?: ChainSpread;
}

export interface Trajectory {
  readonly id: string;
  readonly frames: number;
  readonly residues: number;
  /** All frames end to end: frame f starts at `f * residues * 3`. */
  readonly positions: Float32Array;
  /** How folded each residue is, per frame. */
  readonly formation: Float32Array;
  /** Each residue's folding time on the timeline. */
  readonly onsets: Float64Array;
  readonly targetRg: number;
  readonly coilRg: number;
  readonly nativeRg: number;
  /** Closest non-bonded approach in the native structure, angstrom. */
  readonly clashFloor: number;
}

export function frameCountFor(residues: number): number {
  return residues > LARGE_PROTEIN ? LARGE_FRAMES : BASE_FRAMES;
}

export function isFoldable(residues: number): boolean {
  return residues > 0 && residues <= MAX_FOLDABLE_RESIDUES;
}

/** Read frame `index` without copying. */
export function frameAt(trajectory: Trajectory, index: number): Float32Array {
  const clamped = Math.max(0, Math.min(trajectory.frames - 1, Math.round(index)));
  const stride = trajectory.residues * 3;
  return trajectory.positions.subarray(clamped * stride, (clamped + 1) * stride);
}

export function formationOfFrame(trajectory: Trajectory, index: number): Float32Array {
  const clamped = Math.max(0, Math.min(trajectory.frames - 1, Math.round(index)));
  return trajectory.formation.subarray(
    clamped * trajectory.residues,
    (clamped + 1) * trajectory.residues,
  );
}

export function buildTrajectory(input: TrajectoryInput): Trajectory {
  const residues = input.secondaryStructure.length;
  if (residues === 0) throw new RangeError("cannot build a trajectory for an empty chain");
  if (input.native.length !== residues * 3) {
    throw new RangeError(
      `secondary structure has ${residues} residues but ${input.native.length / 3} coordinates were given`,
    );
  }

  const frames = input.frames ?? frameCountFor(residues);
  const stride = residues * 3;
  const bondLengths = bondLengthsOf(input.native, residues);
  const nativeRg = radiusOfGyration(input.native);

  const seed = hashString(input.id);
  const coil = generateCoil(residues, bondLengths, seed, nativeRg);

  // The native structure is the one packing we know is possible, so it sets
  // the floor on how close the animation may bring two residues.
  const clashFloor = minimumNonBondedDistance(input.native, residues);
  const onsets = foldingOnsets(
    input.native,
    input.secondaryStructure,
    input.chainOf === undefined ? {} : { chainOf: input.chainOf },
  );

  const positions = new Float32Array(frames * stride);
  const formationBuffer = new Float32Array(frames * residues);

  // The running conformation, carried from frame to frame.
  const current = Float64Array.from(coil.coords);

  for (let frame = 0; frame < frames; frame++) {
    const progress = frames > 1 ? frame / (frames - 1) : 1;
    const formation = formationAt(onsets, progress);

    // A rigid translation applied after the chain's geometry is settled, so it
    // cannot disturb a bond length. Zero by SPREAD_END, and therefore zero on
    // the final frame.
    const spread = input.spread ?? NO_SPREAD;
    const push = spreadFactor(progress) * spread.distance;

    if (frame === frames - 1) {
      // The last frame is the deposited structure, exactly. Steering gets very
      // close but "very close" is not what the app promises about the native
      // state, and a residual of even 0.05 A would be a claim we cannot make.
      current.set(input.native as ArrayLike<number> as Float64Array);
      for (let i = 0; i < residues; i++) formation[i] = 1;
    } else if (frame > 0) {
      const target = blendTarget(coil.coords, input.native, formation, residues);
      steerToward(current, target, residues, bondLengths, clashFloor);
    }

    if (push > 0) {
      for (let i = 0; i < residues; i++) {
        positions[frame * stride + i * 3] = current[i * 3]! + spread.direction[0]! * push;
        positions[frame * stride + i * 3 + 1] = current[i * 3 + 1]! + spread.direction[1]! * push;
        positions[frame * stride + i * 3 + 2] = current[i * 3 + 2]! + spread.direction[2]! * push;
      }
    } else {
      positions.set(current, frame * stride);
    }
    formationBuffer.set(formation, frame * residues);
  }

  return {
    id: input.id,
    frames,
    residues,
    positions,
    formation: formationBuffer,
    onsets,
    targetRg: coil.targetRg,
    coilRg: coil.actualRg,
    nativeRg,
    clashFloor,
  };
}

/** RMSD of each frame against the native structure -- the folding progress curve. */
export function rmsdCurve(trajectory: Trajectory, native: Coords): Float64Array {
  const curve = new Float64Array(trajectory.frames);
  for (let frame = 0; frame < trajectory.frames; frame++) {
    curve[frame] = superposedRmsd(frameAt(trajectory, frame), native);
  }
  return curve;
}
