import { describe, expect, it } from "vitest";

import {
  ATOM_RADIUS, BOND_RADIUS, MAX_BOND_LENGTH,
  atomMatrices, bondMatrices, transformPoint,
} from "../src/instanced.js";
import { DEFAULT_PICK_RADIUS, multiply, pickResidue, project } from "../src/picking.js";
import { buildSurface } from "../src/surface.js";
import { loadReference } from "../../core/test/fixtures/load.js";

const ubiquitin = loadReference().cases.find((c) => c.pdbId === "1UBI")!;

describe("atomMatrices", () => {
  it("places one uniformly scaled sphere per residue", () => {
    const matrices = atomMatrices([1, 2, 3, 4, 5, 6], 2);
    expect(matrices.length).toBe(32);
    expect([matrices[0], matrices[5], matrices[10]]).toEqual([2, 2, 2]);
    expect([matrices[12], matrices[13], matrices[14]]).toEqual([1, 2, 3]);
    expect([matrices[28], matrices[29], matrices[30]]).toEqual([4, 5, 6]);
  });

  it("puts the sphere's centre on the alpha carbon", () => {
    const ca = ubiquitin.coords["ca"]!;
    const matrices = atomMatrices(ca);
    for (let i = 0; i < 10; i++) {
      const centre = transformPoint(matrices, i * 16, 0, 0, 0);
      expect(centre[0]).toBeCloseTo(ca[i * 3]!, 5);
      expect(centre[1]).toBeCloseTo(ca[i * 3 + 1]!, 5);
      expect(centre[2]).toBeCloseTo(ca[i * 3 + 2]!, 5);
    }
  });

  it("scales a unit sphere to the requested radius", () => {
    const matrices = atomMatrices([0, 0, 0], ATOM_RADIUS);
    const edge = transformPoint(matrices, 0, 1, 0, 0);
    expect(Math.hypot(...edge)).toBeCloseTo(ATOM_RADIUS, 6);
  });
});

describe("bondMatrices", () => {
  it("puts a cylinder between each bonded pair", () => {
    const ca = [0, 0, 0, 3.8, 0, 0, 7.6, 0, 0];
    const bonds = bondMatrices(ca, 3);
    expect(bonds.count).toBe(2);
    expect(Array.from(bonds.residueOf.slice(0, 2))).toEqual([0, 1]);
  });

  it("spans exactly from one alpha carbon to the next", () => {
    // The unit cylinder runs -0.5 to +0.5 along Y, so its ends must land on
    // the two residues. Getting this wrong leaves visible gaps at every joint.
    const ca = ubiquitin.coords["ca"]!;
    const bonds = bondMatrices(ca, ubiquitin.seq.length);
    for (let b = 0; b < Math.min(20, bonds.count); b++) {
      const residue = bonds.residueOf[b]!;
      const start = transformPoint(bonds.matrices, b * 16, 0, -0.5, 0);
      const end = transformPoint(bonds.matrices, b * 16, 0, 0.5, 0);
      for (let axis = 0; axis < 3; axis++) {
        expect(start[axis]).toBeCloseTo(ca[residue * 3 + axis]!, 4);
        expect(end[axis]).toBeCloseTo(ca[(residue + 1) * 3 + axis]!, 4);
      }
    }
  });

  it("keeps the cylinder's cross-section circular", () => {
    // Within MAX_BOND_LENGTH, or the bond is correctly skipped and there is
    // no matrix to measure.
    const ca = [0, 0, 0, 2, 2, 2];
    const bonds = bondMatrices(ca, 2, BOND_RADIUS);
    expect(bonds.count).toBe(1);
    const centre = transformPoint(bonds.matrices, 0, 0, 0, 0);
    // Math.SQRT1_2, not 0.707: the latter is not quite on the unit circle and
    // the shortfall shows up as a 6e-5 error in the measured radius.
    for (const [x, z] of [[1, 0], [0, 1], [Math.SQRT1_2, Math.SQRT1_2]] as const) {
      const edge = transformPoint(bonds.matrices, 0, x, 0, z);
      const offset = Math.hypot(edge[0] - centre[0], edge[1] - centre[1], edge[2] - centre[2]);
      expect(offset).toBeCloseTo(BOND_RADIUS, 5);
    }
  });

  it("skips chain breaks rather than drawing across them", () => {
    // A stick spanning a gap asserts a connection the experiment never saw.
    const ca = [0, 0, 0, 3.8, 0, 0, 40, 0, 0, 43.8, 0, 0];
    const bonds = bondMatrices(ca, 4);
    expect(bonds.count).toBe(2);
    expect(Array.from(bonds.residueOf.slice(0, 2))).toEqual([0, 2]);
  });

  it("uses a bond-length ceiling just above the real spacing", () => {
    expect(MAX_BOND_LENGTH).toBeGreaterThan(3.8);
    expect(MAX_BOND_LENGTH).toBeLessThan(6);
  });

  it("handles a chain too short to have bonds", () => {
    expect(bondMatrices([0, 0, 0], 1).count).toBe(0);
  });

  it("works for a bond aligned with the seed axis", () => {
    // A bond along Y is the degenerate case for the basis construction.
    const bonds = bondMatrices([0, 0, 0, 0, 3.8, 0], 2);
    expect(bonds.count).toBe(1);
    for (let i = 0; i < 16; i++) expect(Number.isFinite(bonds.matrices[i]!)).toBe(true);
    const end = transformPoint(bonds.matrices, 0, 0, 0.5, 0);
    expect(end[1]).toBeCloseTo(3.8, 5);
  });
});

