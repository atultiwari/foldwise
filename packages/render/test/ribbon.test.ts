import { describe, expect, it } from "vitest";

import { boundingSphere, damp, fitDistance, needsReframe } from "../src/camera.js";
import { PROFILE_POINTS, arrowProgress, profileAt, shapeOf } from "../src/profile.js";
import { buildRibbon, updateRibbon } from "../src/ribbon.js";
import { catmullRom, normalise, ribbonFrames, sampleCurve } from "../src/spline.js";
import { loadReference, type ReferenceCase } from "../../core/test/fixtures/load.js";

const reference = loadReference();
const ubiquitin = reference.cases.find((c) => c.pdbId === "1UBI")!;
const mpro = reference.cases.find((c) => c.pdbId === "7VH8")!;

const caOf = (c: ReferenceCase) => c.coords["ca"]!;

describe("catmullRom", () => {
  it("passes through its control points", () => {
    expect(catmullRom(0, 10, 20, 30, 0)).toBeCloseTo(10, 10);
    expect(catmullRom(0, 10, 20, 30, 1)).toBeCloseTo(20, 10);
  });

  it("interpolates evenly spaced points linearly", () => {
    expect(catmullRom(0, 10, 20, 30, 0.5)).toBeCloseTo(15, 10);
  });

  it("stays within a sensible range on a sharp turn", () => {
    // Overshoot is the classic Catmull-Rom failure and shows up as a spike on
    // the ribbon at tight corners.
    for (let t = 0; t <= 1; t += 0.05) {
      const value = catmullRom(0, 0, 10, 10, t);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(11);
    }
  });
});

describe("ribbonFrames", () => {
  const residues = ubiquitin.seq.length;
  const frames = ribbonFrames(caOf(ubiquitin), residues);

  it("produces unit vectors everywhere", () => {
    for (let i = 0; i < residues; i++) {
      for (const field of [frames.tangents, frames.widths, frames.normals]) {
        expect(Math.hypot(field[i * 3]!, field[i * 3 + 1]!, field[i * 3 + 2]!)).toBeCloseTo(1, 6);
      }
    }
  });

  it("keeps the three axes mutually perpendicular", () => {
    for (let i = 0; i < residues; i++) {
      const t = [frames.tangents[i * 3]!, frames.tangents[i * 3 + 1]!, frames.tangents[i * 3 + 2]!];
      const w = [frames.widths[i * 3]!, frames.widths[i * 3 + 1]!, frames.widths[i * 3 + 2]!];
      const n = [frames.normals[i * 3]!, frames.normals[i * 3 + 1]!, frames.normals[i * 3 + 2]!];
      expect(Math.abs(t[0]! * w[0]! + t[1]! * w[1]! + t[2]! * w[2]!)).toBeLessThan(1e-6);
      expect(Math.abs(t[0]! * n[0]! + t[1]! * n[1]! + t[2]! * n[2]!)).toBeLessThan(1e-6);
    }
  });

  it("never flips the ribbon over between neighbours", () => {
    // Curvature reverses constantly in a beta sheet. Recomputing the frame
    // from scratch at each residue makes the face flip 180 degrees when it
    // does, which reads as the ribbon tearing.
    for (let i = 1; i < residues; i++) {
      const previous = [frames.widths[(i - 1) * 3]!, frames.widths[(i - 1) * 3 + 1]!, frames.widths[(i - 1) * 3 + 2]!];
      const current = [frames.widths[i * 3]!, frames.widths[i * 3 + 1]!, frames.widths[i * 3 + 2]!];
      const alignment = previous[0]! * current[0]! + previous[1]! * current[1]! + previous[2]! * current[2]!;
      expect(alignment).toBeGreaterThan(-0.2);
    }
  });

  it("survives a perfectly straight chain", () => {
    // Zero curvature leaves the width direction undefined; it must be carried
    // forward rather than chosen afresh.
    const straight = Float64Array.from({ length: 30 }, (_, i) => (i % 3 === 0 ? (i / 3) * 3.8 : 0));
    const flat = ribbonFrames(straight, 10);
    for (let i = 0; i < 10; i++) {
      const length = Math.hypot(flat.widths[i * 3]!, flat.widths[i * 3 + 1]!, flat.widths[i * 3 + 2]!);
      expect(length).toBeCloseTo(1, 6);
    }
  });
});

