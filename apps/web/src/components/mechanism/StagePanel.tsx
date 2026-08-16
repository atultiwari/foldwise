/**
 * What fills the middle of Mechanism mode.
 *
 * Two kinds of evidence, and the interface is explicit about which it is
 * showing. A structure stage is a real deposited model, flown to the residue
 * in question and dimmed everywhere else. A schematic stage is a drawing,
 * because fibre assembly, a red cell deforming and a vessel occluding have no
 * coordinate file and never will.
 *
 * Conflating the two is the one thing this view must not do — a reader who
 * cannot tell measurement from illustration learns to trust the wrong things.
 */

import { useEffect } from "react";

import type { Outcome, Panel } from "@foldwise/content";
import type { Stage } from "@foldwise/render";
import type { ColorModeKey, Structure } from "@foldwise/ui";

import { ResidueMarker } from "./ResidueMarker.js";
import { schematic } from "../../schematics/index.js";
import { resolveResidue } from "./focus.js";
import { useView } from "../../state/store.js";

interface StagePanelProps {
  readonly outcome: Outcome;
  /** Already resolved against the outcome, so the molecule tracks the controls. */
  readonly panel: Panel;
  readonly structure: Structure | null;
  readonly renderer: Stage | null;
}

export function StagePanel({ outcome, panel, structure, renderer }: StagePanelProps) {
  const setStructure = useView((s) => s.setStructure);
  const setProgress = useView((s) => s.setProgress);
  const setColor = useView((s) => s.setColor);
  const current = useView((s) => s.structure);
  const color = useView((s) => s.color);

  const wantsStructure = panel.kind === "structure" ? panel.structure : null;
  const wantsColor = panel.kind === "structure" ? panel.color : null;

  // Load whatever this stage needs. A structure stage always shows the folded
  // molecule: the mechanism is about the finished protein, not the route to it.
  useEffect(() => {
    if (wantsStructure === null) return;
    if (current !== wantsStructure) {
      setStructure(wantsStructure);
      setProgress(1);
    }
  }, [wantsStructure, current, setStructure, setProgress]);

  useEffect(() => {
    if (wantsColor === null || color === wantsColor) return;
    setColor(wantsColor as ColorModeKey);
  }, [wantsColor, color, setColor]);

  /**
   * Fly to the residue.
   *
   * Without this the view rings a residue at whole-molecule zoom, where a
   * single residue on a 574-residue tetramer is a few pixels across. That was
   * the concrete failure of the guided tour: "this is position β6", pointing
   * at something nobody could see.
   */
  useEffect(() => {
    if (renderer === null) return;
    if (panel.kind !== "structure" || structure === null) return;
    if (structure.id !== panel.structure) return;
    const ref = resolveResidue(structure, panel.focus);
    if (ref === null) return;
    renderer.focusOn(ref.chain, ref.residue, panel.radius);
  }, [renderer, structure, panel]);

  // A schematic stage covers the canvas, so a held focus would be invisible
  // and would then fight the next structure stage's framing.
  useEffect(() => {
    if (renderer === null || panel.kind === "structure") return;
    renderer.clearFocus();
  }, [renderer, panel.kind]);

  if (panel.kind === "structure") {
    const marker = structure === null || structure.id !== panel.structure
      ? null
      : resolveResidue(structure, panel.focus);
    return (
      <>
        {marker === null ? null : (
          <ResidueMarker
            renderer={renderer}
            chain={marker.chain}
            residue={marker.residue}
            claim={panel.focus}
          />
        )}
        <div className="stage-panel stage-panel--structure">
          <p className="stage-panel__provenance">
            Deposited structure · {structure?.pdb_id ?? "loading"}
            {structure !== null && structure.resolution !== null ? ` · ${structure.resolution} Å` : ""}
          </p>
        </div>
      </>
    );
  }

  const Drawing = schematic(panel.schematic);
  return (
    <div className="stage-panel stage-panel--schematic">
      {Drawing === undefined
        ? <p className="error">No diagram for &ldquo;{panel.schematic}&rdquo;.</p>
        : <Drawing state={outcome.state} />}
      <p className="stage-panel__provenance">
        Diagram — this scale has no structure to show
      </p>
    </div>
  );
}
