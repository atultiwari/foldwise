import { kabsch } from "./kabsch.js";
import { assertSameLength, assertTriples, type Coords } from "./vec3.js";

/**
 * Root-mean-square deviation between two point sets, as they sit.
 *
 * This measures placement as well as shape, so it is the wrong number to quote
 * for "how similar are these two structures" unless they are already aligned.
 * Use `superposedRmsd` for that.
 */
export function rmsd(a: Coords, b: Coords): number {
  assertTriples(a);
  assertTriples(b);
  assertSameLength(a, b);

  const n = a.length / 3;
  if (n === 0) return 0;

  let sum = 0;
  for (let i = 0; i < a.length; i += 3) {
    const dx = a[i]! - b[i]!;
    const dy = a[i + 1]! - b[i + 1]!;
    const dz = a[i + 2]! - b[i + 2]!;
    sum += dx * dx + dy * dy + dz * dz;
  }
  return Math.sqrt(sum / n);
}

/** RMSD after optimal rigid-body superposition -- a measure of shape alone. */
export function superposedRmsd(a: Coords, b: Coords): number {
  return kabsch(a, b).rmsd;
}