describe("sampleCurve", () => {
  it("produces one sample per subdivision plus the final point", () => {
    const residues = ubiquitin.seq.length;
    const curve = sampleCurve(caOf(ubiquitin), residues, ribbonFrames(caOf(ubiquitin), residues), 4);
    expect(curve.count).toBe((residues - 1) * 4 + 1);
  });

  it("starts and ends on real alpha carbons", () => {
    const residues = ubiquitin.seq.length;
    const ca = caOf(ubiquitin);
    const curve = sampleCurve(ca, residues, ribbonFrames(ca, residues), 4);
    for (let axis = 0; axis < 3; axis++) {
      expect(curve.positions[axis]!).toBeCloseTo(ca[axis]!, 6);
      expect(curve.positions[(curve.count - 1) * 3 + axis]!).toBeCloseTo(
        ca[(residues - 1) * 3 + axis]!, 6,
      );
    }
  });

  it("keeps interpolated frames orthonormal", () => {
    const residues = ubiquitin.seq.length;
    const ca = caOf(ubiquitin);
    const curve = sampleCurve(ca, residues, ribbonFrames(ca, residues), 6);
    for (let i = 0; i < curve.count; i++) {
      const w = [curve.widths[i * 3]!, curve.widths[i * 3 + 1]!, curve.widths[i * 3 + 2]!];
      const n = [curve.normals[i * 3]!, curve.normals[i * 3 + 1]!, curve.normals[i * 3 + 2]!];
      expect(Math.hypot(...w)).toBeCloseTo(1, 6);
      expect(Math.hypot(...n)).toBeCloseTo(1, 6);
      expect(Math.abs(w[0]! * n[0]! + w[1]! * n[1]! + w[2]! * n[2]!)).toBeLessThan(1e-6);
    }
  });

  it("handles a single-residue chain without dividing by zero", () => {
    const curve = sampleCurve([1, 2, 3], 1, ribbonFrames([1, 2, 3], 1), 4);
    expect(curve.count).toBe(1);
    expect(Number.isFinite(curve.positions[0]!)).toBe(true);
  });
});

describe("profiles", () => {
  it("maps DSSP's eight states onto three shapes", () => {
    expect(["H", "G", "I"].map(shapeOf)).toEqual(["helix", "helix", "helix"]);
    expect(["E", "B"].map(shapeOf)).toEqual(["strand", "strand"]);
    expect(["T", "S", "C"].map(shapeOf)).toEqual(["coil", "coil", "coil"]);
  });

  it("gives every shape the same vertex count", () => {
    // Consecutive cross-sections are stitched directly, so a mismatch at a
    // helix-to-loop junction would tear the mesh.
    for (const shape of ["helix", "strand", "coil"] as const) {
      expect(profileAt(shape).points.length).toBe(PROFILE_POINTS * 2);
    }
    expect(profileAt("strand", 0.4).points.length).toBe(PROFILE_POINTS * 2);
  });

  it("widens the strand into an arrowhead and then closes it to a point", () => {
    const widthOf = (arrow: number) =>
      Math.max(...profileAt("strand", arrow).points.filter((_, i) => i % 2 === 0));
    expect(widthOf(0.5)).toBeGreaterThan(widthOf(0));
    expect(widthOf(1)).toBeLessThan(widthOf(0.5));
    expect(widthOf(1)).toBeLessThan(0.05);
  });

  it("puts an arrowhead only on the last residue of each strand", () => {
    const arrows = arrowProgress("CCEEEECCEEECC");
    expect(Array.from(arrows)).toEqual([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0]);
  });

  it("puts an arrowhead on a strand that runs to the chain end", () => {
    expect(Array.from(arrowProgress("CCEEE"))).toEqual([0, 0, 0, 0, 1]);
  });
});

describe("buildRibbon", () => {
  const residues = ubiquitin.seq.length;
  const geometry = buildRibbon(caOf(ubiquitin), ubiquitin.ss, { subdivisions: 6 });

  it("builds a closed mesh with the expected vertex count", () => {
    const samples = (residues - 1) * 6 + 1;
    expect(geometry.vertexCount).toBe(samples * PROFILE_POINTS);
    expect(geometry.positions.length).toBe(geometry.vertexCount * 3);
    expect(geometry.indices.length).toBe((samples - 1) * PROFILE_POINTS * 6);
  });

  it("references only vertices that exist", () => {
    for (const index of geometry.indices) {
      expect(index).toBeLessThan(geometry.vertexCount);
    }
  });

  it("produces no degenerate triangles", () => {
    for (let i = 0; i < geometry.indices.length; i += 3) {
      const [a, b, c] = [geometry.indices[i]!, geometry.indices[i + 1]!, geometry.indices[i + 2]!];
      expect(a === b || b === c || a === c).toBe(false);
    }
  });

  it("produces finite positions and unit normals", () => {
    for (let v = 0; v < geometry.vertexCount; v++) {
      expect(Number.isFinite(geometry.positions[v * 3]!)).toBe(true);
      const length = Math.hypot(
        geometry.normals[v * 3]!, geometry.normals[v * 3 + 1]!, geometry.normals[v * 3 + 2]!,
      );
      expect(length).toBeCloseTo(1, 4);
    }
  });

  it("assigns every vertex to a real residue", () => {
    for (const residue of geometry.residueOf) {
      expect(residue).toBeLessThan(residues);
    }
    expect(Math.max(...geometry.residueOf)).toBe(residues - 1);
  });

  it("stays close to the backbone it was built from", () => {
    // Every ribbon vertex should sit within a profile's reach of some alpha
    // carbon. A vertex further out means the frame or the spline has gone awry.
    const ca = caOf(ubiquitin);
    for (let v = 0; v < geometry.vertexCount; v += 7) {
      let nearest = Infinity;
      for (let r = 0; r < residues; r++) {
        nearest = Math.min(nearest, Math.hypot(
          geometry.positions[v * 3]! - ca[r * 3]!,
          geometry.positions[v * 3 + 1]! - ca[r * 3 + 1]!,
          geometry.positions[v * 3 + 2]! - ca[r * 3 + 2]!,
        ));
      }
      expect(nearest).toBeLessThan(4);
    }
  });

  it("rejects a mismatched chain", () => {
    expect(() => buildRibbon([0, 0, 0], "CC")).toThrow(/2 residues but 1/);
    expect(() => buildRibbon([], "")).toThrow(/empty chain/);
  });
});

