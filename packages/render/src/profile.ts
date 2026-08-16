/**
 * The shape swept along the backbone.
 *
 * Secondary structure is drawn, not annotated: a helix is a flat ribbon, a
 * strand is a flat arrow, and everything else is a round tube. The reader is
 * meant to recognise the fold from its silhouette before reading a single
 * label, which is the whole reason cartoon representations exist.
 *
 * A profile is a closed polygon in the ribbon's local plane: x runs across the
 * width, y through the thickness. Extruding it along the curve makes the mesh.
 */

export type SecondaryStructure = "helix" | "strand" | "coil";

/** DSSP's eight states collapse to three shapes. */
export function shapeOf(code: string): SecondaryStructure {
  if (code === "H" || code === "G" || code === "I") return "helix";
  if (code === "E" || code === "B") return "strand";
  return "coil";
}

export interface Profile {
  /** Closed polygon, [x0, y0, x1, y1, ...], counter-clockwise. */
  readonly points: readonly number[];
}

/** Half-width and half-thickness of each shape, angstrom. */
export const HELIX_WIDTH = 1.1;
export const HELIX_THICKNESS = 0.22;
export const STRAND_WIDTH = 0.95;
export const STRAND_THICKNESS = 0.22;
export const ARROW_WIDTH = 1.7;
export const TUBE_RADIUS = 0.28;

/** Sides on the tube. Eight reads as round at the scale a loop is drawn. */
const TUBE_SIDES = 8;

function rectangle(halfWidth: number, halfThickness: number): Profile {
  return {
    points: [
      -halfWidth, -halfThickness,
      halfWidth, -halfThickness,
      halfWidth, halfThickness,
      -halfWidth, halfThickness,
    ],
  };
}

function circle(radius: number, sides: number): Profile {
  const points: number[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  return { points };
}

const TUBE = circle(TUBE_RADIUS, TUBE_SIDES);

/**
 * Every profile carries the same number of points.
 *
 * The mesh is one continuous strip from end to end, so consecutive
 * cross-sections have to have matching vertex counts even where the shape
 * changes. A rectangle is therefore resampled to the tube's vertex count
 * rather than being given four points -- otherwise the helix-to-loop junction
 * would need a separate stitching case, and that is exactly where cartoon
 * renderers tend to tear.
 */
export const PROFILE_POINTS = TUBE_SIDES;

function resample(profile: Profile, points: number): Profile {
  const source = profile.points;
  const corners = source.length / 2;
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const position = (i / points) * corners;
    const index = Math.floor(position);
    const t = position - index;
    const a = index % corners;
    const b = (index + 1) % corners;
    out.push(
      source[a * 2]! + (source[b * 2]! - source[a * 2]!) * t,
      source[a * 2 + 1]! + (source[b * 2 + 1]! - source[a * 2 + 1]!) * t,
    );
  }
  return { points: out };
}

const HELIX = resample(rectangle(HELIX_WIDTH, HELIX_THICKNESS), PROFILE_POINTS);
const STRAND = resample(rectangle(STRAND_WIDTH, STRAND_THICKNESS), PROFILE_POINTS);

/**
 * The cross-section at a point on the curve.
 *
 * `arrow` runs 0 to 1 across the last residue of a strand, widening the
 * profile into an arrowhead and then tapering it to a point. Beta strands are
 * directional and the arrow is how that direction is read.
 */
export function profileAt(shape: SecondaryStructure, arrow = 0): Profile {
  if (shape === "coil") return TUBE;
  if (shape === "helix") return HELIX;

  if (arrow <= 0) return STRAND;

  // First half of the tip flares out, second half closes to a point.
  const flare = arrow < 0.5 ? arrow * 2 : 1;
  const taper = arrow < 0.5 ? 1 : 1 - (arrow - 0.5) * 2;
  const halfWidth = (STRAND_WIDTH + (ARROW_WIDTH - STRAND_WIDTH) * flare) * taper;
  return resample(rectangle(Math.max(halfWidth, 1e-3), STRAND_THICKNESS), PROFILE_POINTS);
}

/**
 * How far into an arrowhead each residue is.
 *
 * The final residue of every strand run gets one; nothing else does.
 */
export function arrowProgress(secondaryStructure: string): Float64Array {
  const residues = secondaryStructure.length;
  const out = new Float64Array(residues);
  for (let i = 0; i < residues; i++) {
    if (shapeOf(secondaryStructure[i]!) !== "strand") continue;
    const isLast = i === residues - 1 || shapeOf(secondaryStructure[i + 1]!) !== "strand";
    if (isLast) out[i] = 1;
  }
  return out;
}