describe("buildSurface", () => {
  it("encloses a single sphere at about the right radius", () => {
    const surface = buildSurface([0, 0, 0], [3], [0], { resolution: 0.4, probeRadius: 0 });
    expect(surface.vertexCount).toBeGreaterThan(100);
    let min = Infinity;
    let max = 0;
    for (let v = 0; v < surface.vertexCount; v++) {
      const r = Math.hypot(
        surface.positions[v * 3]!, surface.positions[v * 3 + 1]!, surface.positions[v * 3 + 2]!,
      );
      min = Math.min(min, r);
      max = Math.max(max, r);
    }
    expect(min).toBeGreaterThan(2.7);
    expect(max).toBeLessThan(3.3);
  });

  it("adds the probe radius to the surface it encloses", () => {
    // Zero probe gives the van der Waals surface; 1.4 gives solvent-accessible.
    const plain = buildSurface([0, 0, 0], [3], [0], { resolution: 0.4, probeRadius: 0 });
    const probed = buildSurface([0, 0, 0], [3], [0], { resolution: 0.4, probeRadius: 1.4 });
    const extent = (s: typeof plain) => {
      let max = 0;
      for (let v = 0; v < s.vertexCount; v++) {
        max = Math.max(max, Math.hypot(
          s.positions[v * 3]!, s.positions[v * 3 + 1]!, s.positions[v * 3 + 2]!,
        ));
      }
      return max;
    };
    expect(extent(probed) - extent(plain)).toBeCloseTo(1.4, 0);
  });

  it("merges two overlapping spheres into one surface", () => {
    const surface = buildSurface([0, 0, 0, 2, 0, 0], [2, 2], [0, 1], {
      resolution: 0.4, probeRadius: 0,
    });
    // Nothing should be left in the join between them, so no vertex sits near
    // the axis between the two centres.
    let insideJoin = 0;
    for (let v = 0; v < surface.vertexCount; v++) {
      const x = surface.positions[v * 3]!;
      const r = Math.hypot(surface.positions[v * 3 + 1]!, surface.positions[v * 3 + 2]!);
      if (x > 0.5 && x < 1.5 && r < 0.5) insideJoin += 1;
    }
    expect(insideJoin).toBe(0);
  });

  it("produces outward-facing normals", () => {
    const surface = buildSurface([0, 0, 0], [3], [0], { resolution: 0.5, probeRadius: 0 });
    let outward = 0;
    for (let v = 0; v < surface.vertexCount; v++) {
      const p = [surface.positions[v * 3]!, surface.positions[v * 3 + 1]!, surface.positions[v * 3 + 2]!];
      const n = [surface.normals[v * 3]!, surface.normals[v * 3 + 1]!, surface.normals[v * 3 + 2]!];
      if (p[0]! * n[0]! + p[1]! * n[1]! + p[2]! * n[2]! > 0) outward += 1;
    }
    expect(outward / surface.vertexCount).toBeGreaterThan(0.95);
  });

  it("produces unit normals and valid indices", () => {
    const surface = buildSurface([0, 0, 0, 3, 0, 0], [2, 2], [0, 1], { resolution: 0.5 });
    for (let v = 0; v < surface.vertexCount; v++) {
      expect(Math.hypot(
        surface.normals[v * 3]!, surface.normals[v * 3 + 1]!, surface.normals[v * 3 + 2]!,
      )).toBeCloseTo(1, 5);
    }
    for (const index of surface.indices) expect(index).toBeLessThan(surface.vertexCount);
    expect(surface.indices.length % 3).toBe(0);
  });

  it("is watertight -- no edge belongs to only one triangle", () => {
    // A hole in a closed surface shows as a window into the interior, and the
    // molecule stops reading as a solid object.
    const surface = buildSurface([0, 0, 0], [3], [0], { resolution: 0.4, probeRadius: 0 });
    const uses = new Map<string, number>();
    for (let t = 0; t < surface.indices.length; t += 3) {
      const tri = [surface.indices[t]!, surface.indices[t + 1]!, surface.indices[t + 2]!];
      for (let e = 0; e < 3; e++) {
        const [a, b] = [tri[e]!, tri[(e + 1) % 3]!];
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        uses.set(key, (uses.get(key) ?? 0) + 1);
      }
    }
    expect([...uses.values()].filter((n) => n === 1)).toHaveLength(0);
  });

  it("produces no NaN in positions or normals on a real protein", () => {
    // Regression: the field was seeded with +Infinity, so a gradient touching
    // an untouched voxel gave Infinity/Infinity = NaN and the vertex shaded
    // black. Only real structures reach far enough out to hit it.
    const residues = ubiquitin.seq.length;
    const surface = buildSurface(
      ubiquitin.coords["ca"]!,
      new Array(residues).fill(3.2),
      Array.from({ length: residues }, (_, i) => i),
      { probeRadius: 0 },
    );
    for (let i = 0; i < surface.positions.length; i++) {
      expect(Number.isFinite(surface.positions[i]!)).toBe(true);
      expect(Number.isFinite(surface.normals[i]!)).toBe(true);
    }
  });

  it("assigns every vertex to a residue that exists", () => {
    const surface = buildSurface([0, 0, 0, 4, 0, 0], [2, 2], [0, 1], { resolution: 0.5 });
    for (const residue of surface.residueOf) expect(residue).toBeLessThanOrEqual(1);
  });

  it("coarsens rather than exhausting memory on an impossible request", () => {
    const surface = buildSurface(ubiquitin.coords["ca"]!, new Array(76).fill(2),
      Array.from({ length: 76 }, (_, i) => i), { resolution: 0.001 });
    expect(surface.resolution).toBeGreaterThan(0.001);
    expect(surface.vertexCount).toBeGreaterThan(0);
  });

  it("meshes a real protein in a usable time", () => {
    const residues = ubiquitin.seq.length;
    const started = performance.now();
    const surface = buildSurface(
      ubiquitin.coords["ca"]!,
      new Array(residues).fill(2.4),
      Array.from({ length: residues }, (_, i) => i),
      { resolution: 1.0 },
    );
    const elapsed = performance.now() - started;
    expect(surface.vertexCount).toBeGreaterThan(1000);
    // Rebuilt only when the user stops scrubbing, so a budget far above a
    // frame is fine -- but it has to stay interactive.
    expect(elapsed).toBeLessThan(3000);
  });

  it("rejects mismatched inputs", () => {
    expect(() => buildSurface([], [], [])).toThrow(/no atoms/);
    expect(() => buildSurface([0, 0, 0], [1, 2], [0])).toThrow(/expected 1 radii/);
  });
});

