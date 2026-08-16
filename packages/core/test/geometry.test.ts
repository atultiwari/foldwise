import { describe, expect, it } from "vitest";

import { centroid, distance, translated } from "../src/vec3.js";
import { denaturedRadiusOfGyration, radiusOfGyration } from "../src/rg.js";
import { applyTransform, kabsch } from "../src/kabsch.js";
import { rmsd, superposedRmsd } from "../src/rmsd.js";

/** Rotate a flat coordinate array about z, for building known-answer cases. */
function rotateZ(coords: readonly number[], degrees: number): number[] {
  const t = (degrees * Math.PI) / 180;
  const [c, s] = [Math.cos(t), Math.sin(t)];
  const out: number[] = [];
  for (let i = 0; i < coords.length; i += 3) {
    const [x, y, z] = [coords[i]!, coords[i + 1]!, coords[i + 2]!];
    out.push(x * c - y * s, x * s + y * c, z);
  }
  return out;
}

function translate(coords: readonly number[], by: readonly [number, number, number]): number[] {
  return coords.map((v, i) => v + by[i % 3]!);
}

/** A deterministic, non-degenerate point cloud. */
function cloud(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(Math.sin(i * 1.7) * 10, Math.cos(i * 2.3) * 8, Math.sin(i * 0.9) * 6);
  }
  return out;
}

describe("vec3", () => {
  it("measures distance between indexed points", () => {
    const a = [0, 0, 0, 3, 4, 0];
    expect(distance(a, 0, a, 1)).toBeCloseTo(5, 12);
  });

  it("finds the centroid", () => {
    expect(centroid([0, 0, 0, 2, 4, 6])).toEqual([1, 2, 3]);
  });

  it("rejects a coordinate array that is not a multiple of three", () => {
    expect(() => centroid([0, 1])).toThrow(/multiple of 3/);
  });
});

describe("radiusOfGyration", () => {
  it("is zero for a single point", () => {
    expect(radiusOfGyration([1, 2, 3])).toBe(0);
  });

  it("equals the radius for points on a sphere", () => {
    // Six points on the axes at radius 5: every point is 5 from the centroid.
    const r = 5;
    const points = [r, 0, 0, -r, 0, 0, 0, r, 0, 0, -r, 0, 0, 0, r, 0, 0, -r];
    expect(radiusOfGyration(points)).toBeCloseTo(r, 12);
  });

  it("matches the analytic value for a uniform rod", () => {
    // A line of N evenly spaced points of length L has Rg -> L/sqrt(12).
    const n = 20001;
    const length = 100;
    const points: number[] = [];
    for (let i = 0; i < n; i++) points.push((i / (n - 1)) * length, 0, 0);
    expect(radiusOfGyration(points)).toBeCloseTo(length / Math.sqrt(12), 2);
  });

  it("is invariant under translation and rotation", () => {
    const points = cloud(50);
    const moved = rotateZ(translate(points, [17, -3, 42]), 37);
    expect(radiusOfGyration(moved)).toBeCloseTo(radiusOfGyration(points), 10);
  });

  it("equals the unweighted value when every mass is the same", () => {
    const points = cloud(30);
    expect(radiusOfGyration(points, new Array(30).fill(12))).toBeCloseTo(
      radiusOfGyration(points),
      10,
    );
  });

  it("is pulled towards the heavy end when masses differ", () => {
    // Two points 10 apart. Equal masses put the centre in the middle, so
    // Rg = 5. Loading one end drags the centre onto it and shrinks Rg.
    const points = [0, 0, 0, 10, 0, 0];
    expect(radiusOfGyration(points)).toBeCloseTo(5, 12);
    expect(radiusOfGyration(points, [99, 1])).toBeLessThan(2);
  });

  it("rejects a mass array of the wrong length", () => {
    expect(() => radiusOfGyration([0, 0, 0, 1, 1, 1], [1])).toThrow(/expected 2 masses/);
  });

  it("is zero for an empty set", () => {
    expect(radiusOfGyration([])).toBe(0);
  });
});

