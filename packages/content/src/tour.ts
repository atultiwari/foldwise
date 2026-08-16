/**
 * The orientation tour.
 *
 * Six steps, once, under a minute. Deliberately **not** the whole app: this
 * answers "where am I and what can I touch", and nothing else. Everything about
 * how to *read* a molecule belongs to the story tours — conflating the two is
 * how you get the tour everyone skips.
 *
 * Anchors are CSS selectors into the application shell. They are the thing most
 * likely to rot as the interface changes, so the app checks them at runtime in
 * development and says so loudly rather than silently spotlighting nothing.
 */

import type { LeveledText } from "./schema.js";

export interface TourStep {
  readonly id: string;
  /** CSS selector for the element to spotlight. */
  readonly anchor: string;
  readonly title: string;
  readonly copy: LeveledText;
  /** Which side of the anchor the card sits on. */
  readonly placement: "right" | "left" | "above" | "below";
}

/**
 * Bumped when the steps change materially, so a rewritten tour re-fires for
 * people who have already seen the old one.
 */
export const ORIENTATION_VERSION = 1;

export const ORIENTATION: readonly TourStep[] = [
  {
    id: "library",
    anchor: ".library",
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
    anchor: ".stage",
    title: "The model is real, and you can handle it",
    copy: {
      lay: "Drag to turn it, scroll to zoom, hover to see which building block you are pointing at. These are real measured coordinates, not a drawing.",
      student: "Deposited coordinates from the Protein Data Bank. Drag to rotate, scroll to zoom, hover for residue identity and secondary structure.",
      researcher: "Coordinates as deposited. Hover picks the nearest α-carbon in screen space; the panel below reports residue number and DSSP state.",
    },
    placement: "left",
  },
  {
    id: "transport",
    anchor: ".transport",
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
    anchor: ".stats",
    title: "These numbers are measured, not written",
    copy: {
      lay: "Every number here is worked out from the shape currently on screen. Scrub the slider and watch them move. Tap any question mark to find out what one means.",
      student: "Computed live from the coordinates on screen, not looked up. Each carries an explainer covering what it is and what a rise or fall means.",
      researcher: "Rg, RMSD after Kabsch superposition, fraction of native contacts, and buried fraction from relative solvent accessibility — recomputed per frame.",
    },
    placement: "left",
  },
  {
    id: "modes",
    anchor: ".modes",
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
    anchor: ".honesty-link",
    title: "Know what is real before you trust it",
    copy: {
      lay: "The shapes and the numbers are real. The animation between them is an educated guess, because nobody has ever watched a protein fold. This link says exactly which is which.",
      student: "Structures and measurements are real; the folding pathway is a model. This panel separates the two explicitly, and states what the tool must not be used for.",
      researcher: "Declares what is measured, what is modelled, and the limits — including that structural evidence maps to PP3/BP4 at most under ACMG/AMP.",
    },
    placement: "below",
  },
];
