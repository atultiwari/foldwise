/**
 * The two drug stories at the scales above the binding site.
 *
 * A lock that a drug either fits or does not, a signal that is either running
 * or stopped, a polyprotein that is either cut or not, and the clinical course
 * that follows. Deliberately schematic: the real geometry is one click away in
 * the structure panel, and putting a cartoon beside it is what lets a reader
 * connect the two.
 */

import { Caption, Frame, type SchematicProps } from "./frame.js";

/* ── The binding pocket ─────────────────────────────────────────────────── */

/**
 * The pocket, with a gatekeeper that is either small or bulky.
 *
 * Drawn as a slab with a bay cut out of its top edge rather than as one
 * even-odd path — a filled rectangle over a filled rectangle is unambiguous,
 * and reads as a socket at any size.
 */
export function Lock({ state }: SchematicProps) {
  const blocked = state === "blocked";
  const fits = state === "fits";

  return (
    <Frame
      label={
        blocked ? "The drug cannot enter past the enlarged gatekeeper"
          : fits ? "The drug seated in the pocket"
            : "An empty pocket"
      }
    >
      <rect className="schematic__protein" x={24} y={72} width={272} height={86} rx={14} />
      {/* The bay, filled with the panel behind so it reads as cut away. */}
      <rect className="schematic__pocket" x={122} y={66} width={80} height={54} rx={8} />
      <Caption x={162} y={150}>binding pocket</Caption>

      {/* The gatekeeper residue, guarding the mouth. */}
      <circle
        className={`schematic__gatekeeper${blocked ? " schematic__gatekeeper--bulky" : ""}`}
        cx={122} cy={92} r={blocked ? 24 : 13}
      />
      <Caption x={82} y={96} anchor="end" tone={blocked ? "harm" : "soft"}>
        {blocked ? "Ile315" : "Thr315"}
      </Caption>

      {/* The drug: seated when it fits, held outside when it does not. */}
      {state !== "empty" ? (
        <g
          className={`schematic__drug${blocked ? " schematic__drug--rejected" : ""}`}
          style={{ transform: blocked ? "translate(0px, -74px)" : "translate(0px, 0px)" }}
        >
          <rect className="schematic__drug-body" x={140} y={76} width={46} height={36} rx={10} />
          {fits ? <path className="schematic__bond" d="M129 92 L140 94" /> : null}
        </g>
      ) : null}

      {blocked ? <path className="schematic__blocked" d="M146 44 L182 62 M182 44 L146 62" /> : null}

      <Caption x={160} y={178} tone={blocked ? "harm" : fits ? "good" : "soft"}>
        {blocked ? "No contact forms at all"
          : fits ? "Bound — the enzyme is jammed"
            : "Nothing bound"}
      </Caption>
    </Frame>
  );
}

/* ── Downstream signalling ──────────────────────────────────────────────── */

export function Signal({ state }: SchematicProps) {
  const running = state === "on";
  return (
    <Frame label={running ? "Growth signalling running unchecked" : "Growth signalling shut down"}>
      <rect className={`schematic__kinase${running ? " schematic__kinase--active" : ""}`} x={22} y={62} width={72} height={58} rx={14} />
      <Caption x={58} y={140}>BCR-ABL</Caption>

      <path className={`schematic__signal-arrow${running ? " schematic__signal-arrow--live" : ""}`} d="M100 91 L188 91" />
      {running
        ? [122, 152, 182].map((x) => <circle key={x} className="schematic__phosphate" cx={x} cy={91} r={5} />)
        : <path className="schematic__blocked" d="M128 76 L160 106 M160 76 L128 106" />}

      <circle className={`schematic__nucleus${running ? " schematic__nucleus--driven" : ""}`} cx={246} cy={91} r={40} />
      <Caption x={246} y={140}>cell division</Caption>

      <Caption x={160} y={178} tone={running ? "harm" : "good"}>
        {running ? "Unregulated proliferation" : "The clone stops expanding"}
      </Caption>
    </Frame>
  );
}

/* ── The viral polyprotein ──────────────────────────────────────────────── */

const CUT_SITES = [90, 140, 190, 240];

export function Polyprotein({ state }: SchematicProps) {
  const cut = state === "cut";
  return (
    <Frame
      label={cut ? "The polyprotein cut into working viral proteins" : "The polyprotein left uncut"}
    >
      <Caption x={160} y={34}>one long chain, made as a single piece</Caption>

      {/* The chain: separated segments once cut, a single bar when not. */}
      {[40, 90, 140, 190, 240].map((x, i) => (
        <rect
          key={x}
          className={`schematic__segment${cut ? " schematic__segment--released" : ""}`}
          x={x + (cut ? i * 2 : 0)} y={54} width={cut ? 44 : 50} height={30} rx={cut ? 8 : 2}
        />
      ))}

      {CUT_SITES.map((x) => (
        <path
          key={x}
          className={`schematic__scissor${cut ? " schematic__scissor--cut" : ""}`}
          d={`M${x} 46 L${x} 92`}
        />
      ))}

      {cut ? (
        <g className="schematic__machines">
          {[70, 140, 210].map((x) => <rect key={x} x={x} y={112} width={44} height={30} rx={8} />)}
          <Caption x={160} y={162} tone="harm">replication machinery assembled</Caption>
        </g>
      ) : (
        <Caption x={160} y={130} tone="good">Nothing is released — replication stops here</Caption>
      )}
    </Frame>
  );
}

/* ── The clinical course ────────────────────────────────────────────────── */

/** Disease burden over time — the only chart a clinician needs here. */
const FALLING = "M24 46 C 80 52 118 104 168 130 C 214 150 258 152 296 154";
const RISING = "M24 150 C 76 148 112 132 158 104 C 206 74 250 54 296 44";

export function Course({ state }: SchematicProps) {
  const good = state === "remission";
  return (
    <Frame label={good ? "Disease burden falling on treatment" : "Disease burden rising"}>
      <path className="schematic__axis" d="M24 158 L296 158 M24 158 L24 36" />
      <Caption x={16} y={34} anchor="start">burden</Caption>
      <Caption x={296} y={176} anchor="end">time</Caption>

      <path className={`schematic__course${good ? " schematic__course--good" : " schematic__course--harm"}`} d={good ? FALLING : RISING} />
      <circle className={`schematic__course-end${good ? " schematic__course-end--good" : " schematic__course-end--harm"}`} cx={296} cy={good ? 154 : 44} r={6} />

      <Caption x={160} y={178} tone={good ? "good" : "harm"}>
        {good ? "Controlled, and monitored" : "Loss of response — reassess the target"}
      </Caption>
    </Frame>
  );
}
