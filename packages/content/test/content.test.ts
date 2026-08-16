import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CITATIONS, citation, citationHref, formatCitation } from "../src/citations.js";
import { EXPLAINERS, NOTATION, firstLook } from "../src/guidance.js";
import { HONESTY } from "../src/honesty.js";
import { ORIENTATION } from "../src/tour.js";
import { STORY_TOURS, storyTour } from "../src/storyTours.js";
import { COMPARISONS, comparison, comparisonForStory } from "../src/comparisons.js";
import {
  citationSchema, honestySchema, LEVELS, storySchema, structureContentSchema,
} from "../src/schema.js";
import { STORIES, story, storyForStructure } from "../src/stories.js";
import { STRUCTURE_CONTENT, structureContent } from "../src/structures.js";

/** The emitted structure files — the ground truth every claim is checked against. */
interface Chain {
  id: string;
  seq: string;
  ss: string;
  res_nums: number[];
}
interface Structure {
  id: string;
  pdb_id: string;
  chains: Chain[];
}

function loadStructure(id: string): Structure {
  const path = fileURLToPath(new URL(`../../../data/structures/${id}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as Structure;
}

describe("schema conformance", () => {
  it("validates every citation", () => {
    for (const source of CITATIONS) expect(() => citationSchema.parse(source)).not.toThrow();
  });

  it("validates every story", () => {
    for (const entry of STORIES) expect(() => storySchema.parse(entry)).not.toThrow();
  });

  it("validates every structure entry", () => {
    for (const entry of STRUCTURE_CONTENT) {
      expect(() => structureContentSchema.parse(entry), entry.id).not.toThrow();
    }
  });

  it("validates the honesty panel", () => {
    expect(() => honestySchema.parse(HONESTY)).not.toThrow();
  });
});

/**
 * The test that earns the content its place.
 *
 * Prose about a molecule is the easiest thing in this project to get quietly
 * wrong — nothing crashes when a residue number is off by one. Every residue an
 * annotation names is looked up in the emitted structure and checked against the
 * amino acid the text claims is there.
 */
describe("residue claims match the structures", () => {
  for (const entry of STRUCTURE_CONTENT) {
    describe(entry.id, () => {
      const structure = loadStructure(entry.id);

      for (const annotation of entry.annotations) {
        for (const claim of annotation.residues) {
          it(`${annotation.label}: ${claim.chain}${claim.resNum} is ${claim.code}`, () => {
            const chain = structure.chains.find((c) => c.id === claim.chain);
            expect(chain, `chain ${claim.chain} exists in ${entry.id}`).toBeDefined();

            const index = chain!.res_nums.indexOf(claim.resNum);
            expect(index, `residue ${claim.resNum} is present`).toBeGreaterThanOrEqual(0);
            expect(chain!.seq[index]).toBe(claim.code);
          });
        }
      }
    });
  }
});

describe("cross-references resolve", () => {
  it("gives every structure in the library editorial content", () => {
    const stories = new Set(STORIES.flatMap((s) => s.structures));
    for (const id of stories) {
      expect(structureContent(id), `content for ${id}`).toBeDefined();
    }
  });

  it("puts every structure entry in a story that lists it", () => {
    for (const entry of STRUCTURE_CONTENT) {
      const parent = story(entry.story);
      expect(parent, `story ${entry.story}`).toBeDefined();
      expect(parent!.structures).toContain(entry.id);
    }
  });

  it("resolves every citation reference", () => {
    const referenced = [
      ...STORIES.flatMap((s) => s.citations),
      ...STRUCTURE_CONTENT.flatMap((s) => s.citations),
      ...STRUCTURE_CONTENT.flatMap((s) =>
        s.annotations.map((a) => a.citation).filter((c): c is string => c !== undefined),
      ),
    ];
    for (const id of referenced) expect(citation(id), `citation ${id}`).toBeDefined();
  });

  it("uses every citation it defines", () => {
    // An unused citation is usually a claim that got edited away, leaving the
    // source behind and the new claim unsourced.
    const referenced = new Set([
      ...STORIES.flatMap((s) => s.citations),
      ...STRUCTURE_CONTENT.flatMap((s) => s.citations),
      ...STRUCTURE_CONTENT.flatMap((s) =>
        s.annotations.map((a) => a.citation).filter((c): c is string => c !== undefined),
      ),
    ]);
    // The methodological sources are cited by the honesty panel in prose.
    const methodological = new Set([
      "kohn-2004-denatured", "plaxco-1998-contact-order", "kabsch-1983-dssp",
    ]);
    for (const source of CITATIONS) {
      if (methodological.has(source.id)) continue;
      expect(referenced.has(source.id), `${source.id} is cited somewhere`).toBe(true);
    }
  });

  it("finds the story for a structure", () => {
    expect(storyForStructure("nbd1-df508")?.id).toBe("cystic-fibrosis");
    expect(storyForStructure("nonsense")).toBeUndefined();
  });
});

describe("writing quality gates", () => {
  it("writes all three reading levels for every story and structure", () => {
    for (const entry of [...STORIES, ...STRUCTURE_CONTENT]) {
      for (const level of LEVELS) {
        expect(entry.summary[level].length, `${entry.id} · ${level}`).toBeGreaterThan(40);
      }
    }
  });

  it("pitches the lay text more simply than the researcher text", () => {
    // A crude proxy, but it catches the common failure: writing one register
    // and pasting it into all three slots.
    for (const entry of STRUCTURE_CONTENT) {
      expect(entry.summary.lay, entry.id).not.toBe(entry.summary.researcher);
      expect(entry.summary.lay, entry.id).not.toBe(entry.summary.student);
    }
  });

  it("keeps taglines short enough to sit under a heading", () => {
    for (const entry of STRUCTURE_CONTENT) {
      expect(entry.tagline.length, entry.id).toBeLessThanOrEqual(90);
    }
  });

  it("gives every story at least two things a reader should be able to do", () => {
    for (const entry of STORIES) expect(entry.objectives.length).toBeGreaterThanOrEqual(2);
  });

  it("discloses a caveat for every structure that cannot be animated", () => {
    // The reader is owed an explanation for a dead timeline.
    for (const id of ["hbs-deoxy", "cftr-full", "mpro-dimer"]) {
      const entry = structureContent(id)!;
      const subjects = entry.caveats.map((c) => c.subject.toLowerCase());
      expect(subjects.some((s) => s.includes("animation")), id).toBe(true);
    }
  });

  it("discloses the solubilising mutations on the ΔF508 construct", () => {
    // Differences from wild type are not attributable to the deletion alone,
    // and a reader comparing the two structures must be told.
    const entry = structureContent("nbd1-df508")!;
    expect(entry.caveats.some((c) => /solubilis/i.test(c.text))).toBe(true);
  });
});

describe("the honesty panel", () => {
  it("names what is real and what is not, at similar length", () => {
    // A long list of guarantees and a one-line disclaimer is a way of not
    // saying something.
    expect(HONESTY.real.length).toBeGreaterThanOrEqual(4);
    expect(HONESTY.illustration.length).toBeGreaterThanOrEqual(4);
  });

  it("says the folding path has never been observed", () => {
    const text = HONESTY.illustration.map((i) => i.text).join(" ").toLowerCase();
    expect(text).toMatch(/never .*observed|not a recording/);
  });

  it("says this is not a medical device", () => {
    expect(HONESTY.limits.join(" ")).toMatch(/not a medical device/i);
  });

  it("states the ACMG limit on structural evidence", () => {
    expect(HONESTY.limits.join(" ")).toMatch(/PP3|BP4|ACMG/);
  });

  it("admits the side-chain limitation", () => {
    expect(HONESTY.limits.join(" ")).toMatch(/side chain|side-chain/i);
  });
});

describe("citation formatting", () => {
  it("formats in a style a medical reader expects", () => {
    const formatted = formatCitation(citation("owen-2021-nirmatrelvir")!);
    expect(formatted).toMatch(/^Owen DR.*Science\. 2021\.$/);
  });

  it("links a DOI or falls back to a URL", () => {
    expect(citationHref(citation("owen-2021-nirmatrelvir")!)).toMatch(/^https:\/\/doi\.org\//);
    expect(citationHref(citation("nagar-2002-imatinib")!)).toMatch(/^https:\/\//);
  });

  it("has no duplicate identifiers", () => {
    expect(new Set(CITATIONS.map((c) => c.id)).size).toBe(CITATIONS.length);
  });
});

describe("the explain layer", () => {
  it("keys every shape the renderer can draw", () => {
    expect(NOTATION.map((n) => n.shape).sort()).toEqual(["coil", "helix", "strand"]);
  });

  it("says what each shape means and why it matters", () => {
    for (const entry of NOTATION) {
      expect(entry.meaning.length, entry.id).toBeGreaterThan(40);
      // The half usually missing: what the shape tells you, not just what it is.
      expect(entry.soWhat.length, entry.id).toBeGreaterThan(40);
    }
  });

  it("explains every read-out the interface shows", () => {
    // Adding a stat without an explainer is how a panel becomes unreadable.
    expect(EXPLAINERS.map((e) => e.id).sort()).toEqual(["buried", "contacts", "radius", "rmsd"]);
  });

  it("says what rising and falling mean, not only what the number is", () => {
    for (const entry of EXPLAINERS) {
      for (const level of LEVELS) {
        expect(entry.what[level].length, `${entry.id} · ${level}`).toBeGreaterThan(40);
      }
      expect(entry.rising.length, entry.id).toBeGreaterThan(25);
      expect(entry.falling.length, entry.id).toBeGreaterThan(25);
    }
  });

  it("gives every structure exactly three things to look at first", () => {
    // Fixed and short, like "rate, rhythm, axis". A longer list is a list
    // nobody reads.
    for (const entry of STRUCTURE_CONTENT) {
      expect(firstLook(entry.id).length, entry.id).toBe(3);
    }
  });

  it("verifies every residue a first-look item points at", () => {
    for (const entry of STRUCTURE_CONTENT) {
      const structure = loadStructure(entry.id);
      for (const item of firstLook(entry.id)) {
        if (item.residue === undefined) continue;
        const chain = structure.chains.find((c) => c.id === item.residue!.chain);
        expect(chain, `${entry.id} chain ${item.residue.chain}`).toBeDefined();
        const index = chain!.res_nums.indexOf(item.residue.resNum);
        expect(index, `${entry.id} residue ${item.residue.resNum}`).toBeGreaterThanOrEqual(0);
        expect(chain!.seq[index], `${entry.id} ${item.residue.resNum}`).toBe(item.residue.code);
      }
    }
  });
});

describe("the orientation tour", () => {
  it("stays short enough to finish", () => {
    // A tour longer than this is a tour people abandon halfway, which is
    // worse than no tour: they leave believing they have seen it.
    expect(ORIENTATION.length).toBeLessThanOrEqual(6);
    expect(ORIENTATION.length).toBeGreaterThanOrEqual(4);
  });

  it("has unique step ids", () => {
    expect(new Set(ORIENTATION.map((s) => s.id)).size).toBe(ORIENTATION.length);
  });

  it("anchors every step to a class selector in the app shell", () => {
    for (const step of ORIENTATION) {
      expect(step.anchor.kind, step.id).toBe("element");
      if (step.anchor.kind !== "element") continue;
      expect(step.anchor.selector, step.id).toMatch(/^\.[a-z][\w-]*$/);
    }
  });

  it("writes every step at all three reading levels", () => {
    for (const step of ORIENTATION) {
      for (const level of LEVELS) {
        expect(step.copy[level].length, `${step.id} · ${level}`).toBeGreaterThan(40);
      }
      expect(step.title.length, step.id).toBeGreaterThan(10);
    }
  });

  it("keeps the copy short enough to read standing up", () => {
    // This is an on-ramp, not the teaching. Anything longer belongs in a
    // story tour the reader chose to start.
    for (const step of ORIENTATION) {
      expect(step.copy.lay.length, step.id).toBeLessThan(260);
    }
  });

  it("ends on the honesty panel", () => {
    // The last thing a first-time reader is told should be how to find out
    // what is real, because everything before it invited them to believe.
    expect(ORIENTATION.at(-1)!.id).toBe("honesty");
  });

  it("uses only placements the card knows how to render", () => {
    for (const step of ORIENTATION) {
      expect(["right", "left", "above", "below"]).toContain(step.placement);
    }
  });
});

/**
 * Story tours drive the application, so a wrong residue here is a tour that
 * confidently points at the wrong atom. Held to the same standard as the
 * annotations: every residue is looked up in the structure file.
 */
describe("story tours", () => {
  it("provides a tour for every clinical story", () => {
    for (const entry of STORIES) {
      expect(storyTour(entry.id), `tour for ${entry.id}`).toBeDefined();
    }
  });

  it("verifies every residue a step points at", () => {
    for (const tour of STORY_TOURS) {
      for (const step of tour.steps) {
        if (step.anchor.kind !== "residue") continue;
        const structureId = step.view?.structure;
        expect(structureId, `${tour.id}/${step.id} names a structure`).toBeDefined();

        const structure = loadStructure(structureId!);
        const chain = structure.chains.find((c) => c.id === step.anchor.chain);
        expect(chain, `${tour.id}/${step.id}: chain ${step.anchor.chain}`).toBeDefined();

        const index = chain!.res_nums.indexOf(step.anchor.resNum);
        expect(index, `${tour.id}/${step.id}: residue ${step.anchor.resNum}`)
          .toBeGreaterThanOrEqual(0);
        expect(chain!.seq[index], `${tour.id}/${step.id}`).toBe(step.anchor.code);
      }
    }
  });

  it("only names structures that exist in its own story", () => {
    // A tour that wanders into another story's structures has lost its thread.
    for (const tour of STORY_TOURS) {
      const owned = new Set(story(tour.id)!.structures);
      for (const step of tour.steps) {
        if (step.view?.structure === undefined) continue;
        expect(owned.has(step.view.structure), `${tour.id}/${step.id}`).toBe(true);
      }
    }
  });

  it("keeps every timeline position in range", () => {
    for (const tour of STORY_TOURS) {
      for (const step of tour.steps) {
        if (step.view?.progress === undefined) continue;
        expect(step.view.progress).toBeGreaterThanOrEqual(0);
        expect(step.view.progress).toBeLessThanOrEqual(1);
      }
    }
  });

  it("uses only colour modes the renderer knows", () => {
    const known = new Set([
      "structure", "direction", "hydropathy", "charge", "flexibility", "burial", "chain",
    ]);
    for (const tour of STORY_TOURS) {
      for (const step of tour.steps) {
        if (step.view?.color === undefined) continue;
        expect(known.has(step.view.color), `${tour.id}/${step.id}: ${step.view.color}`).toBe(true);
      }
    }
  });

  it("writes every step at all three reading levels", () => {
    for (const tour of STORY_TOURS) {
      for (const step of tour.steps) {
        for (const level of LEVELS) {
          expect(step.copy[level].length, `${tour.id}/${step.id} · ${level}`).toBeGreaterThan(40);
        }
      }
    }
  });

  it("stays between five and nine beats", () => {
    // Short enough to hold attention, long enough to carry a mechanism.
    for (const tour of STORY_TOURS) {
      expect(tour.steps.length, tour.id).toBeGreaterThanOrEqual(5);
      expect(tour.steps.length, tour.id).toBeLessThanOrEqual(9);
    }
  });

  it("has unique step ids within each tour", () => {
    for (const tour of STORY_TOURS) {
      expect(new Set(tour.steps.map((s) => s.id)).size, tour.id).toBe(tour.steps.length);
    }
  });

  it("ends each tour in the clinic, not in the structure", () => {
    // A tour that stops at the geometry has not finished the job. The last
    // beat must connect to something a doctor recognises.
    const clinical = /crisis|hypoxia|corrector|potentiator|therapy|drug|tablet|prescrib|treat|design/i;
    for (const tour of STORY_TOURS) {
      const final = tour.steps.at(-1)!;
      const text = `${final.title} ${final.copy.student}`;
      expect(clinical.test(text), `${tour.id} ends on: ${final.title}`).toBe(true);
    }
  });
});

describe("curated comparisons", () => {
  it("offers a comparison for every story", () => {
    for (const entry of STORIES) {
      expect(comparisonForStory(entry.id), entry.id).toBeDefined();
    }
  });

  it("names two structures from its own story", () => {
    for (const pair of COMPARISONS) {
      const owned = new Set(story(pair.story)!.structures);
      expect(owned.has(pair.left), `${pair.id} left`).toBe(true);
      expect(owned.has(pair.right), `${pair.id} right`).toBe(true);
      expect(pair.left).not.toBe(pair.right);
    }
  });

  it("picks a chain that exists in both structures", () => {
    for (const pair of COMPARISONS) {
      expect(loadStructure(pair.left).chains.length, `${pair.id} left`)
        .toBeGreaterThan(pair.chain);
      expect(loadStructure(pair.right).chains.length, `${pair.id} right`)
        .toBeGreaterThan(pair.chain);
    }
  });

  it("compares haemoglobin on the chain that actually carries the mutation", () => {
    // Chain A is the alpha chain and carries no substitution at all. Comparing
    // on it would superpose two identical molecules and teach nothing.
    const pair = comparison("hba-hbs")!;
    const left = loadStructure(pair.left).chains[pair.chain]!;
    const right = loadStructure(pair.right).chains[pair.chain]!;
    const at6 = (c: typeof left) => c.seq[c.res_nums.indexOf(6)];
    expect(at6(left)).toBe("E");
    expect(at6(right)).toBe("V");
  });

  it("says what does not change, not only what does", () => {
    // For three of these four the clinical lesson is what has *not* moved. A
    // comparison that only lists differences teaches the opposite.
    for (const pair of COMPARISONS) {
      expect(pair.unchanged.length, `${pair.id}`).toBeGreaterThanOrEqual(2);
      expect(pair.differs.length, `${pair.id}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("writes every summary at all three reading levels", () => {
    for (const pair of COMPARISONS) {
      for (const level of LEVELS) {
        expect(pair.summary[level].length, `${pair.id} · ${level}`).toBeGreaterThan(40);
      }
    }
  });

  it("has unique ids", () => {
    expect(new Set(COMPARISONS.map((c) => c.id)).size).toBe(COMPARISONS.length);
  });
});
