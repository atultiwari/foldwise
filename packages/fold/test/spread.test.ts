import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { superposedRmsd } from "@foldwise/core";

import { SPREAD_END, chainSpreads, spreadFactor } from "../src/spread.js";
import { buildTrajectory, frameAt } from "../src/trajectory.js";

interface Chain { id: string; seq: string; ss: string; ca: number[] }
const haemoglobin = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../data/structures/hba-deoxy.json", import.meta.url)),
    "utf8",
  ),
) as { chains: Chain[] };

function closestBetweenChains(frames: readonly Float32Array[]): number {
  let closest = Infinity;
  for (let a = 0; a < frames.length; a++) {
    for (let b = a + 1; b < frames.length; b++) {
      for (let i = 0; i < frames[a]!.length; i += 3) {
        for (let j = 0; j < frames[b]!.length; j += 3) {
          const d = Math.hypot(
            frames[a]![i]! - frames[b]![j]!,
            frames[a]![i + 1]! - frames[b]![j + 1]!,
            frames[a]![i + 2]! - frames[b]![j + 2]!,
          );
          if (d < closest) closest = d;
        }
      }
    }
  }
  return closest;
}

describe("spreadFactor", () => {
  it("is full at the start and exactly zero by the native state", () => {
    expect(spreadFactor(0)).toBeCloseTo(1, 6);
    expect(spreadFactor(SPREAD_END)).toBe(0);
    expect(spreadFactor(1)).toBe(0);
  });

  it("decreases all the way", () => {
    let previous = Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const value = spreadFactor(t);
      expect(value).toBeLessThanOrEqual(previous + 1e-9);
      previous = value;
    }
  });
});

describe("chainSpreads", () => {
  it("does nothing for a single chain", () => {
    expect(chainSpreads([[0, 0, 0]])[0]!.distance).toBe(0);
  });

  it("points each chain away from the complex's centre", () => {
    // Two chains either side of the origin must be pushed in opposite ways.
    const spreads = chainSpreads([[-10, 0, 0, -10, 1, 0], [10, 0, 0, 10, 1, 0]]);
    expect(spreads[0]!.direction[0]).toBeLessThan(0);
    expect(spreads[1]!.direction[0]).toBeGreaterThan(0);
  });

  it("separates chains that share a centre", () => {
    // A symmetric arrangement gives no natural direction; the fallback must
    // still produce distinct, unit-length directions.
    const same = [0, 0, 0, 0, 0, 0];
    const spreads = chainSpreads([same, same, same]);
    for (const spread of spreads) {
      expect(Math.hypot(...spread.direction)).toBeCloseTo(1, 6);
    }
    expect(spreads[0]!.direction).not.toEqual(spreads[1]!.direction);
  });

  it("is deterministic", () => {
    const natives = [[-5, 0, 0], [5, 0, 0]];
    expect(chainSpreads(natives)).toEqual(chainSpreads(natives));
  });
});

/**
 * The regression this whole module exists for.
 *
 * Before it, haemoglobin's four chains each began their walk at the origin and
 * the closest approach between them at frame zero was 0.00 Å — four chains
 * drawn passing through one another.
 */
describe("multi-chain trajectories", () => {
  const natives = haemoglobin.chains.map((c) => c.ca);
  const spreads = chainSpreads(natives);
  const trajectories = haemoglobin.chains.map((chain, index) =>
    buildTrajectory({
      id: `hba:${chain.id}`,
      native: chain.ca,
      secondaryStructure: chain.ss,
      frames: 24,
      spread: spreads[index]!,
    }),
  );

  it("keeps unfolded chains from passing through each other", () => {
    const frame0 = trajectories.map((t) => frameAt(t, 0));
    expect(closestBetweenChains(frame0)).toBeGreaterThan(4);
  });

  it("brings them together by the end", () => {
    const first = closestBetweenChains(trajectories.map((t) => frameAt(t, 0)));
    const last = closestBetweenChains(trajectories.map((t) => frameAt(t, t.frames - 1)));
    expect(last).toBeLessThan(first);
  });

  it("still lands each chain exactly on its deposited coordinates", () => {
    // The spread is a rigid translation that must decay to nothing, or the
    // final frame is no longer the structure it claims to be.
    trajectories.forEach((trajectory, index) => {
      const final = frameAt(trajectory, trajectory.frames - 1);
      expect(superposedRmsd(final, natives[index]!)).toBeLessThan(1e-4);
      // Not merely the same shape — the same place.
      expect(final[0]!).toBeCloseTo(natives[index]![0]!, 3);
    });
  });
});
