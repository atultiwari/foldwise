/**
 * Mechanisms: the causal chain a clinician actually reasons along.
 *
 * The rest of this application is structure-first with clinical text attached.
 * That is the wrong way round for its readers. A doctor reasons
 *
 *     gene → protein → trigger → assembly → cell → patient
 *
 * and the atomic model can only show *one link* of that. Fibre formation, a red
 * cell deforming, a vessel occluding — none of those are atomic-scale, so no
 * amount of 3D will ever show them.
 *
 * So a mechanism is a sequence of stages across scales, and the structure is
 * the evidence at one of them.
 *
 * The important part is that the reader **sets the causal variables**. A movie
 * with a next button is still watching. Choosing HbS and low oxygen and seeing
 * a fibre form — then raising the oxygen and seeing it not — is deriving why
 * crises are triggered by hypoxia. That is the difference between a diagram and
 * a tool.
 *
 * Every outcome here is a **model of established biology**, not a simulation.
 * Nothing is computed from physics; the rules encode what is known. The honesty
 * panel says so, and so does the interface.
 */

import type { LeveledText, ResidueClaim } from "./schema.js";

export type { LeveledText, ResidueClaim };

/** The scales a mechanism moves through, coarsest last. */
export const SCALES = ["gene", "protein", "assembly", "cell", "patient"] as const;
export type Scale = (typeof SCALES)[number];

export const SCALE_LABELS: Readonly<Record<Scale, string>> = {
  gene: "Gene",
  protein: "Protein",
  assembly: "Assembly",
  cell: "Cell",
  patient: "Patient",
};

export interface ControlOption {
  readonly value: string;
  readonly label: string;
  /** Shown under the control, in clinical terms. */
  readonly note?: string;
}

/** A variable the reader sets, whose effect propagates through every stage. */
export interface MechanismControl {
  readonly id: string;
  readonly label: string;
  readonly options: readonly ControlOption[];
  readonly initial: string;
}

/** Which control settings an outcome applies to. First match wins. */
export type ControlMatch = Readonly<Record<string, string>>;

export interface Outcome {
  /** Matches when every named control has the given value. Empty matches all. */
  readonly when: ControlMatch;
  /** Whether this is the pathological path or the safe one. */
  readonly tone: "harm" | "safe" | "neutral";
  readonly headline: string;
  readonly detail: LeveledText;
  /** Drives the schematic's state, e.g. "polymerised" or "dispersed". */
  readonly state: string;
  /**
   * A different molecule for this setting.
   *
   * Choosing HbS and then being shown HbA's glutamate would undo the whole
   * point of the controls, so an outcome may replace the stage's structure and
   * the residue it flies to. Everything omitted falls back to the stage.
   */
  readonly shows?: {
    readonly structure?: string;
    readonly focus?: ResidueClaim;
    readonly emphasise?: readonly ResidueClaim[];
  };
}

export interface StructurePanel {
  readonly kind: "structure";
  readonly structure: string;
  readonly focus: ResidueClaim;
  /** How much context to keep in view, in ångström. */
  readonly radius: number;
  readonly color: string;
  readonly emphasise?: readonly ResidueClaim[];
}

export interface SchematicPanel {
  readonly kind: "schematic";
  readonly schematic: string;
}

export type Panel = StructurePanel | SchematicPanel;

export interface MechanismStage {
  readonly id: string;
  readonly scale: Scale;
  readonly title: string;
  /** Which panel fills the stage: the real structure, or a drawn schematic. */
  readonly panel: Panel;
  /** At least one, and the last must match anything. */
  readonly outcomes: readonly Outcome[];
}

export interface Mechanism {
  /** Matches a story id. */
  readonly id: string;
  readonly title: string;
  /** The question the whole chain answers. */
  readonly question: string;
  readonly controls: readonly MechanismControl[];
  readonly stages: readonly MechanismStage[];
}

/** The outcome that applies at this stage for the current control settings. */
export function outcomeFor(
  stage: MechanismStage,
  state: Readonly<Record<string, string>>,
): Outcome {
  const match = stage.outcomes.find((outcome) =>
    Object.entries(outcome.when).every(([control, value]) => state[control] === value),
  );
  // The authoring rule is that the last outcome matches anything, so this
  // fallback should be unreachable; it exists so a mis-authored stage degrades
  // to showing something rather than crashing.
  return match ?? stage.outcomes[stage.outcomes.length - 1]!;
}

/**
 * The panel to show, once the outcome has had its say.
 *
 * Schematic stages ignore overrides — a drawing already varies by state.
 */
export function panelFor(stage: MechanismStage, outcome: Outcome): Panel {
  const { panel } = stage;
  if (panel.kind !== "structure" || outcome.shows === undefined) return panel;
  const { structure, focus, emphasise } = outcome.shows;
  return {
    ...panel,
    ...(structure === undefined ? {} : { structure }),
    ...(focus === undefined ? {} : { focus }),
    ...(emphasise === undefined ? {} : { emphasise }),
  };
}

/** Control values as the reader first meets them. */
export function initialState(mechanism: Mechanism): Record<string, string> {
  return Object.fromEntries(mechanism.controls.map((c) => [c.id, c.initial]));
}
