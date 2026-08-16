/**
 * The molecular surface.
 *
 * Two decisions worth stating, because the usual shortcuts get both wrong.
 *
 * **The field is an exact union of spheres**, not a sum of Gaussians. Metaballs
 * are the common choice and they produce a pleasant blob, but a blob is not a
 * surface anyone can reason about: pockets fill in, clefts round over, and a
 * binding site stops looking like a binding site. Taking the minimum of the
 * per-atom signed distances gives the van der Waals surface exactly, and adding
 * the probe radius to each sphere gives the solvent-accessible surface exactly.
 *
 * **The mesher is surface nets**, not marching cubes. Marching cubes needs a
 * 256-case lookup table -- several thousand literal entries that cannot be
 * meaningfully reviewed -- whereas surface nets places one vertex per cell and
 * joins them, in a fraction of the code, and produces a watertight mesh with
 * more even triangles. The trade is slightly softer creases, which for a
 * surface being looked at rather than measured is not a cost.
 */

import type { Coords } from "@foldwise/core";

/** Grid spacing, angstrom. Finer resolves pockets; coarser is faster. */
export const DEFAULT_RESOLUTION = 0.9;

/** Water probe, for the solvent-accessible surface. */
export const PROBE_RADIUS = 1.4;

/**
 * Ceiling on grid cells.
 *
 * A large structure at fine resolution can ask for hundreds of millions of
 * voxels, which will exhaust memory long before it finishes. Past this the
 * resolution is coarsened and the caller is told.
 */
export const MAX_VOXELS = 24_000_000;

export interface SurfaceOptions {
  readonly resolution?: number;
  /** Added to every radius. Zero gives van der Waals, 1.4 solvent-accessible. */
  readonly probeRadius?: number;
}

export interface SurfaceMesh {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  /** Nearest residue to each vertex, for colouring. */
  readonly residueOf: Uint32Array;
  readonly vertexCount: number;
  /** Resolution actually used, which may be coarser than requested. */
  readonly resolution: number;
}

interface Grid {
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  readonly origin: readonly [number, number, number];
  readonly spacing: number;
  readonly field: Float32Array;
}

interface GridPlan {
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  readonly origin: readonly [number, number, number];
  readonly voxels: number;
}

/**
 * Work out the grid's dimensions without allocating it.
 *
 * Separate from `buildField` so an over-fine resolution can be rejected by
 * arithmetic rather than by trying to allocate the volume and failing.
 */
function planGrid(
  coords: Coords,
  radii: ArrayLike<number>,
  spacing: number,
  probe: number,
): GridPlan {
  const atoms = coords.length / 3;
  let maxRadius = 0;
  for (let i = 0; i < atoms; i++) maxRadius = Math.max(maxRadius, radii[i]! + probe);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < atoms; i++) {
    minX = Math.min(minX, coords[i * 3]!); maxX = Math.max(maxX, coords[i * 3]!);
    minY = Math.min(minY, coords[i * 3 + 1]!); maxY = Math.max(maxY, coords[i * 3 + 1]!);
    minZ = Math.min(minZ, coords[i * 3 + 2]!); maxZ = Math.max(maxZ, coords[i * 3 + 2]!);
  }

  // Two cells of air all round, so the surface always closes rather than being
  // clipped flat against the edge of the volume.
  const pad = maxRadius + spacing * 2;
  const nx = Math.ceil((maxX - minX + pad * 2) / spacing) + 1;
  const ny = Math.ceil((maxY - minY + pad * 2) / spacing) + 1;
  const nz = Math.ceil((maxZ - minZ + pad * 2) / spacing) + 1;
  return { nx, ny, nz, origin: [minX - pad, minY - pad, minZ - pad], voxels: nx * ny * nz };
}

