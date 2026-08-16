/**
 * Which residue is under the pointer.
 *
 * Every alpha carbon is projected to screen space and the nearest to the
 * pointer wins. That is linear in residues per pick, which at a few hundred is
 * far below a frame's budget and needs no second render pass, no colour-ID
 * buffer, and no read-back stall.
 *
 * It stops scaling somewhere around a few thousand residues. The interface is
 * shaped so a GPU picking pass can replace the implementation without callers
 * noticing.
 */

import type { Coords } from "@foldwise/core";

/** How far from a residue the pointer may be and still select it, in pixels. */
export const DEFAULT_PICK_RADIUS = 22;

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface Projected {
  readonly x: number;
  readonly y: number;
  /** Normalised depth; above 1 is behind the camera or past the far plane. */
  readonly depth: number;
  readonly visible: boolean;
}

/**
 * Project a point through a column-major view-projection matrix.
 *
 * Taking the matrix rather than a camera keeps this testable and keeps three.js
 * out of the module.
 */
export function project(
  matrix: ArrayLike<number>,
  x: number, y: number, z: number,
  viewport: Viewport,
): Projected {
  const clipX = matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!;
  const clipY = matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!;
  const clipZ = matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!;
  const clipW = matrix[3]! * x + matrix[7]! * y + matrix[11]! * z + matrix[15]!;

  // A point on or behind the camera plane has no meaningful screen position;
  // dividing anyway projects it back through the origin, and it lands mirrored
  // in front of the viewer where it can be picked by mistake.
  if (clipW <= 1e-6) {
    return { x: 0, y: 0, depth: Number.POSITIVE_INFINITY, visible: false };
  }

  const ndcX = clipX / clipW;
  const ndcY = clipY / clipW;
  const ndcZ = clipZ / clipW;
  return {
    x: ((ndcX + 1) / 2) * viewport.width,
    y: ((1 - ndcY) / 2) * viewport.height,
    depth: ndcZ,
    visible: ndcZ <= 1 && ndcX >= -1.05 && ndcX <= 1.05 && ndcY >= -1.05 && ndcY <= 1.05,
  };
}

export interface PickOptions {
  readonly radius?: number;
}

/**
 * The residue nearest the pointer, or -1 if none is close enough.
 *
 * Ties are broken by depth, so the residue in front is picked rather than one
 * hidden behind it.
 */
export function pickResidue(
  ca: Coords,
  matrix: ArrayLike<number>,
  pointerX: number,
  pointerY: number,
  viewport: Viewport,
  options: PickOptions = {},
): number {
  const radius = options.radius ?? DEFAULT_PICK_RADIUS;
  const radiusSquared = radius * radius;
  const residues = ca.length / 3;

  let best = -1;
  let bestDistance = radiusSquared;
  let bestDepth = Number.POSITIVE_INFINITY;

  for (let i = 0; i < residues; i++) {
    const screen = project(matrix, ca[i * 3]!, ca[i * 3 + 1]!, ca[i * 3 + 2]!, viewport);
    if (!screen.visible) continue;

    const dx = screen.x - pointerX;
    const dy = screen.y - pointerY;
    const distance = dx * dx + dy * dy;
    if (distance > radiusSquared) continue;

    // Nearer to the pointer wins; at a similar distance, nearer the camera wins.
    const clearlyCloser = distance < bestDistance - 4;
    const similar = Math.abs(distance - bestDistance) <= 4;
    if (clearlyCloser || (similar && screen.depth < bestDepth)) {
      best = i;
      bestDistance = Math.min(distance, bestDistance);
      bestDepth = screen.depth;
    }
  }
  return best;
}

/** Multiply two column-major 4x4 matrices: `a * b`. */
export function multiply(a: ArrayLike<number>, b: ArrayLike<number>): Float32Array {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row]! * b[column * 4 + k]!;
      out[column * 4 + row] = sum;
    }
  }
  return out;
}
