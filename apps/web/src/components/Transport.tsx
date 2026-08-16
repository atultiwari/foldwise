/**
 * Playback along the folding timeline.
 *
 * The five stages are labelled rather than left as a bare 0-100% scrub: what
 * matters is which part of folding the reader is looking at, not what fraction
 * of the buffer they have reached.
 */

import { useEffect } from "react";

import { useView } from "../state/store.js";
import type { TrajectoryState } from "../fold/useTrajectory.js";

/**
 * The narrative stages.
 *
 * These name what is happening; the boundaries are a presentation choice, not
 * a measurement, and the honesty panel says so.
 */
export const STAGES = [
  { key: "coil", name: "Unfolded chain", from: 0, blurb: "A freshly made protein is a floppy string." },
  { key: "secondary", name: "Secondary structure", from: 0.14, blurb: "Helices and strands nucleate — neighbours finding neighbours." },
  { key: "collapse", name: "Hydrophobic collapse", from: 0.4, blurb: "Water-hating residues bury themselves. A molten globule." },
  { key: "tertiary", name: "Tertiary packing", from: 0.64, blurb: "The core locks; long-range contacts finally close." },
  { key: "native", name: "Native state", from: 0.88, blurb: "Every atom where the experiment found it." },
] as const;

export function stageAt(progress: number) {
  return [...STAGES].reverse().find((stage) => progress >= stage.from) ?? STAGES[0];
}

const SPEEDS = [0.5, 1, 2] as const;

interface TransportProps {
  readonly trajectory: TrajectoryState;
  readonly speed: number;
  readonly onSpeed: (speed: number) => void;
}

export function Transport({ trajectory, speed, onSpeed }: TransportProps) {
  const progress = useView((s) => s.progress);
  const playing = useView((s) => s.playing);
  const setProgress = useView((s) => s.setProgress);
  const setPlaying = useView((s) => s.setPlaying);
  const disabled = trajectory.status !== "ready";
  const stage = stageAt(progress);

  // Advance the timeline. Driven by elapsed time, not by frame count, so
  // playback lasts the same number of seconds on any display.
  useEffect(() => {
    if (!playing || disabled) return;
    let raf = 0;
    let last = performance.now();
    const duration = 9000;

    const tick = (now: number) => {
      const delta = (now - last) / (duration / speed);
      last = now;
      const next = useView.getState().progress + delta;
      if (next >= 1) {
        setProgress(1);
        setPlaying(false);
        return;
      }
      setProgress(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, disabled, speed, setProgress, setPlaying]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      const step = event.shiftKey ? 0.05 : 1 / 96;
      if (event.key === " ") { event.preventDefault(); setPlaying(!useView.getState().playing); }
      else if (event.key === "ArrowLeft") setProgress(useView.getState().progress - step);
      else if (event.key === "ArrowRight") setProgress(useView.getState().progress + step);
      else if (event.key === "Home") setProgress(0);
      else if (event.key === "End") setProgress(1);
      else return;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setProgress, setPlaying]);

  return (
    <div className="transport">
      <button
        type="button"
        className="transport__play"
        aria-label={playing ? "Pause" : "Play"}
        disabled={disabled}
        onClick={() => setPlaying(!playing)}
      >
        {playing ? "❚❚" : "▶"}
      </button>

      <div className="transport__body">
        <div className="transport__label">
          <strong>{stage.name}</strong>
          <span>{stage.blurb}</span>
          <span className="transport__pct">{Math.round(progress * 100)}%</span>
        </div>

        <div className="scrub">
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(progress * 1000)}
            disabled={disabled}
            aria-label="Folding progress"
            onChange={(event) => setProgress(Number(event.target.value) / 1000)}
          />
          <div className="scrub__ticks" aria-hidden="true">
            {STAGES.map((s) => (
              <span key={s.key} style={{ left: `${s.from * 100}%` }} title={s.name} />
            ))}
          </div>
        </div>
      </div>

      <div className="transport__speed" role="group" aria-label="Playback speed">
        {SPEEDS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={speed === value}
            onClick={() => onSpeed(value)}
          >
            {value}×
          </button>
        ))}
      </div>

      {disabled ? (
        <p className="transport__status" role="status">
          {trajectory.status === "building" ? "Generating the folding path…"
            : trajectory.status === "static" ? "Too large to animate — shown folded."
            : trajectory.status === "failed" ? `Could not generate: ${trajectory.error ?? ""}`
            : "Loading…"}
        </p>
      ) : null}
    </div>
  );
}
