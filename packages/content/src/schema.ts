/**
 * The shape of everything written by hand.
 *
 * Editorial content is the part of this project most likely to be quietly
 * wrong: nothing crashes when a residue number is off by one or a mechanism is
 * misremembered. So the schema is built to make claims *checkable*, and
 * `test/content.test.ts` verifies them against the actual structure files —
 * an annotation that says "Thr315" fails if residue 315 is not a threonine.
 */

import { z } from "zod";

/**
 * Reading levels.
 *
 * The same fact, pitched three ways. This is not decoration: a first-year
 * medical student and a structural biologist need different sentences about
 * the same molecule, and writing only one of them excludes the other.
 */
export const LEVELS = ["lay", "student", "researcher"] as const;
export type Level = (typeof LEVELS)[number];

export const leveledText = z.object({
  lay: z.string().min(20),
  student: z.string().min(20),
  researcher: z.string().min(20),
});
export type LeveledText = z.infer<typeof leveledText>;

export const citationSchema = z.object({
  id: z.string().min(1),
  authors: z.string().min(3),
  title: z.string().min(5),
  journal: z.string().min(2),
  year: z.number().int().min(1950).max(2030),
  /** A DOI or a stable URL. Every claim that needs a source gets a real one. */
  doi: z.string().min(4).optional(),
  url: z.string().url().optional(),
}).refine((c) => c.doi !== undefined || c.url !== undefined, {
  message: "a citation needs a DOI or a URL",
});
export type Citation = z.infer<typeof citationSchema>;

/**
 * A claim about a specific residue, written so it can be checked.
 *
 * `resNum` is author numbering — the numbering a clinician or a paper would
 * use — and `code` is the one-letter amino acid it must be. The test looks it
 * up in the structure and fails if they disagree.
 */
export const residueClaimSchema = z.object({
  chain: z.string().min(1),
  resNum: z.number().int(),
  code: z.string().length(1),
});
export type ResidueClaim = z.infer<typeof residueClaimSchema>;

export const annotationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(3),
  description: z.string().min(20),
  /** Residues this annotation points at, each independently verifiable. */
  residues: z.array(residueClaimSchema).min(1),
  citation: z.string().optional(),
});
export type Annotation = z.infer<typeof annotationSchema>;

/**
 * Something the interface shows that is not a measurement.
 *
 * Every estimate in the app must have one of these. If an honest sentence
 * cannot be written about a number, the number does not get displayed.
 */
export const caveatSchema = z.object({
  subject: z.string().min(3),
  text: z.string().min(30),
});
export type Caveat = z.infer<typeof caveatSchema>;

export const structureContentSchema = z.object({
  /** Must match a structure id emitted by the pipeline. */
  id: z.string().min(1),
  story: z.string().min(1),
  name: z.string().min(2),
  /** One line, shown under the name. */
  tagline: z.string().min(10).max(90),
  role: z.enum(["wild-type", "variant", "resistance", "context"]),
  summary: leveledText,
  /** The one thing worth remembering. */
  keyFact: z.string().min(20),
  annotations: z.array(annotationSchema).default([]),
  caveats: z.array(caveatSchema).default([]),
  citations: z.array(z.string()).default([]),
});
export type StructureContent = z.infer<typeof structureContentSchema>;

export const storySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(3),
  /** The clinical question this story answers. */
  question: z.string().min(15),
  summary: leveledText,
  /** Structure ids, in the order they should be read. */
  structures: z.array(z.string().min(1)).min(1),
  /** What a reader should be able to do afterwards. */
  objectives: z.array(z.string().min(15)).min(2),
  citations: z.array(z.string()).default([]),
});
export type Story = z.infer<typeof storySchema>;

export const honestySchema = z.object({
  real: z.array(z.object({ title: z.string().min(3), text: z.string().min(30) })).min(3),
  illustration: z.array(z.object({ title: z.string().min(3), text: z.string().min(30) })).min(3),
  limits: z.array(z.string().min(20)).min(3),
});
export type Honesty = z.infer<typeof honestySchema>;
