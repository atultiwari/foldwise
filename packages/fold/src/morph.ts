/**
 * Turning a start and an end into a movie that never breaks the chain.
 *
 * The naive approach -- interpolate each residue straight from its coil
 * position to its native one -- produces a chain that stretches to twice its
 * length in the middle of the transition and snaps back. Bonds visibly grow
 * and shrink, which is exactly the thing a protein cannot do.
 *
 * So instead each frame is *steered*: work out where the residue would like to
 * be, move the chain part of the way there, and after every partial step pull
 * the bonds back to their exact native lengths. The result is a rope being
 * pulled into shape rather than a set of points being cross-faded.
 */

import { applyTransform, kabsch, type Coords } from "@foldwise/core";

import { declash, relaxBonds, snapBonds } from "./constraints.js";

/** How far along the chain a residue's motion is shared with its neighbours. */
const COHERENCE = 10;

/** Sub-steps per frame. More steps mean gentler pulls and less constraint fighting. */
const SUBSTEPS = 8;

/** Relaxation sweeps after each sub-step, and again at the end. */
const SUBSTEP_SWEEPS = 6;
const FINAL_SWEEPS = 16;

/**
 * Light declash after every sub-step, thorough declash at the end.
 *
 * Correcting only once per frame lets residues drive deep into each other over
 * eight sub-steps, and a deep overlap is far harder to unpick than a shallow
 * one -- pushing two residues apart displaces them into their other
 * neighbours. Nipping it each sub-step keeps every correction small.
 */
const SUBSTEP_DECLASH_PASSES = 2;

/**
 * Advance `current` toward `target` in place, keeping every bond exact.
 *
 * The displacement field is smoothed along the chain before being applied.
 * Without that, neighbouring residues get independent instructions and the
 * chain shears; with it, a whole loop swings as a unit, which is both what a
 * real chain does and what reads as motion rather than noise.
 */
export function steerToward(
  current: Float64Array,
  target: Coords,
  residues: number,
  bondLengths: ArrayLike<number>,
  clashThreshold: number,
): void {
  const aligned = applyTransform(current, kabsch(current, target));
  current.set(aligned);

  const displacement = new Float64Array(residues * 3);
  for (let i = 0; i < residues * 3; i++) {
    displacement[i] = target[i]! - current[i]!;
  }

  const smoothed = smoothAlongChain(displacement, residues, COHERENCE);

  for (let step = 0; step < SUBSTEPS; step++) {
    for (let i = 0; i < residues * 3; i++) {
      current[i] = current[i]! + smoothed[i]! / SUBSTEPS;
    }
    relaxBonds(current, residues, bondLengths, SUBSTEP_SWEEPS);
    declash(current, residues, bondLengths, clashThreshold, SUBSTEP_DECLASH_PASSES);
  }

  relaxBonds(current, residues, bondLengths, FINAL_SWEEPS);
  snapBonds(current, residues, bondLengths);
  declash(current, residues, bondLengths, clashThreshold);
}

/** Triangular smoothing of a per-residue vector field along the sequence. */
function smoothAlongChain(
  field: Float64Array,
  residues: number,
  halfWidth: number,
): Float64Array {
  const out = new Float64Array(field.length);
  for (let i = 0; i < residues; i++) {
    let x = 0;
    let y = 0;
    let z = 0;
    let weightSum = 0;
    const from = Math.max(0, i - halfWidth);
    const to = Math.min(residues - 1, i + halfWidth);
    for (let j = from; j <= to; j++) {
      const weight = 1 - Math.abs(j - i) / (halfWidth + 1);
      x += field[j * 3]! * weight;
      y += field[j * 3 + 1]! * weight;
      z += field[j * 3 + 2]! * weight;
      weightSum += weight;
    }
    out[i * 3] = x / weightSum;
    out[i * 3 + 1] = y / weightSum;
    out[i * 3 + 2] = z / weightSum;
  }
  return out;
}

/**
 * Where each residue is heading at this point on the timeline: its coil
 * position, its native position, or somewhere between the two.
 */
export function blendTarget(
  coil: Coords,
  native: Coords,
  formation: ArrayLike<number>,
  residues: number,
): Float64Array {
  const target = new Float64Array(residues * 3);
  for (let i = 0; i < residues; i++) {
    const t = formation[i]!;
    for (let axis = 0; axis < 3; axis++) {
      const k = i * 3 + axis;
      target[k] = coil[k]! + (native[k]! - coil[k]!) * t;
    }
  }
  return target;
}
