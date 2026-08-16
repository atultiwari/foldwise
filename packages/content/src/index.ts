/**
 * Editorial content: the writing that turns an instrument into a lesson.
 *
 * Data only — no React, no DOM. Residue claims are verified against the
 * emitted structure files in `test/content.test.ts`.
 */

export { LEVELS } from "./schema.js";
export type {
  Annotation, Caveat, Citation, Honesty, Level, LeveledText,
  ResidueClaim, Story, StructureContent,
} from "./schema.js";

export { CITATIONS, citation, citationHref, formatCitation } from "./citations.js";
export { STORIES, story, storyForStructure } from "./stories.js";
export { STRUCTURE_CONTENT, structureContent } from "./structures.js";
export { HONESTY } from "./honesty.js";

export { EXPLAINERS, FIRST_LOOK, NOTATION, explainer, firstLook } from "./guidance.js";
export type { Explainer, FirstLookItem, NotationEntry } from "./guidance.js";

export { ORIENTATION, ORIENTATION_VERSION } from "./tour.js";
export type { Anchor, ElementAnchor, ResidueAnchor, StepView, StoryTour, TourStep } from "./tour.js";

export { STORY_TOURS, storyTour } from "./storyTours.js";

export { COMPARISONS, comparison, comparisonForStory } from "./comparisons.js";
export type { ComparisonPair } from "./comparisons.js";

export { SCALES, SCALE_LABELS, initialState, outcomeFor, panelFor } from "./mechanism.js";
export type {
  ControlOption, Mechanism, MechanismControl, MechanismStage, Outcome, Panel, Scale,
  SchematicPanel, StructurePanel,
} from "./mechanism.js";
export { MECHANISMS, mechanism } from "./mechanisms.js";
