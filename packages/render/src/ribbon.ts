/**
 * Building the cartoon mesh.
 *
 * The topology is fixed at load and never rebuilt: the folding animation
 * rewrites vertex positions in place, ninety-six times per structure, and
 * reallocating index buffers at that rate would dominate the frame budget and
 * churn the garbage collector.
 *
 * So `buildRibbon` decides the shape once, and `updateRibbon` moves it.
 */

import type { Coords } from "@foldwise/core";

import {
  PROFILE_POINTS,
  arrowProgress,
  profileAt,
  shapeOf,
  type SecondaryStructure,
} from "./profile.js";
import { DEFAULT_SUBDIVISIONS, ribbonFrames, sampleCurve } from "./spline.js";

export interface RibbonGeometry {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  /** Residue each vertex belongs to, for colouring and picking. */
  readonly residueOf: Uint32Array;
  readonly vertexCount: number;
  readonly subdivisions: number;
  readonly residues: number;
}

export interface RibbonOptions {
  readonly subdivisions?: number;
}

/** Vertices and triangles for one chain. Positions are filled by `updateRibbon`. */
export function buildRibbon(
  ca: Coords,
  secondaryStructure: string,
  options: RibbonOptions = {},
): RibbonGeometry {
  const residues = secondaryStructure.length;
  if (residues === 0) throw new RangeError("cannot build a ribbon for an empty chain");
  if (ca.length !== residues * 3) {
    throw new RangeError(
      `secondary structure has ${residues} residues but ${ca.length / 3} coordinates were given`,
    );
  }

  const subdivisions = options.subdivisions ?? DEFAULT_SUBDIVISIONS;
  const samples = residues < 2 ? residues : (residues - 1) * subdivisions + 1;
  const vertexCount = samples * PROFILE_POINTS;

  const indices = new Uint32Array(Math.max(0, (samples - 1) * PROFILE_POINTS * 6));
  let cursor = 0;
  for (let sample = 0; sample < samples - 1; sample++) {
    for (let point = 0; point < PROFILE_POINTS; point++) {
      const next = (point + 1) % PROFILE_POINTS;
      const a = sample * PROFILE_POINTS + point;
      const b = sample * PROFILE_POINTS + next;
      const c = (sample + 1) * PROFILE_POINTS + point;
      const d = (sample + 1) * PROFILE_POINTS + next;
      indices[cursor++] = a; indices[cursor++] = c; indices[cursor++] = b;
      indices[cursor++] = b; indices[cursor++] = c; indices[cursor++] = d;
    }
  }

  const geometry: RibbonGeometry = {
    positions: new Float32Array(vertexCount * 3),
    normals: new Float32Array(vertexCount * 3),
    indices,
    residueOf: new Uint32Array(vertexCount),
    vertexCount,
    subdivisions,
    residues,
  };

  updateRibbon(geometry, ca, secondaryStructure);
  return geometry;
}

/**
 * Rewrite vertex positions and normals for a new conformation.
 *
 * Allocates nothing that survives the call, and never touches the index buffer.
 */
export function updateRibbon(
  geometry: RibbonGeometry,
  ca: Coords,
  secondaryStructure: string,
): void {
  const { residues, subdivisions } = geometry;
  const frames = ribbonFrames(ca, residues);
  const curve = sampleCurve(ca, residues, frames, subdivisions);
  const arrows = arrowProgress(secondaryStructure);

  const shapes: SecondaryStructure[] = Array.from(secondaryStructure, shapeOf);

  for (let sample = 0; sample < curve.count; sample++) {
    const position = curve.residueAt[sample]!;
    const residue = Math.min(residues - 1, Math.round(position));
    const profile = profileAt(shapes[residue]!, arrowAt(arrows, position, residues));

    const cx = curve.positions[sample * 3]!;
    const cy = curve.positions[sample * 3 + 1]!;
    const cz = curve.positions[sample * 3 + 2]!;
    const wx = curve.widths[sample * 3]!;
    const wy = curve.widths[sample * 3 + 1]!;
    const wz = curve.widths[sample * 3 + 2]!;
    const nx = curve.normals[sample * 3]!;
    const ny = curve.normals[sample * 3 + 1]!;
    const nz = curve.normals[sample * 3 + 2]!;

    for (let point = 0; point < PROFILE_POINTS; point++) {
      const u = profile.points[point * 2]!;
      const v = profile.points[point * 2 + 1]!;
      const vertex = sample * PROFILE_POINTS + point;

      geometry.positions[vertex * 3] = cx + wx * u + nx * v;
      geometry.positions[vertex * 3 + 1] = cy + wy * u + ny * v;
      geometry.positions[vertex * 3 + 2] = cz + wz * u + nz * v;

      // The outward direction in the ribbon's own plane. Good enough for a
      // swept profile, and far cheaper than accumulating face normals.
      const length = Math.hypot(u, v) || 1;
      const ou = u / length;
      const ov = v / length;
      geometry.normals[vertex * 3] = wx * ou + nx * ov;
      geometry.normals[vertex * 3 + 1] = wy * ou + ny * ov;
      geometry.normals[vertex * 3 + 2] = wz * ou + nz * ov;

      geometry.residueOf[vertex] = residue;
    }
  }
}

/** Interpolate arrow progress so the head grows smoothly across the residue. */
function arrowAt(arrows: Float64Array, position: number, residues: number): number {
  const index = Math.floor(position);
  const t = position - index;
  const here = arrows[Math.min(residues - 1, index)] ?? 0;
  const next = arrows[Math.min(residues - 1, index + 1)] ?? 0;
  if (here === 0 && next === 0) return 0;
  // The head belongs to the residue that carries it, opening across its span.
  return here > 0 ? Math.min(1, t) : Math.max(0, t - 1 + next);
}
