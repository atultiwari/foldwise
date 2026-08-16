import { describe, expect, it } from "vitest";

import { denaturedRadiusOfGyration, radiusOfGyration, superposedRmsd } from "@foldwise/core";

import { bondLengthsOf } from "../src/constraints.js";
import { buildTrajectory, frameAt, frameCountFor, isFoldable, rmsdCurve } from "../src/trajectory.js";
import { loadReference, type ReferenceCase } from "../../core/test/fixtures/load.js";

const reference = loadReference();
const ubiquitin = reference.cases.find((c) => c.pdbId === "1UBI")!;
const mpro = reference.cases.find((c) => c.pdbId === "7VH8")!;

function build(testCase: ReferenceCase, frames?: number) {
  return buildTrajectory({
    id: testCase.pdbId,
    native: testCase.coords["ca"]!,
    secondaryStructure: testCase.ss,
    ...(frames === undefined ? {} : { frames }),
  });
}

/** Worst bond-length error across every bond of every frame, in angstrom. */
function worstBondError(trajectory: ReturnType<typeof build>, native: ArrayLike<number>): number {
  const expected = bondLengthsOf(native, trajectory.residues);
  let worst = 0;
  for (let frame = 0; frame < trajectory.frames; frame++) {
    const coords = frameAt(trajectory, frame);
    for (let i = 1; i < trajectory.residues; i++) {
      const observed = Math.hypot(
        coords[i * 3]! - coords[(i - 1) * 3]!,
        coords[i * 3 + 1]! - coords[(i - 1) * 3 + 1]!,
        coords[i * 3 + 2]! - coords[(i - 1) * 3 + 2]!,
      );
      worst = Math.max(worst, Math.abs(observed - expected[i]!));
    }
  }
  return worst;
}

/** Closest approach between residues more than two apart, over every frame. */
function closestNonBonded(trajectory: ReturnType<typeof build>): number {
  let closest = Infinity;
  for (let frame = 0; frame < trajectory.frames; frame++) {
    const coords = frameAt(trajectory, frame);
    for (let i = 0; i < trajectory.residues; i++) {
      for (let j = i + 3; j < trajectory.residues; j++) {
        const d = Math.hypot(
          coords[j * 3]! - coords[i * 3]!,
          coords[j * 3 + 1]! - coords[i * 3 + 1]!,
          coords[j * 3 + 2]! - coords[i * 3 + 2]!,
        );
        if (d < closest) closest = d;
      }
    }
  }
  return closest;
}

describe("frame budget", () => {
  it("gives larger proteins more frames", () => {
    expect(frameCountFor(76)).toBe(96);
    expect(frameCountFor(306)).toBe(192);
  });

  it("refuses structures too large to animate", () => {
    expect(isFoldable(306)).toBe(true);
    expect(isFoldable(1148)).toBe(false);
    expect(isFoldable(0)).toBe(false);
  });
});

describe("input validation", () => {
  it("rejects an empty chain", () => {
    expect(() => buildTrajectory({ id: "x", native: [], secondaryStructure: "" })).toThrow(
      /empty chain/,
    );
  });

  it("rejects coordinates that do not match the sequence", () => {
    expect(() =>
      buildTrajectory({ id: "x", native: [0, 0, 0], secondaryStructure: "CC" }),
    ).toThrow(/2 residues but 1 coordinates/);
  });
});

/**
 * These are the promises the interface makes about the animation. They have to
 * hold on every frame, not on a sampled few -- a single frame with a stretched
 * bond is a frame where the app is lying about what a protein can do.
 */