describe("denaturedRadiusOfGyration", () => {
  it("reproduces the Kohn scaling law", () => {
    // Rg = 1.93 * N^0.598 (Kohn et al. 2004, PNAS 101:12491).
    expect(denaturedRadiusOfGyration(76)).toBeCloseTo(1.93 * 76 ** 0.598, 10);
  });

  it("puts a denatured chain far larger than its folded self", () => {
    // Ubiquitin's native Ca radius of gyration is about 11.5 A.
    expect(denaturedRadiusOfGyration(76)).toBeGreaterThan(22);
  });

  it("grows sub-linearly with chain length", () => {
    const single = denaturedRadiusOfGyration(100);
    const tenfold = denaturedRadiusOfGyration(1000);
    expect(tenfold).toBeGreaterThan(single);
    expect(tenfold).toBeLessThan(single * 10);
  });
});

describe("translated", () => {
  it("subtracts the offset without touching the input", () => {
    const points = [1, 2, 3, 4, 5, 6];
    const copy = [...points];
    expect(Array.from(translated(points, [1, 2, 3]))).toEqual([0, 0, 0, 3, 3, 3]);
    expect(points).toEqual(copy);
  });
});

describe("kabsch", () => {
  it("superposes a structure onto itself with zero error", () => {
    const points = cloud(40);
    const result = kabsch(points, points);
    expect(result.rmsd).toBeCloseTo(0, 10);
  });

  it("recovers a pure translation", () => {
    const points = cloud(30);
    const moved = translate(points, [10, -5, 3]);
    const result = kabsch(moved, points);
    expect(result.rmsd).toBeCloseTo(0, 9);
    const fitted = applyTransform(moved, result);
    for (let i = 0; i < points.length; i++) {
      expect(fitted[i]!).toBeCloseTo(points[i]!, 8);
    }
  });

  it("recovers a known rotation", () => {
    const points = cloud(30);
    const rotated = rotateZ(points, 90);
    const result = kabsch(rotated, points);
    expect(result.rmsd).toBeCloseTo(0, 9);
    const fitted = applyTransform(rotated, result);
    for (let i = 0; i < points.length; i++) {
      expect(fitted[i]!).toBeCloseTo(points[i]!, 8);
    }
  });

  it("does not mutate its inputs", () => {
    const points = cloud(10);
    const copy = [...points];
    const target = rotateZ(points, 30);
    const result = kabsch(points, target);
    applyTransform(points, result);
    expect(points).toEqual(copy);
  });

  it("refuses to fit a mirror image with a reflection", () => {
    // A chiral molecule superposed on its mirror must NOT come out at zero.
    // Allowing det = -1 is the classic Kabsch bug and would silently make
    // D-amino acids fit L-amino acids perfectly.
    const points = cloud(30);
    const mirrored = points.map((v, i) => (i % 3 === 0 ? -v : v));
    expect(kabsch(mirrored, points).rmsd).toBeGreaterThan(1);
  });

  it("produces a proper rotation matrix", () => {
    const points = cloud(30);
    const { rotation } = kabsch(points, rotateZ(points, 61));
    const [a, b, c, d, e, f, g, h, i] = rotation as [
      number, number, number, number, number, number, number, number, number,
    ];
    const det =
      a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    expect(det).toBeCloseTo(1, 9);
  });

  it("rejects mismatched lengths", () => {
    expect(() => kabsch([0, 0, 0], [0, 0, 0, 1, 1, 1])).toThrow(/same length/);
  });
});

describe("rmsd", () => {
  it("is zero for identical coordinates", () => {
    const points = cloud(20);
    expect(rmsd(points, points)).toBe(0);
  });

  it("equals the uniform offset when every atom is shifted equally", () => {
    const points = cloud(20);
    expect(rmsd(points, translate(points, [3, 4, 0]))).toBeCloseTo(5, 10);
  });

  it("rejects mismatched lengths", () => {
    expect(() => rmsd([0, 0, 0], [0, 0, 0, 1, 1, 1])).toThrow(/same length/);
  });

  it("is zero for empty input", () => {
    expect(rmsd([], [])).toBe(0);
  });

  it("is sensitive to placement where superposedRmsd is not", () => {
    const points = cloud(25);
    const moved = rotateZ(translate(points, [12, 7, -4]), 55);
    expect(rmsd(points, moved)).toBeGreaterThan(5);
    expect(superposedRmsd(points, moved)).toBeCloseTo(0, 8);
  });
});
