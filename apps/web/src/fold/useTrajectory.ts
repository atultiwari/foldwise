/**
 * Generating a folding trajectory without freezing the page.
 *
 * A 306-residue protein takes the better part of a second, so it happens in a
 * worker and the frames come back as transferred buffers. The native state is
 * shown immediately, and the animation becomes available when it is ready --
 * rather than the interface blocking on it.
 */

import { useEffect, useRef, useState } from "react";

import { chainSpreads, type BuildRequest, type WorkerResponse } from "@foldwise/fold";
import { isFoldable, type Structure } from "@foldwise/ui";

export interface ChainTrajectory {
  readonly frames: number;
  readonly residues: number;
  readonly positions: Float32Array;
}

export type TrajectoryStatus = "idle" | "building" | "ready" | "static" | "failed";

export interface TrajectoryState {
  readonly status: TrajectoryStatus;
  readonly chains: readonly ChainTrajectory[];
  readonly frames: number;
  readonly error?: string;
}

const IDLE: TrajectoryState = { status: "idle", chains: [], frames: 1 };

export function useTrajectory(structure: Structure | null): TrajectoryState {
  const [state, setState] = useState<TrajectoryState>(IDLE);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (structure === null || worker === null) {
      setState(IDLE);
      return;
    }

    if (!isFoldable(structure)) {
      // Too large to animate. The native state is still fully explorable, and
      // the interface says why rather than silently offering a dead timeline.
      setState({ status: "static", chains: [], frames: 1 });
      return;
    }

    setState({ status: "building", chains: [], frames: 1 });

    // Each chain folds independently. A request token guards against a slow
    // build for a structure the user has already navigated away from
    // overwriting the one they are now looking at.
    const token = `${structure.id}:${Date.now()}`;

    // Slotted by chain index, never appended. Worker replies arrive in
    // whatever order the chains happen to finish, and haemoglobin's are 141,
    // 146, 141 and 146 residues long -- so collecting them in arrival order
    // hands a 146-residue trajectory to a 141-residue chain, which reads off
    // the end of the array and fills the geometry with NaN.
    const collected: (ChainTrajectory | undefined)[] = new Array(structure.chains.length);
    let received = 0;
    let cancelled = false;

    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (cancelled || !message.requestId.startsWith(token)) return;

      if (message.type === "error") {
        setState({ status: "failed", chains: [], frames: 1, error: message.message });
        return;
      }

      const index = Number(message.requestId.split("#")[1]);
      if (!Number.isInteger(index) || collected[index] !== undefined) return;

      collected[index] = {
        frames: message.frames,
        residues: message.residues,
        positions: message.positions,
      };
      received += 1;

      if (received === structure.chains.length) {
        const chains = collected.filter((c): c is ChainTrajectory => c !== undefined);
        setState({
          status: "ready",
          chains,
          frames: Math.max(...chains.map((c) => c.frames)),
        });
      }
    };

    worker.addEventListener("message", onMessage);

    // Computed across all chains at once: each needs to know where the others
    // are, or they all start at the origin and interpenetrate.
    const spreads = chainSpreads(structure.chains.map((chain) => chain.ca));

    structure.chains.forEach((chain, index) => {
      const request: BuildRequest = {
        type: "build",
        requestId: `${token}#${index}`,
        input: {
          id: `${structure.id}:${chain.id}`,
          native: chain.ca,
          secondaryStructure: chain.ss,
          spread: spreads[index]!,
        },
      };
      worker.postMessage(request);
    });

    return () => {
      cancelled = true;
      worker.removeEventListener("message", onMessage);
    };
  }, [structure]);

  return state;
}

/** Coordinates for one chain at a point on the timeline. */
export function frameOf(
  trajectory: ChainTrajectory, progress: number,
): Float32Array {
  const index = Math.max(0, Math.min(
    trajectory.frames - 1, Math.round(progress * (trajectory.frames - 1)),
  ));
  const stride = trajectory.residues * 3;
  return trajectory.positions.subarray(index * stride, (index + 1) * stride);
}
