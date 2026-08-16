/**
 * Framing the molecule.
 *
 * The camera has to hold a chain that starts as a sprawling coil and ends as a
 * compact globule -- roughly a threefold change in size -- without the viewer
 * having to touch the controls, and without lurching about while it happens.
 */

import { centroid, type Coords } from "@foldwise/core";

export interface Bounds {
  readonly centre: readonly [number, number, number];
  /** Distance from the centre to the furthest point. */
  readonly radius: number;
}

export function boundingSphere(coords: Coords): Bounds {
  const centre = centroid(coords);
  let furthest = 0;
  for (let i = 0; i < coords.length; i += 3) {
    const d = Math.hypot(
      coords[i]! - centre[0],
      coords[i + 1]! - centre[1],
      coords[i + 2]! - centre[2],
    );
    if (d > furthest) furthest = d;
  }
  return { centre, radius: furthest };
}

/**
 * How far a perspective camera must sit to fit a sphere of `radius`.
 *
 * Fitted against the narrower of the two field-of-view angles, so the molecule
 * stays inside the frame on a portrait phone as well as a wide monitor.
 */
export function fitDistance(
  radius: number,
  verticalFovDegrees: number,
  aspect: number,
  margin = 1.15,
): number {
  const vertical = (verticalFovDegrees * Math.PI) / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
  const limiting = Math.min(vertical, horizontal);
  return (radius * margin) / Math.sin(limiting / 2);
}

/**
 * Frame-rate independent exponential smoothing.
 *
 * `lerp(current, target, 0.1)` per frame is the usual shortcut, and it means
 * the camera moves at a different speed on a 60 Hz and a 144 Hz display. This
 * converges at the same rate in seconds whatever the frame rate.
 */
export function damp(current: number, target: number, smoothing: number, deltaSeconds: number): number {
  if (smoothing <= 0) return target;
  return target + (current - target) * Math.exp(-deltaSeconds / smoothing);
}

/**
 * Whether the camera should re-frame.
 *
 * Auto-framing on every frame fights the user the moment they touch the
 * controls, and re-framing only on load leaves a coil three times too big for
 * the view. So it tracks while the difference is worth tracking, and stops
 * once it is not.
 */
export function needsReframe(
  current: Bounds,
  target: Bounds,
  tolerance = 0.08,
): boolean {
  const radiusChange = Math.abs(target.radius - current.radius) / Math.max(current.radius, 1e-6);
  const centreShift =
    Math.hypot(
      target.centre[0] - current.centre[0],
      target.centre[1] - current.centre[1],
      target.centre[2] - current.centre[2],
    ) / Math.max(current.radius, 1e-6);
  return radiusChange > tolerance || centreShift > tolerance;
}
