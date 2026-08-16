/**
 * Guided tours.
 *
 * Two kinds, deliberately separate.
 *
 * The **orientation tour** answers "where am I and what can I touch": six
 * steps, once, under a minute. It teaches the interface and nothing else.
 *
 * A **story tour** is the actual teaching. It drives the whole application —
 * changing structure, moving the timeline, switching colouring, flying to a
 * residue — and explains what the reader is now looking at. Conflating the two
 * produces the tour everyone skips.
 *
 * A step is a view of the app plus an anchor plus copy. Nothing new is needed
 * to drive it: the store, the URL codec and the renderer's 3D-to-screen
 * projection already exist, which also means every step is a shareable link.
 */

import type { LeveledText, ResidueClaim } from "./schema.js";

/** Spotlight a piece of interface chrome. */
export interface ElementAnchor {
  readonly kind: "element";
  /** CSS selector into the application shell. */
  readonly selector: string;
}

/**
 * Point at a residue in the model.
 *
 * Chain and author residue number, with the amino acid it must be — verified
 * against the structure file exactly as the annotations are, so a tour that
 * says "Thr315" fails the build if residue 315 is not a threonine.
 */
export interface ResidueAnchor extends ResidueClaim {
  readonly kind: "residue";
}

export type Anchor = ElementAnchor | ResidueAnchor;

/** The slice of application state a step wants. */
export interface StepView {
  readonly structure?: string;
  /** Timeline position, 0 unfolded to 1 folded. */
  readonly progress?: number;
  readonly color?: string;
  readonly representation?: string;
}

export interface TourStep {
  readonly id: string;
  readonly anchor: Anchor;
  readonly title: string;
  readonly copy: LeveledText;
  readonly placement: "right" | "left" | "above" | "below";
  readonly view?: StepView;
}

export interface StoryTour {
  /** Matches a story id. */
  readonly id: string;
  readonly title: string;
  readonly steps: readonly TourStep[];
}

/**
 * Bumped when the orientation steps change materially, so a rewritten tour
 * re-fires for people who have already seen the old one.
 */
export const ORIENTATION_VERSION = 3;

/**
 * The on-ramp for a first visit.
 *
 * Rewritten for Mechanism mode, which is what a first-time reader now lands
 * on. The previous version walked through the timeline and the read-outs —
 * true, but it answered "what do these controls do?" when the question a
 * doctor actually arrives with is "what does this tell me about my patient?".
 */
export const ORIENTATION: readonly TourStep[] = [
  {
    id: "chain",
    anchor: { kind: "element", selector: ".chain" },
    title: "The whole story, gene to patient",
    copy: {
      lay: "Across the top is the chain of cause and effect, from the change in the gene all the way to what the patient feels. Click any link to go straight there.",
      student: "The causal chain, one step per scale: gene, protein, assembly, cell, patient. Every step is reachable directly — skip the ones you already know.",
      researcher: "Stages ordered by scale. The 3D model can only ever show the protein steps; the rest are drawn, and labelled as such.",
    },
    placement: "below",
  },
  {
    id: "controls",
    anchor: { kind: "element", selector: ".controls" },
    title: "Change the cause, not the slide",
    copy: {
      lay: "These are the things that actually decide what happens. Switch the oxygen from low to normal and watch the whole chain above change — that is why a crisis is triggered rather than constant.",
      student: "Set the genotype and the trigger, and every downstream step updates at once. Deriving why hypoxia precipitates a crisis beats being told it does.",
      researcher: "Control settings resolve an outcome at each stage. Nothing is simulated — the rules encode established biology and are cited.",
    },
    placement: "right",
  },
  {
    id: "stage",
    anchor: { kind: "element", selector: ".stage" },
    title: "Real structure, or an honest drawing",
    copy: {
      lay: "At the protein steps you are looking at a real measured molecule, flown right up to the building block being discussed and labelled. At the cell and patient steps there is nothing to measure, so you get a diagram — and it says so.",
      student: "Structure stages show deposited coordinates, focused on the residue under discussion with the rest dimmed. Schematic stages are drawn, because fibre assembly and vaso-occlusion have no coordinate file.",
      researcher: "Deposited coordinates with a camera fitted to the residue neighbourhood. The provenance line under the panel always states which kind you are looking at.",
    },
    placement: "left",
  },
  {
    id: "playback",
    anchor: { kind: "element", selector: ".playback" },
    title: "Step it, or let it run",
    copy: {
      lay: "Move through the chain one step at a time, or press play and let it walk itself. You can change the controls at any point without losing your place.",
      student: "Manual stepping or auto-advance at three speeds. Changing a control mid-chain re-resolves every stage without moving you.",
      researcher: "Stage and control state both live in the URL, so any point in the chain is a link.",
    },
    placement: "above",
  },
  {
    id: "modes",
    anchor: { kind: "element", selector: ".modes" },
    title: "And when you want the molecule itself",
    copy: {
      lay: "Fold plays the protein assembling itself. Anatomy shows the finished shape close up. Chemistry shows which parts hide from water.",
      student: "The other three tabs are presets over the same structure: each sets representation, colouring and timeline position to answer one question.",
      researcher: "Presets bundling representation, colour mode and timeline position. The underlying controls stay available beside the model.",
    },
    placement: "below",
  },
  {
    id: "honesty",
    anchor: { kind: "element", selector: ".honesty-link" },
    title: "Know what is real before you trust it",
    copy: {
      lay: "The shapes and the numbers are real. The animation between them is an educated guess, because nobody has ever watched a protein fold. This link says exactly which is which.",
      student: "Structures and measurements are real; the folding pathway and the mechanism outcomes are models. This panel separates them explicitly, and states what the tool must not be used for.",
      researcher: "Declares what is measured, what is modelled, and the limits — including that structural evidence maps to PP3/BP4 at most under ACMG/AMP.",
    },
    placement: "below",
  },
];
