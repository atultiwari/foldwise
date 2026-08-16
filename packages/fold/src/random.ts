/**
 * Deterministic randomness.
 *
 * The unfolded state is generated, not measured, so it must at least be
 * *reproducible*: the same protein has to give the same starting coil on every
 * load, on every machine. Otherwise a deep link to a frame means nothing and
 * two people looking at "the same" animation are not.
 */

/** mulberry32 -- small, fast, and statistically fine for scattering points. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a, so a protein's identifier can seed its own coil. */
export function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * A uniformly distributed point on the unit sphere, by Marsaglia's method.
 *
 * Sampling two angles independently would crowd the poles; this does not.
 */
export function randomDirection(random: () => number): [number, number, number] {
  let x = 0;
  let y = 0;
  let squared = 0;
  do {
    x = random() * 2 - 1;
    y = random() * 2 - 1;
    squared = x * x + y * y;
  } while (squared >= 1 || squared === 0);

  const scale = 2 * Math.sqrt(1 - squared);
  return [x * scale, y * scale, 1 - 2 * squared];
}

/** Rotate `vector` about `axis` (assumed unit length) by `angle` radians. */
export function rotateAbout(
  vector: readonly [number, number, number],
  axis: readonly [number, number, number],
  angle: number,
): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const [vx, vy, vz] = vector;
  const [ax, ay, az] = axis;
  const dot = ax * vx + ay * vy + az * vz;
  return [
    vx * cos + (ay * vz - az * vy) * sin + ax * dot * (1 - cos),
    vy * cos + (az * vx - ax * vz) * sin + ay * dot * (1 - cos),
    vz * cos + (ax * vy - ay * vx) * sin + az * dot * (1 - cos),
  ];
}