/** Signed distance to the union of spheres, sampled on a grid. */
function buildField(
  coords: Coords,
  radii: ArrayLike<number>,
  spacing: number,
  probe: number,
): Grid {
  const atoms = coords.length / 3;
  const { nx, ny, nz, origin } = planGrid(coords, radii, spacing, probe);

  // "Far outside", as a large finite number rather than Infinity. Voxels away
  // from every atom are never written, and normals are taken as the gradient
  // by central differences -- so an Infinity here propagates as
  // `Infinity - finite = Infinity`, then `Infinity / Infinity = NaN`, and a
  // vertex on the outer lip of a protrusion gets a NaN normal and shades black.
  let far = 0;
  for (let i = 0; i < atoms; i++) far = Math.max(far, radii[i]! + probe);
  const field = new Float32Array(nx * ny * nz).fill(far + spacing * 4);

  // Scatter: each atom only touches the voxels inside its own sphere plus a
  // shell. Evaluating every atom at every voxel would be atoms x voxels, which
  // for a 300-residue protein is billions of operations.
  for (let atom = 0; atom < atoms; atom++) {
    const radius = radii[atom]! + probe;
    const reach = radius + spacing * 2;
    const ax = coords[atom * 3]!;
    const ay = coords[atom * 3 + 1]!;
    const az = coords[atom * 3 + 2]!;

    const i0 = Math.max(0, Math.floor((ax - reach - origin[0]) / spacing));
    const i1 = Math.min(nx - 1, Math.ceil((ax + reach - origin[0]) / spacing));
    const j0 = Math.max(0, Math.floor((ay - reach - origin[1]) / spacing));
    const j1 = Math.min(ny - 1, Math.ceil((ay + reach - origin[1]) / spacing));
    const k0 = Math.max(0, Math.floor((az - reach - origin[2]) / spacing));
    const k1 = Math.min(nz - 1, Math.ceil((az + reach - origin[2]) / spacing));

    for (let k = k0; k <= k1; k++) {
      const z = origin[2] + k * spacing - az;
      for (let j = j0; j <= j1; j++) {
        const y = origin[1] + j * spacing - ay;
        const rowBase = (k * ny + j) * nx;
        for (let i = i0; i <= i1; i++) {
          const x = origin[0] + i * spacing - ax;
          const distance = Math.sqrt(x * x + y * y + z * z) - radius;
          const index = rowBase + i;
          if (distance < field[index]!) field[index] = distance;
        }
      }
    }
  }

  return { nx, ny, nz, origin, spacing, field };
}

/** Corner offsets of a cell, in the order the edge table below expects. */
const CORNERS: readonly (readonly [number, number, number])[] = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];

/** The twelve edges of a cell, as pairs of corner indices. */
const EDGES: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/**
 * Mesh the zero level set.
 *
 * One vertex per cell that straddles the surface, positioned at the average of
 * the crossings on its edges, then quads joining the four cells around every
 * sign-changing grid edge.
 */
export function buildSurface(
  coords: Coords,
  radii: ArrayLike<number>,
  residueOfAtom: ArrayLike<number>,
  options: SurfaceOptions = {},
): SurfaceMesh {
  const atoms = coords.length / 3;
  if (atoms === 0) throw new RangeError("cannot build a surface for no atoms");
  if (radii.length !== atoms) {
    throw new RangeError(`expected ${atoms} radii, got ${radii.length}`);
  }

  const probe = options.probeRadius ?? PROBE_RADIUS;
  let spacing = options.resolution ?? DEFAULT_RESOLUTION;

  // Coarsen by arithmetic until the volume fits. Sizing it first matters: a
  // resolution of a thousandth of an angstrom asks for more voxels than there
  // are addressable bytes, and finding that out by attempting the allocation
  // throws rather than degrading.
  while (planGrid(coords, radii, spacing, probe).voxels > MAX_VOXELS) {
    spacing *= 1.5;
  }
  return mesh(buildField(coords, radii, spacing, probe), coords, residueOfAtom, spacing);
}

