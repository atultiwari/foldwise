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
export const ORIENTATION_VERSION = 2;

export const ORIENTATION: readonly TourStep[] = [
  {
    id: "library",
    anchor: { kind: "element", selector: ".library" },
    title: "Start with a disease, not a protein",
    copy: {
      lay: "The list is grouped by illness. Pick the condition you want to understand and the right molecules come with it.",
      student: "Structures are grouped by clinical story rather than by fold class. Each story pairs a wild type with the variant or drug complex that explains it.",
      researcher: "Curated pairs per story: wild type, variant, resistance and context entries, chosen so the comparison carries the mechanism.",
    },
    placement: "right",
  },
  {
    id: "stage",
    anchor: { kind: "element", selector: ".stage" },
    title: "The model is real, and you can handle it",
    copy: {
      lay: "Drag to turn it, scroll to zoom, hover to see which building block you are pointing at. These are real measured coordinates, not a drawing.",
      student: "Deposited coordinates from the Protein Data Bank. Drag to rotate, scroll to zoom, hover for residue identity and secondary structure.",
      researcher: "Coordinates as deposited. Hover picks the nearest α-carbon in screen space; the panel below reports chain, residue number and DSSP state.",
    },
    placement: "left",
  },
  {
    id: "transport",
    anchor: { kind: "element", selector: ".transport" },
    title: "Press play to watch it fold",
    copy: {
      lay: "This slider runs from a floppy, unfolded string to the finished shape. Space plays and pauses; the arrow keys step frame by frame.",
      student: "The timeline runs from a calibrated unfolded state to the deposited structure. Space plays, arrows step, Home and End jump to either end.",
      researcher: "96 or 192 frames depending on chain length, generated in a worker. Endpoints are real; the path between them is a model.",
    },
    placement: "above",
  },
  {
    id: "stats",
    anchor: { kind: "element", selector: ".stats" },
    title: "These numbers are measured, not written",
    copy: {
      lay: "Every number here is worked out from the shape currently on screen. Scrub the slider and watch them move. Tap any question mark to find out what one means.",
      student: "Computed live from the coordinates on screen, over every chain. Each carries an explainer covering what it is and what a rise or fall means.",
      researcher: "Rg, RMSD after Kabsch superposition, fraction of native contacts including inter-chain, and buried fraction — recomputed per frame.",
    },
    placement: "left",
  },
  {
    id: "modes",
    anchor: { kind: "element", selector: ".modes" },
    title: "Three ways of looking",
    copy: {
      lay: "Fold shows it moving. Anatomy shows the finished shape close up. Chemistry shows which parts hide from water.",
      student: "Presets rather than settings: each tab sets representation, colouring and timeline position together to answer one question.",
      researcher: "Each preset bundles a representation, colour mode and timeline position. The underlying controls stay available beside the model.",
    },
    placement: "below",
  },
  {
    id: "honesty",
    anchor: { kind: "element", selector: ".honesty-link" },
    title: "Know what is real before you trust it",
    copy: {
      lay: "The shapes and the numbers are real. The animation between them is an educated guess, because nobody has ever watched a protein fold. This link says exactly which is which.",
      student: "Structures and measurements are real; the folding pathway is a model. This panel separates the two explicitly, and states what the tool must not be used for.",
      researcher: "Declares what is measured, what is modelled, and the limits — including that structural evidence maps to PP3/BP4 at most under ACMG/AMP.",
    },
    placement: "below",
  },
];
