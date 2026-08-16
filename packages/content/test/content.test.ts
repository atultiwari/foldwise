import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CITATIONS, citation, citationHref, formatCitation } from "../src/citations.js";
import { HONESTY } from "../src/honesty.js";
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
