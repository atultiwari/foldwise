/**
 * The content package names schematics by string, so nothing type-checks the
 * join between a mechanism stage and the drawing that renders it. A stage
 * pointing at a schematic that does not exist would show a blank panel with a
 * confident caption under it — exactly the failure this whole view was built
 * to fix.
 *
 * These tests close that gap in both directions.
 */

import { describe, expect, it } from "vitest";

import { MECHANISMS } from "@foldwise/content";

import { SCHEMATICS } from "../src/schematics/index.js";

/** Every schematic a mechanism asks for, with the states it asks for. */
function requested(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const mechanism of MECHANISMS) {
    for (const stage of mechanism.stages) {
      if (stage.panel.kind !== "schematic") continue;
      const states = out.get(stage.panel.schematic) ?? new Set<string>();
      for (const outcome of stage.outcomes) states.add(outcome.state);
      out.set(stage.panel.schematic, states);
    }
  }
  return out;
}

describe("schematic registry", () => {
  it("has a drawing for every schematic a mechanism names", () => {
    for (const id of requested().keys()) {
      expect(SCHEMATICS[id], `no schematic called "${id}"`).toBeDefined();
    }
  });

  it("defines no drawing nothing asks for", () => {
    // An orphaned drawing is usually a stage that was renamed, leaving the old
    // one behind and the new one missing.
    const asked = requested();
    for (const id of Object.keys(SCHEMATICS)) {
      expect(asked.has(id), `nothing renders "${id}"`).toBe(true);
    }
  });

  it("renders every state without throwing", () => {
    // These are pure functions of one string, so calling them directly is
    // enough — no DOM required to prove they handle each state.
    for (const [id, states] of requested()) {
      for (const state of states) {
        expect(() => SCHEMATICS[id]!({ state }), `${id} · ${state}`).not.toThrow();
      }
    }
  });

  it("draws something different for each state a stage can be in", () => {
    // A schematic that ignores its state is a picture the controls cannot
    // change, which is the difference between a tool and a poster.
    for (const [id, states] of requested()) {
      if (states.size < 2) continue;
      const rendered = new Set(
        [...states].map((state) => JSON.stringify(SCHEMATICS[id]!({ state }))),
      );
      expect(rendered.size, `${id} draws the same thing for every state`).toBe(states.size);
    }
  });
});
