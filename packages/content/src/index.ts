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
export type { TourStep } from "./tour.js";
