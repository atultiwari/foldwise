/**
 * Mechanism mode's state, derived from the URL.
 *
 * Everything the reader sets — which stage of the causal chain, and what the
 * causal variables are — lives in the address bar, for the same reason the
 * rest of the view does: a lecturer should be able to paste "sickle cell, low
 * oxygen, at the assembly step" into a message and have the class land on it.
 *
 * Nothing here is stored twice. The store is the single source, and this hook
 * only interprets it against the mechanism's own definition, clamping and
 * filtering as it goes — so a link that names a stage the mechanism does not
 * have, or a control it does not define, degrades instead of breaking.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  initialState, mechanism as mechanismFor, outcomeFor, panelFor, storyForStructure,
  type Mechanism, type MechanismStage, type Outcome, type Panel,
} from "@foldwise/content";
import { decodeVars, encodeVars } from "@foldwise/ui";

import { useView } from "../../state/store.js";

export interface MechanismRun {
  readonly mechanism: Mechanism;
  readonly stage: MechanismStage;
  readonly stageIndex: number;
  readonly outcome: Outcome;
  /** The stage's panel after the outcome has had its say. */
  readonly panel: Panel;
  /** Control settings, complete: every control the mechanism defines. */
  readonly vars: Readonly<Record<string, string>>;
  readonly setVar: (id: string, value: string) => void;
  readonly goTo: (index: number) => void;
  readonly next: () => void;
  readonly previous: () => void;
  readonly atStart: boolean;
  readonly atEnd: boolean;
}

/**
 * The mechanism for whatever structure is loaded, or null if that structure
 * has no clinical story behind it.
 */
export function useMechanism(): MechanismRun | null {
  const structure = useView((s) => s.structure);
  const stageParam = useView((s) => s.stage);
  const varsParam = useView((s) => s.vars);
  const setStage = useView((s) => s.setStage);
  const setVars = useView((s) => s.setVars);

  const story = storyForStructure(structure);
  const mechanism = story === undefined ? undefined : mechanismFor(story.id);

  // A link can name a stage this mechanism does not have — clamp rather than
  // render nothing.
  const stageIndex = mechanism === undefined
    ? 0
    : Math.min(Math.max(stageParam, 0), mechanism.stages.length - 1);

  /**
   * Authored defaults, overridden by anything the URL supplies that this
   * mechanism actually defines. Values it does not recognise are dropped, so
   * a stale link from another story cannot put a control into a state with no
   * outcome behind it.
   */
  const vars = useMemo(() => {
    if (mechanism === undefined) return {};
    const supplied = decodeVars(varsParam);
    const out = initialState(mechanism);
    for (const control of mechanism.controls) {
      const value = supplied[control.id];
      if (value !== undefined && control.options.some((o) => o.value === value)) {
        out[control.id] = value;
      }
    }
    return out;
  }, [mechanism, varsParam]);

  // Switching to another story leaves a stage index and control settings that
  // belonged to the previous one. Start the new chain at the top.
  const lastMechanism = useRef<string | null>(null);
  useEffect(() => {
    if (mechanism === undefined) return;
    if (lastMechanism.current === mechanism.id) return;
    const first = lastMechanism.current === null;
    lastMechanism.current = mechanism.id;
    // On a first render, honour whatever the link asked for.
    if (first) return;
    setStage(0);
    setVars("");
  }, [mechanism, setStage, setVars]);

  const setVar = useCallback((id: string, value: string) => {
    setVars(encodeVars({ ...vars, [id]: value }));
  }, [vars, setVars]);

  const goTo = useCallback((index: number) => {
    if (mechanism === undefined) return;
    setStage(Math.min(Math.max(index, 0), mechanism.stages.length - 1));
  }, [mechanism, setStage]);

  const next = useCallback(() => goTo(stageIndex + 1), [goTo, stageIndex]);
  const previous = useCallback(() => goTo(stageIndex - 1), [goTo, stageIndex]);

  if (mechanism === undefined) return null;

  const stage = mechanism.stages[stageIndex]!;
  const outcome = outcomeFor(stage, vars);
  return {
    mechanism,
    stage,
    stageIndex,
    outcome,
    panel: panelFor(stage, outcome),
    vars,
    setVar,
    goTo,
    next,
    previous,
    atStart: stageIndex === 0,
    atEnd: stageIndex === mechanism.stages.length - 1,
  };
}
