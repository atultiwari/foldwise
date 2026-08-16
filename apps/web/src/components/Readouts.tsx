/**
 * The live read-outs.
 *
 * Every number here is computed from the coordinates currently on screen, not
 * looked up. That is the difference between a caption and a measurement, and it
 * is what lets the reader scrub the timeline and watch the chain bury itself.
 *
 * Measured over **every chain**, not the first. An earlier version used
 * `chains[0]` alone, which reported 141 residues of haemoglobin's 574-residue
 * tetramer and ignored every inter-chain contact — the allosteric story of that
 * protein, and the entire point of the Mpro dimer entry.
 */

import { useMemo } from "react";

import {
  VDW_RADII, buriedFraction, fractionFormed, nativeContacts, perResidue,
  radiusOfGyration, relativeAccessibility, shrakeRupley, superposedRmsd,
} from "@foldwise/core";
import type { Level } from "@foldwise/content";
import { flatten, globalIndex, runsOf, sparklinePath, type Structure } from "@foldwise/ui";
import { STRUCTURE_COLOURS, rgbToHex, shapeOf } from "@foldwise/render";

import { frameOf, type TrajectoryState } from "../fold/useTrajectory.js";
import { Explain } from "./Explain.js";

export interface Hit {
  readonly chain: number;
  readonly residue: number;
}

interface ReadoutsProps {
  readonly structure: Structure;
  readonly trajectory: TrajectoryState;
  readonly progress: number;
  readonly hovered: Hit | null;
  readonly level: Level;
}

/** Sample the timeline this many times for the trend lines. */
const TREND_SAMPLES = 20;

export function Readouts({ structure, trajectory, progress, hovered, level }: ReadoutsProps) {
  const flat = useMemo(() => flatten(structure), [structure]);

  /** Every chain's current frame, concatenated in the same order as `flat`. */
  const current = useMemo(() => {
    if (trajectory.status !== "ready" || trajectory.chains.length !== structure.chains.length) {
      return flat.ca;
    }
    const out = new Float64Array(flat.residues * 3);
    let offset = 0;
    for (const chain of trajectory.chains) {
      out.set(frameOf(chain, progress), offset);
      offset += chain.residues * 3;
    }
    return out;
  }, [flat, trajectory, progress, structure.chains.length]);

  const metrics = useMemo(() => {
    const native = nativeContacts(flat.ca, { chainOf: flat.chainOf });
    const areas = perResidue(
      shrakeRupley(current, new Array(flat.residues).fill(VDW_RADII["C"]!), { points: 96 }),
      1,
    );
    return {
      rg: radiusOfGyration(current),
      rmsd: superposedRmsd(current, flat.ca),
      q: fractionFormed(native, current),
      buried: buriedFraction(relativeAccessibility(flat.sequence, areas)),
    };
  }, [current, flat]);

  // Sampled across the whole trajectory once rather than accumulated frame by
  // frame, so scrubbing backwards shows the same curve.
  const trends = useMemo(() => {
    if (trajectory.status !== "ready" || trajectory.chains.length !== structure.chains.length) {
      return null;
    }
    const native = nativeContacts(flat.ca, { chainOf: flat.chainOf });
    const rg: number[] = [];
    const rmsd: number[] = [];
    const q: number[] = [];

    const scratch = new Float64Array(flat.residues * 3);
    for (let sample = 0; sample < TREND_SAMPLES; sample++) {
      let offset = 0;
      for (const chain of trajectory.chains) {
        scratch.set(frameOf(chain, sample / (TREND_SAMPLES - 1)), offset);
        offset += chain.residues * 3;
      }
      rg.push(radiusOfGyration(scratch));
      rmsd.push(superposedRmsd(scratch, flat.ca));
      q.push(fractionFormed(native, scratch));
    }
    return { rg, rmsd, q };
  }, [trajectory, flat, structure.chains.length]);

  const bands = useMemo(() => runsOf(flat.secondaryStructure), [flat.secondaryStructure]);
  const marker = hovered === null ? -1 : globalIndex(flat, hovered.chain, hovered.residue);

  return (
    <div className="readouts">
      <section className="card">
        <h2>Live read-outs</h2>
        <div className="stats">
          <Stat id="rmsd" label="RMSD to folded" value={metrics.rmsd.toFixed(2)} unit="Å"
            trend={trends?.rmsd} at={progress} level={level} />
          <Stat id="radius" label="Radius" value={metrics.rg.toFixed(1)} unit="Å"
            trend={trends?.rg} at={progress} level={level} />
          <Stat id="contacts" label="Native contacts" value={`${Math.round(metrics.q * 100)}`} unit="%"
            trend={trends?.q} at={progress} level={level} />
          <Stat id="buried" label="Buried core" value={`${Math.round(metrics.buried * 100)}`} unit="%"
            level={level} />
        </div>
        <p className="stats__scope">
          Over all {flat.residues} residues
          {flat.chainIds.length > 1 ? ` in ${flat.chainIds.length} chains` : ""}.
        </p>
      </section>

      <section className="card">
        <h2>Sequence</h2>
        <svg className="track" viewBox={`0 0 ${flat.residues} 10`} preserveAspectRatio="none"
          role="img" aria-label="Secondary structure along the chain">
          {bands.map((band) => (
            <rect key={band.start} x={band.start} width={band.end - band.start} y={0} height={10}
              fill={rgbToHex(STRUCTURE_COLOURS[shapeOf(band.value)])} />
          ))}
          {/* Chain boundaries, so a multi-chain track is not read as one chain. */}
          {flat.offsets.slice(1).map((offset) => (
            <rect key={offset} x={offset - 0.5} width={1} y={0} height={10} fill="var(--panel)" />
          ))}
          {marker >= 0 ? (
            <rect x={marker} width={Math.max(1.5, flat.residues / 200)} y={0} height={10}
              fill="var(--ink)" />
          ) : null}
        </svg>
        <p className="track__caption">
          {marker >= 0
            ? `${flat.sequence[marker]}${flat.resNums[marker]} · chain ${flat.chainIds[flat.chainOf[marker]!]} · ${flat.secondaryStructure[marker]}`
            : `${flat.residues} residues · hover the model to inspect`}
        </p>
      </section>
    </div>
  );
}

interface StatProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly level: Level;
  readonly trend?: readonly number[] | undefined;
  readonly at?: number;
}

function Stat({ id, label, value, unit, level, trend, at = 0 }: StatProps) {
  return (
    <div className="stat">
      <span className="stat__label">{label}<Explain id={id} level={level} /></span>
      <span className="stat__value">
        {value}<span className="stat__unit">{unit}</span>
      </span>
      {trend !== undefined && trend.length > 1 ? (
        <svg className="stat__spark" viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true">
          <path d={sparklinePath(trend, { width: 100, height: 22 })} />
          <line x1={at * 100} x2={at * 100} y1={0} y2={22} className="stat__cursor" />
        </svg>
      ) : null}
    </div>
  );
}