describe.each([
  ["1UBI", ubiquitin],
  ["7VH8", mpro],
])("trajectory invariants: %s", (_name, testCase) => {
  const trajectory = build(testCase, 48);
  const native = testCase.coords["ca"]!;

  it("never stretches a bond", () => {
    expect(worstBondError(trajectory, native)).toBeLessThan(0.01);
  });

  it("never lets two residues pass through each other", () => {
    // The native structure sets the floor: real proteins have non-bonded
    // alpha carbons closer than any arbitrary threshold we might pick, so the
    // animation is allowed to get as close as the answer does, and no closer.
    const nativeFloor = closestNonBonded({
      ...trajectory,
      frames: 1,
      positions: Float32Array.from(native),
    });
    expect(closestNonBonded(trajectory)).toBeGreaterThan(nativeFloor * 0.9);
  });

  it("starts at the size a denatured chain actually is", () => {
    const start = radiusOfGyration(frameAt(trajectory, 0));
    const expected = Math.min(
      denaturedRadiusOfGyration(trajectory.residues),
      3 * trajectory.nativeRg,
    );
    expect(Math.abs(start - expected) / expected).toBeLessThan(0.05);
  });

  it("ends exactly on the deposited structure", () => {
    // "Exactly" is limited by the Float32 buffer the renderer reads, not by
    // the algorithm: coordinates around 50 A quantise at roughly 4e-6 A, so a
    // residual near 1e-6 A is storage precision. A millionth of an angstrom is
    // about a ten-thousandth of an atom.
    const residual = superposedRmsd(frameAt(trajectory, trajectory.frames - 1), native);
    expect(residual).toBeLessThan(1e-4);
  });

  it("gets monotonically closer to the answer, broadly", () => {
    // Not strictly monotonic -- the chain explores on its way -- but the first
    // third must be further out than the last third or nothing is happening.
    const curve = rmsdCurve(trajectory, native);
    const third = Math.floor(curve.length / 3);
    const early = curve.slice(0, third).reduce((s, v) => s + v, 0) / third;
    const late = curve.slice(-third).reduce((s, v) => s + v, 0) / third;
    expect(late).toBeLessThan(early / 2);
  });

  it("produces no NaN or infinite coordinate", () => {
    for (let i = 0; i < trajectory.positions.length; i++) {
      expect(Number.isFinite(trajectory.positions[i]!)).toBe(true);
    }
  });
});

describe("determinism", () => {
  it("gives byte-identical output for the same input", () => {
    const first = build(ubiquitin, 24);
    const second = build(ubiquitin, 24);
    expect(Array.from(second.positions)).toEqual(Array.from(first.positions));
  });

  it("gives a different coil for a different identifier", () => {
    const a = buildTrajectory({
      id: "one", native: ubiquitin.coords["ca"]!, secondaryStructure: ubiquitin.ss, frames: 8,
    });
    const b = buildTrajectory({
      id: "two", native: ubiquitin.coords["ca"]!, secondaryStructure: ubiquitin.ss, frames: 8,
    });
    expect(Array.from(frameAt(b, 0))).not.toEqual(Array.from(frameAt(a, 0)));
  });

  it("still lands on the same native state whatever the seed", () => {
    const a = buildTrajectory({
      id: "one", native: ubiquitin.coords["ca"]!, secondaryStructure: ubiquitin.ss, frames: 8,
    });
    const b = buildTrajectory({
      id: "two", native: ubiquitin.coords["ca"]!, secondaryStructure: ubiquitin.ss, frames: 8,
    });
    expect(Array.from(frameAt(b, 7))).toEqual(Array.from(frameAt(a, 7)));
  });
});

describe("folding schedule", () => {
  const trajectory = build(ubiquitin, 48);

  it("gives every residue a time inside the window", () => {
    for (const onset of trajectory.onsets) {
      expect(onset).toBeGreaterThanOrEqual(0.04);
      expect(onset).toBeLessThanOrEqual(0.82);
    }
  });

  it("spreads residues across the whole window rather than bunching", () => {
    const sorted = [...trajectory.onsets].sort((a, b) => a - b);
    expect(sorted[0]!).toBeCloseTo(0.04, 6);
    expect(sorted.at(-1)!).toBeCloseTo(0.82, 6);
  });

  it("folds the helix before the long-range beta contacts", () => {
    // Ubiquitin's helix is residues 23-34; its terminal strands pair across
    // sixty residues. Local structure first is the entire prediction.
    const helix = mean(trajectory.onsets, 22, 34);
    const longRangeStrand = mean(trajectory.onsets, 65, 72);
    expect(helix).toBeLessThan(longRangeStrand);
  });
});

function mean(values: ArrayLike<number>, from: number, to: number): number {
  let total = 0;
  for (let i = from; i < to; i++) total += values[i]!;
  return total / (to - from);
}
