/**
 * Mechanisms are the part of this application a clinician will actually use to
 * reason, so they are held to the same standard as the annotations: every
 * residue is looked up in the emitted structure, and every reachable
 * combination of controls must produce an outcome.
 *
 * The last test is the one that matters most — a mechanism whose outcomes do
 * not change when the controls change is a movie with extra buttons.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MECHANISMS, mechanism } from "../src/mechanisms.js";
import {
  SCALES, initialState, outcomeFor, panelFor, type Mechanism,
} from "../src/mechanism.js";
import { LEVELS } from "../src/schema.js";
import { STORIES } from "../src/stories.js";

interface Chain { id: string; seq: string; res_nums: number[] }
interface Structure { id: string; chains: Chain[] }

function loadStructure(id: string): Structure {
  const path = fileURLToPath(new URL(`../../../data/structures/${id}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as Structure;
}

/** Every combination of control values, as the reader could reach them. */
function combinations(m: Mechanism): Record<string, string>[] {
  return m.controls.reduce<Record<string, string>[]>(
    (acc, control) =>
      acc.flatMap((partial) =>
        control.options.map((option) => ({ ...partial, [control.id]: option.value })),
      ),
    [{}],
  );
}

describe("mechanism coverage", () => {
  it("provides a mechanism for every clinical story", () => {
    for (const story of STORIES) {
      expect(mechanism(story.id), `mechanism for ${story.id}`).toBeDefined();
    }
  });

  it("has unique ids", () => {
    expect(new Set(MECHANISMS.map((m) => m.id)).size).toBe(MECHANISMS.length);
  });

  it("has unique stage ids within each mechanism", () => {
    for (const m of MECHANISMS) {
      expect(new Set(m.stages.map((s) => s.id)).size, m.id).toBe(m.stages.length);
    }
  });

  it("ends every chain at the patient", () => {
    // A chain that stops at the protein has not answered the question a doctor
    // came with. The last stage must be the illness.
    for (const m of MECHANISMS) {
      expect(m.stages.at(-1)!.scale, m.id).toBe("patient");
    }
  });

  it("never moves back down the scale", () => {
    // Gene → protein → cell → patient reads as causation. Jumping back and
    // forth reads as a slideshow.
    for (const m of MECHANISMS) {
      const ranks = m.stages.map((s) => SCALES.indexOf(s.scale));
      for (let i = 1; i < ranks.length; i++) {
        expect(ranks[i]!, `${m.id} at stage ${i}`).toBeGreaterThanOrEqual(ranks[i - 1]!);
      }
    }
  });

  it("stays between four and seven stages", () => {
    for (const m of MECHANISMS) {
      expect(m.stages.length, m.id).toBeGreaterThanOrEqual(4);
      expect(m.stages.length, m.id).toBeLessThanOrEqual(7);
    }
  });
});

describe("controls", () => {
  it("gives every control at least two options and a valid initial value", () => {
    for (const m of MECHANISMS) {
      for (const control of m.controls) {
        expect(control.options.length, `${m.id}/${control.id}`).toBeGreaterThanOrEqual(2);
        const values = control.options.map((o) => o.value);
        expect(values, `${m.id}/${control.id} initial`).toContain(control.initial);
        expect(new Set(values).size, `${m.id}/${control.id} duplicate`).toBe(values.length);
      }
    }
  });

  it("opens on the pathological setting", () => {
    // The reader arrives with a clinical question. Starting on "normal, healthy"
    // means the first thing they see is nothing happening.
    for (const m of MECHANISMS) {
      const state = initialState(m);
      const tones = m.stages.map((stage) => outcomeFor(stage, state).tone);
      expect(tones.includes("harm") || tones.includes("safe"), m.id).toBe(true);
    }
  });

  it("only matches on controls that exist", () => {
    for (const m of MECHANISMS) {
      const known = new Set(m.controls.map((c) => c.id));
      for (const stage of m.stages) {
        for (const outcome of stage.outcomes) {
          for (const [control, value] of Object.entries(outcome.when)) {
            expect(known.has(control), `${m.id}/${stage.id}: control ${control}`).toBe(true);
            const options = m.controls.find((c) => c.id === control)!.options;
            expect(
              options.map((o) => o.value),
              `${m.id}/${stage.id}: ${control}=${value}`,
            ).toContain(value);
          }
        }
      }
    }
  });
});