describe("project", () => {
  /** A simple perspective matrix, column-major, looking down -Z. */
  function perspective(fovDegrees: number, aspect: number, near: number, far: number): Float32Array {
    const f = 1 / Math.tan((fovDegrees * Math.PI) / 360);
    const out = new Float32Array(16);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    return out;
  }

  const viewport = { width: 800, height: 600 };
  const matrix = perspective(45, 800 / 600, 1, 1000);

  it("puts a point on the axis at the centre of the screen", () => {
    const screen = project(matrix, 0, 0, -50, viewport);
    expect(screen.x).toBeCloseTo(400, 3);
    expect(screen.y).toBeCloseTo(300, 3);
    expect(screen.visible).toBe(true);
  });

  it("puts a point above the axis higher on the screen", () => {
    // Screen y grows downward, so a larger world y must give a smaller y.
    expect(project(matrix, 0, 10, -50, viewport).y).toBeLessThan(300);
  });

  it("marks a point behind the camera as not visible", () => {
    // Dividing through by a negative w projects the point back through the
    // origin, and it reappears mirrored in front of the viewer where it can be
    // picked by mistake.
    const behind = project(matrix, 0, 0, 50, viewport);
    expect(behind.visible).toBe(false);
  });

  it("marks a point off the side of the screen as not visible", () => {
    expect(project(matrix, 500, 0, -50, viewport).visible).toBe(false);
  });
});

