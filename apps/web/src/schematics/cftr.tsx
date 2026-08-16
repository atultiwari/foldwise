/**
 * Cystic fibrosis at the scales the structure cannot show.
 *
 * The whole clinical point of ΔF508 is that the channel would work — it never
 * arrives. That is a trafficking story, and no amount of looking at NBD1 will
 * ever show it. Hence three drawings: the journey out of the cell, what the
 * channel does when it gets there, and the airway that depends on it.
 */

import { Caption, Frame, type SchematicProps } from "./frame.js";

/* ── Trafficking ────────────────────────────────────────────────────────── */

export function Trafficking({ state }: SchematicProps) {
  const delivered = state === "delivered";
  const rescued = state === "rescued";
  const reaches = delivered || rescued;

  return (
    <Frame
      label={
        delivered ? "Correctly folded channel delivered to the cell surface"
          : rescued ? "A corrector allowing part of the channel to reach the surface"
            : "Misfolded channel destroyed before it reaches the surface"
      }
    >
      {/* The apical membrane, at the top: the destination. */}
      <rect className="schematic__membrane" x={12} y={20} width={296} height={14} rx={7} />
      <Caption x={160} y={14}>cell surface</Caption>

      {/* The ER, where the protein is made and inspected. */}
      <rect className="schematic__organelle" x={26} y={104} width={110} height={62} rx={14} />
      <Caption x={81} y={158}>ER · quality control</Caption>

      {/* The proteasome, where it is destroyed. */}
      <rect className="schematic__organelle schematic__organelle--harm" x={196} y={116} width={102} height={50} rx={12} />
      <Caption x={247} y={158} tone="harm">proteasome</Caption>

      {/* The route taken. */}
      <path
        className={`schematic__route${reaches ? " schematic__route--live" : ""}`}
        d="M81 104 C 81 76 110 56 150 42"
      />
      <path
        className={`schematic__route schematic__route--harm${reaches && !rescued ? "" : " schematic__route--live"}`}
        d="M136 138 L196 140"
      />

      {/* The protein itself. */}
      {reaches ? <circle className="schematic__cargo schematic__cargo--good" cx={152} cy={41} r={9} /> : null}
      {!delivered ? <circle className="schematic__cargo schematic__cargo--harm" cx={216} cy={140} r={9} /> : null}

      <Caption x={160} y={182} tone={delivered ? "good" : rescued ? "good" : "harm"}>
        {delivered ? "Passes inspection" : rescued ? "Some escapes degradation" : "Destroyed before delivery"}
      </Caption>
    </Frame>
  );
}

/* ── The channel ────────────────────────────────────────────────────────── */

export function Gate({ state }: SchematicProps) {
  const open = state === "open";
  const partial = state === "partial";
  const flowing = open || partial;
  const drops = open ? 5 : partial ? 3 : 0;

  return (
    <Frame
      label={
        open ? "Chloride leaving the cell and water following"
          : partial ? "Partly restored chloride secretion"
            : "No chloride secretion and a dehydrated surface"
      }
    >
      {/* Airway surface liquid, above the membrane: the thing that matters. */}
      <rect
        className={`schematic__fluid schematic__fluid--${open ? "full" : partial ? "part" : "thin"}`}
        x={12} y={open ? 20 : partial ? 32 : 48} width={296}
        height={open ? 44 : partial ? 32 : 16} rx={8}
      />
      <Caption x={160} y={14}>watery surface layer</Caption>

      <rect className="schematic__membrane" x={12} y={72} width={132} height={18} rx={9} />
      <rect className="schematic__membrane" x={176} y={72} width={132} height={18} rx={9} />

      {/* The channel sitting in the gap between the two membrane halves. */}
      <rect
        className={`schematic__channel${flowing ? " schematic__channel--open" : " schematic__channel--shut"}`}
        x={144} y={64} width={32} height={34} rx={6}
      />

      {flowing
        ? Array.from({ length: drops }, (_, i) => (
            <circle key={i} className="schematic__ion" cx={160} cy={60 - i * 11} r={4} />
          ))
        : <path className="schematic__blocked" d="M148 68 L172 94 M172 68 L148 94" />}

      <Caption x={160} y={124}>inside the cell</Caption>
      <Caption x={160} y={178} tone={open ? "good" : partial ? "good" : "harm"}>
        {open ? "Cl⁻ out, water follows"
          : partial ? "Enough flow to rehydrate the mucus"
            : "Surface dries; mucus turns sticky"}
      </Caption>
    </Frame>
  );
}

/* ── The airway ─────────────────────────────────────────────────────────── */

export function Airway({ state }: SchematicProps) {
  const clear = state === "clear";
  const improving = state === "improving";
  const mucus = clear ? 10 : improving ? 22 : 46;

  return (
    <Frame
      label={
        clear ? "A clear airway with mucus being swept out"
          : improving ? "An airway clearing better on treatment"
            : "An airway obstructed by thick mucus and infection"
      }
    >
      <rect className="schematic__airway" x={12} y={28} width={296} height={112} rx={16} />

      {/* Mucus, thickening downwards from the epithelium. */}
      <rect
        className={`schematic__mucus${clear ? "" : improving ? " schematic__mucus--thick" : " schematic__mucus--thickest"}`}
        x={20} y={132 - mucus} width={280} height={mucus} rx={6}
      />

      {/* Cilia. Upright when they can move, flattened when buried. */}
      <g className={`schematic__cilia${clear ? "" : improving ? " schematic__cilia--slow" : " schematic__cilia--stuck"}`}>
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} d={`M${30 + i * 20} 132 L${30 + i * 20 + (clear ? 5 : 1)} ${clear ? 112 : improving ? 120 : 128}`} />
        ))}
      </g>

      {!clear ? (
        <g className="schematic__bugs">
          {(improving ? [[86, 66], [206, 78]] : [[70, 58], [140, 74], [214, 56], [258, 84]]).map(
            ([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={improving ? 5 : 7} />,
          )}
        </g>
      ) : null}

      <Caption x={160} y={178} tone={clear ? "good" : improving ? "good" : "harm"}>
        {clear ? "Swept clean, continuously"
          : improving ? "Clearing better — fewer exacerbations"
            : "Trapped mucus, chronic infection, scarring"}
      </Caption>
    </Frame>
  );
}