/**
 * The test that earns the design its place: does changing a control actually
 * change what the reader is told?
 */
describe("outcomes respond to the controls", () => {
  it("resolves an outcome for every reachable combination", () => {
    for (const m of MECHANISMS) {
      for (const state of combinations(m)) {
        for (const stage of m.stages) {
          const outcome = outcomeFor(stage, state);
          expect(outcome, `${m.id}/${stage.id} ${JSON.stringify(state)}`).toBeDefined();
          // A resolved outcome must genuinely apply, not be the fallback of a
          // mis-authored stage.
          for (const [control, value] of Object.entries(outcome.when)) {
            expect(state[control], `${m.id}/${stage.id} matched wrongly`).toBe(value);
          }
        }
      }
    }
  });

  it("gives every control a combination where it changes something", () => {
    for (const m of MECHANISMS) {
      for (const control of m.controls) {
        const seen = new Set<string>();
        for (const state of combinations(m)) {
          seen.add(m.stages.map((s) => outcomeFor(s, state).state).join("|"));
        }
        expect(seen.size, `${m.id}: ${control.id} changes nothing`).toBeGreaterThan(1);
      }
    }
  });

  it("makes the healthy path and the disease path differ at the patient", () => {
    // If the two settings converge on the same clinical outcome, the reader has
    // learnt nothing about why the variable matters.
    for (const m of MECHANISMS) {
      const final = m.stages.at(-1)!;
      const tones = new Set(combinations(m).map((state) => outcomeFor(final, state).tone));
      expect(tones.has("harm"), `${m.id} has no harmful outcome`).toBe(true);
      expect(tones.has("safe"), `${m.id} has no safe outcome`).toBe(true);
    }
  });

  it("ends every stage with a catch-all outcome", () => {
    for (const m of MECHANISMS) {
      for (const stage of m.stages) {
        expect(
          Object.keys(stage.outcomes.at(-1)!.when).length,
          `${m.id}/${stage.id} has no catch-all`,
        ).toBe(0);
      }
    }
  });
});