function mesh(
  grid: Grid,
  coords: Coords,
  residueOfAtom: ArrayLike<number>,
  resolution: number,
): SurfaceMesh {
  const { nx, ny, nz, origin, spacing, field } = grid;
  const index = (i: number, j: number, k: number) => (k * ny + j) * nx + i;

  // Cell -> vertex, or -1 where the cell does not straddle the surface.
  const vertexAt = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cellIndex = (i: number, j: number, k: number) => (k * (ny - 1) + j) * (nx - 1) + i;

  const positions: number[] = [];
  const normals: number[] = [];

  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const values: number[] = [];
        let negatives = 0;
        for (const [dx, dy, dz] of CORNERS) {
          const value = field[index(i + dx, j + dy, k + dz)]!;
          values.push(value);
          if (value < 0) negatives += 1;
        }
        if (negatives === 0 || negatives === 8) continue;

        // Average the crossings on every edge whose ends disagree.
        let sx = 0, sy = 0, sz = 0, crossings = 0;
        for (const [a, b] of EDGES) {
          const va = values[a]!;
          const vb = values[b]!;
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          const ca = CORNERS[a]!;
          const cb = CORNERS[b]!;
          sx += ca[0] + (cb[0] - ca[0]) * t;
          sy += ca[1] + (cb[1] - ca[1]) * t;
          sz += ca[2] + (cb[2] - ca[2]) * t;
          crossings += 1;
        }
        if (crossings === 0) continue;

        const x = origin[0] + (i + sx / crossings) * spacing;
        const y = origin[1] + (j + sy / crossings) * spacing;
        const z = origin[2] + (k + sz / crossings) * spacing;

        vertexAt[cellIndex(i, j, k)] = positions.length / 3;
        positions.push(x, y, z);

        // Normal from the field's gradient by central differences -- smoother
        // than accumulating face normals, and it costs six lookups.
        const gx = field[index(Math.min(nx - 1, i + 1), j, k)]! - field[index(Math.max(0, i - 1), j, k)]!;
        const gy = field[index(i, Math.min(ny - 1, j + 1), k)]! - field[index(i, Math.max(0, j - 1), k)]!;
        const gz = field[index(i, j, Math.min(nz - 1, k + 1))]! - field[index(i, j, Math.max(0, k - 1))]!;
        const length = Math.hypot(gx, gy, gz) || 1;
        normals.push(gx / length, gy / length, gz / length);
      }
    }
  }

  const indices: number[] = [];
  // One quad per grid edge that changes sign, joining the four cells that share
  // it. Winding follows the direction of the sign change so the surface faces
  // outward.
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const here = field[index(i, j, k)]! < 0;
        emitQuad(here, field[index(i + 1, j, k)]! < 0, [
          cellIndex(i, j - 1, k - 1), cellIndex(i, j, k - 1),
          cellIndex(i, j, k), cellIndex(i, j - 1, k),
        ], vertexAt, indices);
        emitQuad(here, field[index(i, j + 1, k)]! < 0, [
          cellIndex(i - 1, j, k - 1), cellIndex(i, j, k - 1),
          cellIndex(i, j, k), cellIndex(i - 1, j, k),
        ], vertexAt, indices, true);
        emitQuad(here, field[index(i, j, k + 1)]! < 0, [
          cellIndex(i - 1, j - 1, k), cellIndex(i, j - 1, k),
          cellIndex(i, j, k), cellIndex(i - 1, j, k),
        ], vertexAt, indices);
      }
    }
  }

  const vertexCount = positions.length / 3;
  return {
    positions: Float32Array.from(positions),
    normals: Float32Array.from(normals),
    indices: Uint32Array.from(indices),
    residueOf: nearestResidue(positions, coords, residueOfAtom),
    vertexCount,
    resolution,
  };
}

function emitQuad(
  inside: boolean,
  neighbourInside: boolean,
  cells: readonly number[],
  vertexAt: Int32Array,
  indices: number[],
  flip = false,
): void {
  if (inside === neighbourInside) return;
  const [a, b, c, d] = cells.map((cell) => vertexAt[cell]!);
  if (a! < 0 || b! < 0 || c! < 0 || d! < 0) return;

  // A sign change one way round means the surface faces the other.
  const reverse = inside === flip;
  if (reverse) {
    indices.push(a!, b!, c!, a!, c!, d!);
  } else {
    indices.push(a!, c!, b!, a!, d!, c!);
  }
}

/** Assign each surface vertex to the residue of its nearest atom. */
function nearestResidue(
  positions: readonly number[],
  coords: Coords,
  residueOfAtom: ArrayLike<number>,
): Uint32Array {
  const vertices = positions.length / 3;
  const atoms = coords.length / 3;
  const out = new Uint32Array(vertices);

  for (let v = 0; v < vertices; v++) {
    let best = 0;
    let bestDistance = Infinity;
    for (let atom = 0; atom < atoms; atom++) {
      const dx = positions[v * 3]! - coords[atom * 3]!;
      const dy = positions[v * 3 + 1]! - coords[atom * 3 + 1]!;
      const dz = positions[v * 3 + 2]! - coords[atom * 3 + 2]!;
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = atom;
      }
    }
    out[v] = residueOfAtom[best]!;
  }
  return out;
}
