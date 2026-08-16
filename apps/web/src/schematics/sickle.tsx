/**
 * The sickle cell chain at the scales no structure file contains.
 *
 * Four drawings: the codon that changes, the fibre that grows out of it, the
 * cell that loses its shape, and the vessel that blocks. Each reads the
 * outcome's `state`, so changing the oxygen tension in the controls changes
 * the picture rather than the caption under it.
 */

import { Caption, Frame, placed, type SchematicProps } from "./frame.js";

/* ── The codon ──────────────────────────────────────────────────────────── */

const BASE_WIDTH = 44;

export function Codon({ state }: SchematicProps) {
  const mutant = state === "gtg";
  const bases = mutant ? ["G", "T", "G"] : ["G", "A", "G"];
  const acid = mutant ? "Valine" : "Glutamate";

  return (
    <Frame label={`Codon 6 reads ${bases.join("")}, encoding ${acid}`}>
      <Caption x={160} y={26}>β-globin gene, codon 6</Caption>

      {bases.map((base, index) => {
        const changed = mutant && index === 1;
        const x = 160 + (index - 1) * (BASE_WIDTH + 8) - BASE_WIDTH / 2;
        return (
          <g key={index}>
            <rect
              className={`schematic__base${changed ? " schematic__base--changed" : ""}`}
              x={x} y={40} width={BASE_WIDTH} height={52} rx={8}
            />
            <text
              className={`schematic__base-letter${changed ? " schematic__base-letter--changed" : ""}`}
              x={x + BASE_WIDTH / 2} y={74} textAnchor="middle"
            >
              {base}
            </text>
          </g>
        );
      })}

      {mutant ? <Caption x={160} y={108} tone="harm">A → T</Caption> : null}

      <path className="schematic__arrow" d="M160 116 L160 132" markerEnd="url(#tip)" />
      <defs>
        <marker id="tip" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto">
          <path className="schematic__arrowhead" d="M0 0 L8 4 L0 8 Z" />
        </marker>
      </defs>

      <rect
        className={`schematic__pill${mutant ? " schematic__pill--harm" : " schematic__pill--good"}`}
        x={104} y={140} width={112} height={34} rx={17}
      />
      <text className="schematic__pill-text" x={160} y={162} textAnchor="middle">{acid}</text>
    </Frame>
  );
}

/* ── The fibre ──────────────────────────────────────────────────────────── */

interface Unit {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  /** Fetal haemoglobin: no sticky patch, so it terminates a growing fibre. */
  readonly fetal?: boolean;
}

const LAYOUTS: Readonly<Record<string, readonly Unit[]>> = {
  dispersed: [
    { x: 52, y: 52, r: -18 }, { x: 148, y: 38, r: 24 }, { x: 246, y: 60, r: -8 },
    { x: 70, y: 132, r: 34 }, { x: 176, y: 128, r: -26 }, { x: 262, y: 138, r: 12 },
  ],
  polymerised: [
    { x: 44, y: 128, r: -30 }, { x: 84, y: 105, r: -30 }, { x: 124, y: 82, r: -30 },
    { x: 164, y: 59, r: -30 }, { x: 204, y: 36, r: -30 }, { x: 262, y: 140, r: 8 },
  ],
  interrupted: [
    { x: 44, y: 128, r: -30 }, { x: 84, y: 105, r: -30 }, { x: 124, y: 82, r: -30 },
    { x: 166, y: 62, r: -30, fetal: true }, { x: 232, y: 44, r: 22 }, { x: 268, y: 128, r: -14 },
  ],
};

/**
 * One haemoglobin tetramer: a rounded body, a knob for βVal6, a notch for the
 * pocket the next molecule's knob sits in. The knob and notch are the whole
 * mechanism, so they are the only detail drawn.
 */
function Tetramer({ unit, docked }: { readonly unit: Unit; readonly docked: boolean }) {
  const tone = unit.fetal ? "fetal" : docked ? "docked" : "free";
  return (
    <g className="schematic__unit" style={placed(unit.x, unit.y, unit.r)}>
      <rect className={`schematic__body schematic__body--${tone}`} x={-19} y={-14} width={38} height={28} rx={9} />
      {unit.fetal ? null : (
        <path className={`schematic__knob schematic__knob--${tone}`} d="M19 -4 L28 0 L19 4 Z" />
      )}
      <path className="schematic__notch" d="M-19 -5 L-11 0 L-19 5 Z" />
      {unit.fetal ? <text className="schematic__unit-text" x={0} y={4} textAnchor="middle">F</text> : null}
    </g>
  );
}

