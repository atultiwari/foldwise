/**
 * Trajectory generation off the main thread.
 *
 * A 306-residue protein takes the better part of a second to generate. Doing
 * that on the main thread means the interface freezes on load, and freezes
 * again on every structure the user picks. So it happens here, and the frames
 * come back as transferable buffers -- handed over rather than copied.
 */

import type { ChainSpread } from "./spread.js";
import { buildTrajectory, type Trajectory, type TrajectoryInput } from "./trajectory.js";

export interface BuildRequest {
  readonly type: "build";
  /** Echoed back, so a caller can match replies to requests. */
  readonly requestId: string;
  readonly input: {
    readonly id: string;
    readonly native: Float64Array | number[];
    readonly secondaryStructure: string;
    readonly chainOf?: Int32Array | number[];
    readonly frames?: number;
    readonly spread?: ChainSpread;
  };
}

export interface BuildResponse {
  readonly type: "trajectory";
  readonly requestId: string;
  readonly id: string;
  readonly frames: number;
  readonly residues: number;
  readonly positions: Float32Array;
  readonly formation: Float32Array;
  readonly onsets: Float64Array;
  readonly targetRg: number;
  readonly coilRg: number;
  readonly nativeRg: number;
  readonly clashFloor: number;
}

export interface ErrorResponse {
  readonly type: "error";
  readonly requestId: string;
  readonly message: string;
}

export type WorkerResponse = BuildResponse | ErrorResponse;

/** Turn a trajectory into a message, listing the buffers to hand over. */
export function toResponse(
  requestId: string,
  trajectory: Trajectory,
): { message: BuildResponse; transfer: ArrayBuffer[] } {
  return {
    message: {
      type: "trajectory",
      requestId,
      id: trajectory.id,
      frames: trajectory.frames,
      residues: trajectory.residues,
      positions: trajectory.positions,
      formation: trajectory.formation,
      onsets: trajectory.onsets,
      targetRg: trajectory.targetRg,
      coilRg: trajectory.coilRg,
      nativeRg: trajectory.nativeRg,
      clashFloor: trajectory.clashFloor,
    },
    transfer: [
      trajectory.positions.buffer as ArrayBuffer,
      trajectory.formation.buffer as ArrayBuffer,
      trajectory.onsets.buffer as ArrayBuffer,
    ],
  };
}

export function handleRequest(request: BuildRequest): {
  message: WorkerResponse;
  transfer: ArrayBuffer[];
} {
  try {
    const input: TrajectoryInput = {
      id: request.input.id,
      native: request.input.native,
      secondaryStructure: request.input.secondaryStructure,
      ...(request.input.chainOf === undefined ? {} : { chainOf: request.input.chainOf }),
      ...(request.input.frames === undefined ? {} : { frames: request.input.frames }),
      ...(request.input.spread === undefined ? {} : { spread: request.input.spread }),
    };
    return toResponse(request.requestId, buildTrajectory(input));
  } catch (error: unknown) {
    return {
      message: {
        type: "error",
        requestId: request.requestId,
        message: error instanceof Error ? error.message : "trajectory generation failed",
      },
      transfer: [],
    };
  }
}

// Only wire up the message handler when actually running as a worker, so this
// module stays importable (and testable) from the main thread.
declare const self: DedicatedWorkerGlobalScope | undefined;

if (typeof self !== "undefined" && typeof self.postMessage === "function") {
  self.addEventListener("message", (event: MessageEvent<BuildRequest>) => {
    if (event.data?.type !== "build") return;
    const { message, transfer } = handleRequest(event.data);
    self.postMessage(message, { transfer });
  });
}
