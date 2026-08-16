/**
 * Shared scaffolding for the mechanism schematics.
 *
 * These are drawings, not data, and they say so. Everything below the atomic
 * scale — a fibre growing, a cell deforming, a vessel occluding — cannot be
 * rendered from a coordinate file, so it is drawn by hand and labelled as a
 * diagram. The alternative was to leave those steps out, which is how the
 * application ended up unable to answer the question a doctor arrives with.
 *
 * One visual language across all of them:
 *   neutral fill for things that are fine, the accent for the pathological
 *   path, and the good colour for the healthy or treated one.
 */

import type { ReactNode } from "react";

export interface SchematicProps {
  /** The outcome's `state`, which selects what is drawn. */
  readonly state: string;
}

export const VIEWBOX = { width: 320, height: 190 } as const;

interface FrameProps {
  readonly label: string;
  readonly children: ReactNode;
}

/** An SVG canvas with a spoken-word description for screen readers. */
export function Frame({ label, children }: FrameProps) {
  return (
    <svg
      className="schematic"
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      {children}
    </svg>
  );
}

/** A caption inside the drawing, for the one or two words a shape needs. */
export function Caption({ x, y, children, anchor = "middle", tone = "soft" }: {
  readonly x: number;
  readonly y: number;
  readonly children: ReactNode;
  readonly anchor?: "start" | "middle" | "end";
  readonly tone?: "soft" | "ink" | "harm" | "good";
}) {
  return (
    <text className={`schematic__label schematic__label--${tone}`} x={x} y={y} textAnchor={anchor}>
      {children}
    </text>
  );
}

/** Position and rotation for a moving part, as a transitionable CSS transform. */
export function placed(x: number, y: number, rotation = 0): { transform: string } {
  return { transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)` };
}