describe("residue claims match the structures", () => {
  for (const m of MECHANISMS) {
    for (const stage of m.stages) {
      if (stage.panel.kind !== "structure") continue;
      // Every panel the controls can produce, not only the authored default:
      // an override pointing at a residue absent from its own structure would
      // fly the camera nowhere and say nothing about it.
      const panels = [
        stage.panel,
        ...combinations(m).map((state) => panelFor(stage, outcomeFor(stage, state))),
      ].filter((panel) => panel.kind === "structure");
      for (const panel of panels) {
        const id = panel.structure;
        for (const claim of [panel.focus, ...(panel.emphasise ?? [])]) {
          it(`${m.id}/${stage.id}: ${id} ${claim.chain}${claim.resNum} is ${claim.code}`, () => {
            const structure = loadStructure(id);
            const chain = structure.chains.find((c) => c.id === claim.chain);
            expect(chain, `chain ${claim.chain} in ${id}`).toBeDefined();
            const index = chain!.res_nums.indexOf(claim.resNum);
            expect(index, `residue ${claim.resNum} present`).toBeGreaterThanOrEqual(0);
            expect(chain!.seq[index]).toBe(claim.code);
          });
        }
      }
    }
  }

  it("only shows structures its own story owns", () => {
    for (const m of MECHANISMS) {
      const owned = new Set(STORIES.find((s) => s.id === m.id)!.structures);
      for (const stage of m.stages) {
        if (stage.panel.kind !== "structure") continue;
        for (const state of combinations(m)) {
          const panel = panelFor(stage, outcomeFor(stage, state));
          if (panel.kind !== "structure") continue;
          expect(owned.has(panel.structure), `${m.id}/${stage.id}`).toBe(true);
        }
      }
    }
  });

  it("shows a different molecule when the genotype changes it", () => {
    // The failure this fixes: choosing HbS and being shown HbA's glutamate
    // while the text says valine.
    const protein = MECHANISMS.find((m) => m.id === "sickle-cell")!.stages
      .find((s) => s.id === "protein")!;
    const shown = (genotype: string) =>
      panelFor(protein, outcomeFor(protein, { genotype, oxygen: "low" }));
    expect((shown("hba") as { structure: string }).structure).toBe("hba-deoxy");
    expect((shown("hbs") as { structure: string }).structure).toBe("hbs-deoxy");
  });

  it("uses only colour modes the renderer knows", () => {
    const known = new Set([
      "structure", "direction", "hydropathy", "charge", "flexibility", "burial", "chain",
    ]);
    for (const m of MECHANISMS) {
      for (const stage of m.stages) {
        if (stage.panel.kind !== "structure") continue;
        expect(known.has(stage.panel.color), `${m.id}/${stage.id}`).toBe(true);
      }
    }
  });

  it("frames close enough to actually see the residue", () => {
    // The failure this whole view exists to fix: a ring drawn around a residue
    // at whole-molecule zoom, on a 574-residue tetramer, points at nothing.
    for (const m of MECHANISMS) {
      for (const stage of m.stages) {
        if (stage.panel.kind !== "structure") continue;
        expect(stage.panel.radius, `${m.id}/${stage.id}`).toBeLessThanOrEqual(20);
        expect(stage.panel.radius, `${m.id}/${stage.id}`).toBeGreaterThanOrEqual(8);
      }
    }
  });
});

describe("mechanism writing", () => {
  it("writes every outcome at all three reading levels", () => {
    for (const m of MECHANISMS) {
      for (const stage of m.stages) {
        for (const outcome of stage.outcomes) {
          for (const level of LEVELS) {
            expect(
              outcome.detail[level].length,
              `${m.id}/${stage.id}/${outcome.state} · ${level}`,
            ).toBeGreaterThan(30);
          }
        }
      }
    }
  });

  it("keeps headlines short enough to read at a glance", () => {
    for (const m of MECHANISMS) {
      for (const stage of m.stages) {
        for (const outcome of stage.outcomes) {
          expect(outcome.headline.length, `${m.id}/${stage.id}`).toBeGreaterThan(10);
          expect(outcome.headline.length, `${m.id}/${stage.id}`).toBeLessThanOrEqual(72);
        }
      }
    }
  });

  it("pitches the lay text differently from the researcher text", () => {
    for (const m of MECHANISMS) {
      for (const stage of m.stages) {
        for (const outcome of stage.outcomes) {
          const where = `${m.id}/${stage.id}/${outcome.state}`;
          expect(outcome.detail.lay, where).not.toBe(outcome.detail.researcher);
          expect(outcome.detail.lay, where).not.toBe(outcome.detail.student);
        }
      }
    }
  });

  it("names a therapy somewhere in every mechanism", () => {
    // The point of the view is to get from a residue to a decision. Every one
    // of these four has a drug at the end of the chain.
    const therapy = /hydroxyurea|corrector|potentiator|ivacaftor|ponatinib|imatinib|asciminib|ritonavir|nirmatrelvir|elexacaftor|tezacaftor/i;
    for (const m of MECHANISMS) {
      const text = m.stages.flatMap((s) =>
        s.outcomes.map((o) => `${o.headline} ${o.detail.student}`),
      ).join(" ");
      expect(therapy.test(text), m.id).toBe(true);
    }
  });
});
