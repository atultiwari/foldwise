/**
 * The live read-outs.
 *
 * Every number here is computed from the coordinates currently on screen, not
 * looked up. That is the difference between a caption and a measurement, and
 * it is what lets the reader scrub the timeline and watch the surface area
 * fall as the chain buries itself.
 *
 * Values that are estimates rather than measurements are labelled as such.
 */

import { useMemo } from "react";

import {
  buriedFraction, nativeContacts, radiusOfGyration, relativeAccessibility,
  perResidue, shrakeRupley, superposedRmsd, fractionFormed, VDW_RADII,
} from "@foldwise/core";
import type { Level } from "@foldwise/content";
import { runsOf, sparklinePath, type Structure } from "@foldwise/ui";
import { STRUCTURE_COLOURS, rgbToHex, shapeOf } from "@foldwise/render";

import { frameOf, type TrajectoryState } from "../fold/useTrajectory.js";
import { Explain } from "./Explain.js";

interface ReadoutsProps {
  readonly structure: Structure;
  readonly trajectory: TrajectoryState;
  readonly progress: number;
  readonly hovered: number | null;
  readonly level: Level;
}

/** Sample the timeline this many times for the trend lines. */
const TREND_SAMPLES = 24;

export function Readouts({ structure, trajectory, progress, hovered, level }: ReadoutsProps) {
  const chain = structure.chains[0]!;

  const current = useMemo(() => {
    const first = trajectory.chains[0];
    return first === undefined ? chain.ca : Array.from(frameOf(first, progress));
  }, [chain.ca, trajectory, progress]);

  const metrics = useMemo(() => {
    const rg = radiusOfGyration(current);
    const rmsd = superposedRmsd(current, chain.ca);
    const native = nativeContacts(chain.ca);
    const q = fractionFormed(native, current);

    // SASA over the alpha carbons only, and only for the trend -- the full
    // N/CA/C/O/CB surface is 5x the work and this panel updates on every frame.
    const areas = perResidue(
      shrakeRupley(current, new Array(chain.seq.length).fill(VDW_RADII["C"]!), { points: 96 }),
      1,
    );
    const buried = buriedFraction(relativeAccessibility(chain.seq, areas));

    return { rg, rmsd, q, sasa: areas.reduce((a, b) => a + b, 0), buried };
  }, [current, chain]);

  // Trend lines, sampled across the whole trajectory once rather than
  // accumulated frame by frame, so scrubbing backwards shows the same curve.
  const trends = useMemo(() => {
    const first = trajectory.chains[0];
    if (first === undefined) return null;
    const native = nativeContacts(chain.ca);
    const rg: number[] = [];
    const rmsd: number[] = [];
    const q: number[] = [];
    for (let i = 0; i < TREND_SAMPLES; i++) {
      const frame = frameOf(first, i / (TREND_SAMPLES - 1));
      rg.push(radiusOfGyration(frame));
      rmsd.push(superposedRmsd(frame, chain.ca));
      q.push(fractionFormed(native, frame));
    }
    return { rg, rmsd, q };
  }, [trajectory, chain.ca]);

  const bands = useMemo(() => runsOf(chain.ss), [chain.ss]);

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
      </section>

      <section className="card">
        <h2>Sequence</h2>
        <svg className="track" viewBox={`0 0 ${chain.seq.length} 10`} preserveAspectRatio="none"
          role="img" aria-label="Secondary structure along the chain">
          {bands.map((band) => (
            <rect key={band.start} x={band.start} width={band.end - band.start} y={0} height={10}
              fill={rgbToHex(STRUCTURE_COLOURS[shapeOf(band.value)])} />
          ))}
          {hovered !== null && hovered >= 0 ? (
            <rect x={hovered} width={1.5} y={0} height={10} fill="var(--ink)" />
          ) : null}
        </svg>
        <p className="track__caption">
          {hovered !== null && hovered >= 0
            ? `${chain.seq[hovered]}${chain.res_nums[hovered]} · ${chain.ss[hovered]}`
            : `${chain.seq.length} residues · hover the model to inspect`}
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