export function Fibre({ state }: SchematicProps) {
  const layout = LAYOUTS[state] ?? LAYOUTS["dispersed"]!;
  const chained = state === "polymerised" ? 5 : state === "interrupted" ? 4 : 0;

  const label = state === "polymerised"
    ? "Haemoglobin molecules locked into a growing fibre"
    : state === "interrupted"
      ? "A fetal haemoglobin molecule terminating the fibre"
      : "Haemoglobin molecules dispersed in solution";

  return (
    <Frame label={label}>
      {chained > 0 ? (
        <path
          className={`schematic__fibre-spine${state === "interrupted" ? " schematic__fibre-spine--stopped" : ""}`}
          d={`M${layout[0]!.x} ${layout[0]!.y} L${layout[chained - 1]!.x} ${layout[chained - 1]!.y}`}
        />
      ) : null}

      {layout.map((unit, index) => (
        <Tetramer key={index} unit={unit} docked={index < chained} />
      ))}

      {state === "polymerised"
        ? <Caption x={160} y={178} tone="harm">A rigid rod, growing at both ends</Caption>
        : state === "interrupted"
          ? <Caption x={160} y={178} tone="good">HbF cannot dock — the chain stops here</Caption>
          : <Caption x={160} y={178}>Freely soluble</Caption>}
    </Frame>
  );
}

/* ── The red cell ───────────────────────────────────────────────────────── */

/** A biconcave disc seen edge-on-ish: a circle with a dimple. */
const DISC = "M160 40 C 208 40 244 66 244 95 C 244 124 208 150 160 150 "
  + "C 112 150 76 124 76 95 C 76 66 112 40 160 40 Z";
/**
 * The crescent: pulled to a point at each end by the polymer inside.
 *
 * Both edges curve the same way — that is what makes it a crescent rather than
 * a leaf, and it is the shape a student has to recognise on a film.
 */
const SICKLE = "M58 148 C 96 34 216 14 268 112 C 206 92 132 112 58 148 Z";

/** Bundles of polymer, running along the long axis of the crescent. */
const RODS = [
  "M110 112 L230 86",
  "M118 96 L222 70",
  "M136 84 L206 62",
];

export function RedCell({ state }: SchematicProps) {
  const sickled = state === "sickle";
  return (
    <Frame label={sickled ? "A red cell distorted into a crescent" : "A normal biconcave red cell"}>
      <path className="schematic__cell" d={DISC} style={{ opacity: sickled ? 0 : 1 }} />
      <path
        className="schematic__cell schematic__cell--sickled"
        d={SICKLE}
        style={{ opacity: sickled ? 1 : 0 }}
      />
      {sickled ? (
        <g className="schematic__rods">
          {RODS.map((d) => <path key={d} d={d} />)}
        </g>
      ) : (
        <ellipse className="schematic__dimple" cx={160} cy={95} rx={30} ry={22} />
      )}
      <Caption x={160} y={178} tone={sickled ? "harm" : "good"}>
        {sickled ? "Rigid, and damaged by every cycle" : "Soft enough to fold through a capillary"}
      </Caption>
    </Frame>
  );
}

/* ── The vessel ─────────────────────────────────────────────────────────── */

export function Vessel({ state }: SchematicProps) {
  const blocked = state === "occluded";
  return (
    <Frame label={blocked ? "Rigid cells occluding a small vessel" : "Blood flowing through a small vessel"}>
      {/* The vessel narrows to the right, as a capillary does. */}
      <path className="schematic__lumen" d="M12 52 C 110 52 176 74 308 78 L308 116 C 176 120 110 142 12 142 Z" />

      {blocked ? (
        <>
          <g className="schematic__jam">
            <path d="M148 78 C 166 66 190 62 214 68 C 194 82 190 96 214 110 C 184 116 158 104 148 78 Z" />
            <path d="M112 86 C 128 74 150 72 170 78 C 152 90 150 100 170 112 C 142 118 120 108 112 86 Z" />
          </g>
          <rect className="schematic__ischaemia" x={222} y={60} width={86} height={74} rx={10} />
          <Caption x={265} y={102} tone="harm" anchor="middle">no oxygen</Caption>
          <Caption x={160} y={178} tone="harm">Vaso-occlusion — this is the pain</Caption>
        </>
      ) : (
        <>
          {[46, 108, 170, 232].map((x, i) => (
            <ellipse key={x} className="schematic__flow-cell" cx={x} cy={97 + (i % 2 ? 4 : -4)} rx={16} ry={11} />
          ))}
          <Caption x={160} y={178} tone="good">Cells fold through and spring back</Caption>
        </>
      )}
    </Frame>
  );
}
