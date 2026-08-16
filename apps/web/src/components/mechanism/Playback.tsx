/**
 * Manual stepping, and an auto mode with a variable speed.
 *
 * Auto mode stops at the end rather than looping. A loop turns the chain into
 * ambient motion, and the point of the last stage is that it is the answer —
 * it should sit there.
 */

import { useEffect } from "react";

export const SPEEDS = [0.5, 1, 2] as const;
export type Speed = (typeof SPEEDS)[number];

/** Dwell on a stage at 1×. Long enough to read the outcome paragraph. */
const BASE_DWELL_MS = 7000;

interface PlaybackProps {
  readonly playing: boolean;
  readonly speed: Speed;
  readonly atStart: boolean;
  readonly atEnd: boolean;
  readonly onPlay: (playing: boolean) => void;
  readonly onSpeed: (speed: Speed) => void;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
}

export function Playback({
  playing, speed, atStart, atEnd, onPlay, onSpeed, onNext, onPrevious,
}: PlaybackProps) {
  // Advance on a timer while playing, and stop at the end of the chain.
  useEffect(() => {
    if (!playing) return;
    if (atEnd) { onPlay(false); return; }
    const timer = setTimeout(onNext, BASE_DWELL_MS / speed);
    return () => clearTimeout(timer);
  }, [playing, atEnd, speed, onNext, onPlay]);

  return (
    <div className="playback">
      <button type="button" className="playback__step" disabled={atStart} onClick={onPrevious}>
        ‹ Back
      </button>

      <button
        type="button"
        className="playback__play"
        aria-pressed={playing}
        onClick={() => onPlay(!playing)}
      >
        {playing ? "Pause" : atEnd ? "Play from the top" : "Play"}
      </button>

      <button type="button" className="playback__step" disabled={atEnd} onClick={onNext}>
        Next ›
      </button>

      <div className="playback__speed" role="group" aria-label="Playback speed">
        {SPEEDS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === speed}
            onClick={() => onSpeed(option)}
          >
            {option}×
          </button>
        ))}
      </div>
    </div>
  );
}
