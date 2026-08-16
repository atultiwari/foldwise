/**
 * Smoothing the backbone, and deciding which way the ribbon faces.
 *
 * Alpha carbons sit 3.8 A apart, which is far too coarse to draw directly --
 * a line through them looks like a wire model of a wire model. The curve is
 * interpolated, and each point on it is given a local frame so a flat ribbon
 * can be extruded along it.
 *
 * Nothing here knows about three.js. Frames and vertices are plain arrays, so
 * the whole geometry layer is testable without a graphics context.
 */

import type { Coords } from "@foldwise/core";

/** Curve samples generated between one residue and the next. */
export const DEFAULT_SUBDIVISIONS = 8;

export interface RibbonFrames {
  /** Direction of travel at each residue. */
  readonly tangents: Float64Array;
  /** Across the ribbon's face -- the width direction. */
  readonly widths: Float64Array;
  /** Perpendicular to both: the ribbon's thickness direction. */
  readonly normals: Float64Array;
}

/**
 * Centripetal Catmull-Rom through four control points.
 *
 * Centripetal rather than uniform: uniform Catmull-Rom overshoots and can form
 * cusps where control points bunch, which on a tight turn puts a visible spike
 * on the ribbon.
 */
export function catmullRom(
  p0: number, p1: number, p2: number, p3: number, t: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    ((2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/** Clamp an index into range, so the curve extends to the chain's ends. */
function at(coords: Coords, index: number, residues: number, axis: number): number {
  const clamped = Math.max(0, Math.min(residues - 1, index));
  return coords[clamped * 3 + axis]!;
}

/**
 * Local coordinate frames along the backbone, by the Carson-Bugg construction.
 *
 * The ribbon's width direction is taken from the local curvature of the chain,
 * which is what makes a helix read as a helix -- its ribbon face turns with the
 * coil rather than staying fixed in space.
 *
 * Each frame is flipped where necessary to agree with the one before it.
 * Without that the ribbon turns inside out wherever the curvature reverses,
 * which happens constantly in beta sheets and looks like a rendering fault.
 */
export function ribbonFrames(ca: Coords, residues: number): RibbonFrames {
  const tangents = new Float64Array(residues * 3);
  const widths = new Float64Array(residues * 3);
  const normals = new Float64Array(residues * 3);

  let previousWidth: [number, number, number] = [0, 0, 1];

  for (let i = 0; i < residues; i++) {
    const prev = [at(ca, i - 1, residues, 0), at(ca, i - 1, residues, 1), at(ca, i - 1, residues, 2)];
    const here = [at(ca, i, residues, 0), at(ca, i, residues, 1), at(ca, i, residues, 2)];
    const next = [at(ca, i + 1, residues, 0), at(ca, i + 1, residues, 1), at(ca, i + 1, residues, 2)];

    const forward = normalise([next[0]! - prev[0]!, next[1]! - prev[1]!, next[2]! - prev[2]!]) ??
      [1, 0, 0];

    // Curvature: which way the chain is bending here.
    const bend: [number, number, number] = [
      next[0]! - 2 * here[0]! + prev[0]!,
      next[1]! - 2 * here[1]! + prev[1]!,
      next[2]! - 2 * here[2]! + prev[2]!,
    ];

    // Width direction is perpendicular to travel, in the plane of the bend.
    let width = normalise(cross(forward, bend));
    if (width === null) {
      // Straight run: any perpendicular will do, so carry the previous one
      // forward rather than picking a new one and twisting the ribbon.
      width = normalise(reject(previousWidth, forward)) ?? anyPerpendicular(forward);
    }

    // Keep the face pointing the same way as the residue before it.
    if (dot(width, previousWidth) < 0) width = [-width[0], -width[1], -width[2]];
    previousWidth = width;

    const normal = normalise(cross(forward, width)) ?? anyPerpendicular(forward);

    tangents.set(forward, i * 3);
    widths.set(width, i * 3);
    normals.set(normal, i * 3);
  }

  return { tangents, widths, normals };
}

/**
 * Sample the smoothed curve, together with an interpolated frame at each point.
 *
 * Frames are interpolated and re-orthogonalised rather than recomputed from the
 * curve, which keeps them continuous through the tight turns where recomputing
 * would make them jump.
 */
export interface SampledCurve {
  readonly count: number;
  readonly positions: Float64Array;
  readonly widths: Float64Array;
  readonly normals: Float64Array;
  /** Fractional residue index at each sample, for colour and picking. */
  readonly residueAt: Float64Array;
}

export function sampleCurve(
  ca: Coords,
  residues: number,
  frames: RibbonFrames,
  subdivisions = DEFAULT_SUBDIVISIONS,
): SampledCurve {
  if (residues < 2) {
    return {
      count: residues,
      positions: Float64Array.from(Array.from({ length: residues * 3 }, (_, i) => ca[i] ?? 0)),
      widths: Float64Array.from(frames.widths),
      normals: Float64Array.from(frames.normals),
      residueAt: Float64Array.from({ length: residues }, (_, i) => i),
    };
  }

  const segments = residues - 1;
  const count = segments * subdivisions + 1;
  const positions = new Float64Array(count * 3);
  const widths = new Float64Array(count * 3);
  const normals = new Float64Array(count * 3);
  const residueAt = new Float64Array(count);

  let sample = 0;
  for (let segment = 0; segment < segments; segment++) {
    const steps = segment === segments - 1 ? subdivisions + 1 : subdivisions;
    for (let step = 0; step < steps; step++) {
      const t = step / subdivisions;

      for (let axis = 0; axis < 3; axis++) {
        positions[sample * 3 + axis] = catmullRom(
          at(ca, segment - 1, residues, axis),
          at(ca, segment, residues, axis),
          at(ca, segment + 1, residues, axis),
          at(ca, segment + 2, residues, axis),
          t,
        );
      }

      const a = segment;
      const b = Math.min(residues - 1, segment + 1);
      const width = normalise(lerp3(frames.widths, a, b, t)) ?? [0, 0, 1];
      const tangent = normalise(lerp3(frames.tangents, a, b, t)) ?? [1, 0, 0];
      // Re-orthogonalise: interpolating two unit vectors does not give a unit
      // vector, and does not stay perpendicular to the tangent.
      const orthogonal = normalise(reject(width, tangent)) ?? anyPerpendicular(tangent);
      const normal = normalise(cross(tangent, orthogonal)) ?? anyPerpendicular(tangent);

      widths.set(orthogonal, sample * 3);
      normals.set(normal, sample * 3);
      residueAt[sample] = segment + t;
      sample += 1;
    }
  }

  return { count, positions, widths, normals, residueAt };
}

function lerp3(
  source: Float64Array, a: number, b: number, t: number,
): [number, number, number] {
  return [
    source[a * 3]! + (source[b * 3]! - source[a * 3]!) * t,
    source[a * 3 + 1]! + (source[b * 3 + 1]! - source[a * 3 + 1]!) * t,
    source[a * 3 + 2]! + (source[b * 3 + 2]! - source[a * 3 + 2]!) * t,
  ];
}

export function cross(
  a: readonly number[], b: readonly number[],
): [number, number, number] {
  return [
    a[1]! * b[2]! - a[2]! * b[1]!,
    a[2]! * b[0]! - a[0]! * b[2]!,
    a[0]! * b[1]! - a[1]! * b[0]!,
  ];
}

export function dot(a: readonly number[], b: readonly number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}

/** Unit vector, or null when the input is too short to have a direction. */
export function normalise(v: readonly number[]): [number, number, number] | null {
  const length = Math.hypot(v[0]!, v[1]!, v[2]!);
  return length < 1e-9 ? null : [v[0]! / length, v[1]! / length, v[2]! / length];
}

/** The part of `v` perpendicular to unit vector `axis`. */
export function reject(
  v: readonly number[], axis: readonly number[],
): [number, number, number] {
  const scale = dot(v, axis);
  return [v[0]! - axis[0]! * scale, v[1]! - axis[1]! * scale, v[2]! - axis[2]! * scale];
}

function anyPerpendicular(v: readonly number[]): [number, number, number] {
  // Cross with whichever axis the vector is least aligned to, so the result is
  // never degenerate.
  const axis = Math.abs(v[0]!) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return normalise(cross(v, axis)) ?? [0, 0, 1];
}