describe("pickResidue", () => {
  function perspective(): Float32Array {
    const f = 1 / Math.tan((45 * Math.PI) / 360);
    const out = new Float32Array(16);
    out[0] = f; out[5] = f; out[10] = -1.002; out[11] = -1; out[14] = -2.002;
    return out;
  }
  const viewport = { width: 800, height: 800 };
  const matrix = perspective();

  it("finds the residue under the pointer", () => {
    const ca = [0, 0, -50, 20, 0, -50];
    expect(pickResidue(ca, matrix, 400, 400, viewport)).toBe(0);
  });

  it("returns -1 when nothing is close enough", () => {
    expect(pickResidue([0, 0, -50], matrix, 50, 50, viewport)).toBe(-1);
  });

  it("prefers the residue nearer the camera when two overlap", () => {
    // Two residues on the same line of sight; the one in front must win, or
    // hovering selects something hidden behind the surface.
    const ca = [0, 0, -80, 0, 0, -40];
    expect(pickResidue(ca, matrix, 400, 400, viewport)).toBe(1);
  });

  it("ignores residues behind the camera", () => {
    expect(pickResidue([0, 0, 50], matrix, 400, 400, viewport)).toBe(-1);
  });

  it("respects a custom radius", () => {
    const ca = [0, 0, -50];
    const offset = 400 + DEFAULT_PICK_RADIUS + 6;
    expect(pickResidue(ca, matrix, offset, 400, viewport)).toBe(-1);
    expect(pickResidue(ca, matrix, offset, 400, viewport, { radius: 60 })).toBe(0);
  });
});

describe("multiply", () => {
  it("leaves a matrix unchanged when multiplied by the identity", () => {
    const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const m = Float32Array.from({ length: 16 }, (_, i) => i + 1);
    expect(Array.from(multiply(identity, m))).toEqual(Array.from(m));
    expect(Array.from(multiply(m, identity))).toEqual(Array.from(m));
  });

  it("composes two translations", () => {
    const translate = (x: number) =>
      new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, 0, 1]);
    expect(multiply(translate(3), translate(4))[12]).toBe(7);
  });
});
