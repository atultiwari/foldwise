/**
 * Vector helpers over flat coordinate arrays.
 *
 * Coordinates are stored as `[x0, y0, z0, x1, y1, z1, ...]` throughout. Flat
 * typed arrays are what the renderer wants and what the pipeline emits, so
 * nothing here allocates a per-point object.
 */

export type Coords = ArrayLike<number>;

/** Number of points in a flat coordinate array. */
export function pointCount(coords: Coords): number {
  assertTriples(coords);
  return coords.length / 3;
}

export function assertTriples(coords: Coords): void {
  if (coords.length % 3 !== 0) {
    throw new RangeError(
      `coordinate array length ${coords.length} is not a multiple of 3`,
    );
  }
}

export function assertSameLength(a: Coords, b: Coords): void {
  if (a.length !== b.length) {
    throw new RangeError(
      `coordinate arrays must be the same length, got ${a.length} and ${b.length}`,
    );
  }
}

/** Squared distance between point `i` of `a` and point `j` of `b`. */
export function distanceSquared(a: Coords, i: number, b: Coords, j: number): number {
  const dx = a[i * 3]! - b[j * 3]!;
  const dy = a[i * 3 + 1]! - b[j * 3 + 1]!;
  const dz = a[i * 3 + 2]! - b[j * 3 + 2]!;
  return dx * dx + dy * dy + dz * dz;
}

export function distance(a: Coords, i: number, b: Coords, j: number): number {
  return Math.sqrt(distanceSquared(a, i, b, j));
}

export function centroid(coords: Coords): [number, number, number] {
  const n = pointCount(coords);
  if (n === 0) return [0, 0, 0];
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < n; i++) {
    x += coords[i * 3]!;
    y += coords[i * 3 + 1]!;
    z += coords[i * 3 + 2]!;
  }
  return [x / n, y / n, z / n];
}

/** A new array with `by` subtracted from every point. Never mutates `coords`. */
export function translated(coords: Coords, by: readonly [number, number, number]): Float64Array {
  assertTriples(coords);
  const out = new Float64Array(coords.length);
  for (let i = 0; i < coords.length; i += 3) {
    out[i] = coords[i]! - by[0];
    out[i + 1] = coords[i + 1]! - by[1];
    out[i + 2] = coords[i + 2]! - by[2];
  }
  return out;
}