describe("updateRibbon", () => {
  it("moves vertices without touching topology", () => {
    const ca = caOf(ubiquitin);
    const geometry = buildRibbon(ca, ubiquitin.ss, { subdivisions: 4 });
    const indicesBefore = Uint32Array.from(geometry.indices);
    const positionsBefore = Float32Array.from(geometry.positions);

    const shifted = Float64Array.from(ca, (v, i) => (i % 3 === 0 ? v + 25 : v));
    updateRibbon(geometry, shifted, ubiquitin.ss);

    expect(Array.from(geometry.indices)).toEqual(Array.from(indicesBefore));
    expect(geometry.positions[0]!).toBeCloseTo(positionsBefore[0]! + 25, 3);
  });

  it("handles a whole trajectory-sized structure quickly", () => {
    const ca = caOf(mpro);
    const geometry = buildRibbon(ca, mpro.ss, { subdivisions: 6 });
    const start = performance.now();
    for (let i = 0; i < 20; i++) updateRibbon(geometry, ca, mpro.ss);
    const perUpdate = (performance.now() - start) / 20;
    // 306 residues at 60 fps leaves 16 ms for everything; the ribbon rebuild
    // must be a small fraction of that.
    expect(perUpdate).toBeLessThan(8);
  });
});

describe("camera", () => {
  it("finds a bounding sphere that contains every point", () => {
    const ca = caOf(ubiquitin);
    const { centre, radius } = boundingSphere(ca);
    for (let i = 0; i < ca.length; i += 3) {
      const d = Math.hypot(ca[i]! - centre[0], ca[i + 1]! - centre[1], ca[i + 2]! - centre[2]);
      expect(d).toBeLessThanOrEqual(radius + 1e-9);
    }
  });

  it("pulls back further for a wider molecule", () => {
    expect(fitDistance(40, 45, 1.6)).toBeGreaterThan(fitDistance(20, 45, 1.6));
  });

  it("pulls back further on a narrow viewport than a wide one", () => {
    // A portrait phone is the limiting case; fitting to the vertical field of
    // view alone would crop the molecule sideways.
    expect(fitDistance(20, 45, 0.5)).toBeGreaterThan(fitDistance(20, 45, 2));
  });

  it("damps at the same rate whatever the frame rate", () => {
    // Sixty small steps and thirty larger ones covering the same second must
    // arrive at the same place, or the camera moves at different speeds on
    // different displays.
    let fast = 0;
    for (let i = 0; i < 60; i++) fast = damp(fast, 100, 0.2, 1 / 60);
    let slow = 0;
    for (let i = 0; i < 30; i++) slow = damp(slow, 100, 0.2, 1 / 30);
    expect(fast).toBeCloseTo(slow, 3);
  });

  it("snaps immediately when smoothing is zero", () => {
    expect(damp(0, 100, 0, 1 / 60)).toBe(100);
  });

  it("re-frames for a large change and ignores a small one", () => {
    const base = { centre: [0, 0, 0] as const, radius: 20 };
    expect(needsReframe(base, { centre: [0, 0, 0], radius: 60 })).toBe(true);
    expect(needsReframe(base, { centre: [0, 0, 0], radius: 20.5 })).toBe(false);
    expect(needsReframe(base, { centre: [10, 0, 0], radius: 20 })).toBe(true);
  });
});

describe("normalise", () => {
  it("returns null rather than NaN for a zero-length vector", () => {
    expect(normalise([0, 0, 0])).toBeNull();
  });
});
