/**
 * The bridge between React and the renderer.
 *
 * React owns the panels; it does not own the canvas. The Stage is imperative
 * and keeps its own animation loop, and this component only pushes changes
 * into it — so a re-render of the sidebar never touches the render loop.
 */

import { useEffect, useRef } from "react";

import { Stage, colorResidues } from "@foldwise/render";
import { chainIndices, type Structure } from "@foldwise/ui";

import { frameOf, type TrajectoryState } from "../fold/useTrajectory.js";
import { useView } from "../state/store.js";

interface StageViewProps {
  readonly structure: Structure | null;
  readonly trajectory: TrajectoryState;
  readonly onHover: (residue: number | null) => void;
}

/** The panel colour the canvas sits on, so the two agree in either theme. */
function readPanelColour(element: HTMLElement): string {
  const value = getComputedStyle(element).getPropertyValue("--panel").trim();
  return value.length > 0 ? value : "#ffffff";
}

export function StageView({ structure, trajectory, onHover }: StageViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Stage | null>(null);

  const progress = useView((s) => s.progress);
  const representation = useView((s) => s.representation);
  const color = useView((s) => s.color);
  const setSelected = useView((s) => s.setSelected);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    // An explicit colour rather than a transparent canvas: the stage fills a
    // solid panel, so an alpha buffer would cost a per-pixel blend for nothing.
    const stage = new Stage(container, { background: readPanelColour(container) });
    stageRef.current = stage;
    stage.start();
    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, []);

  // Load geometry when the structure changes.
  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null || structure === null) return;
    stage.load(structure.chains.map((chain) => ({
      ca: chain.ca,
      secondaryStructure: chain.ss,
    })));
  }, [structure]);

  // Drive the conformation from the timeline.
  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null || structure === null) return;
    if (trajectory.status !== "ready") return;
    stage.setConformation(trajectory.chains.map((chain) => frameOf(chain, progress)));
  }, [structure, trajectory, progress]);

  useEffect(() => {
    stageRef.current?.setRepresentation(representation);
  }, [representation]);

  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null || structure === null) return;
    const chainOf = chainIndices(structure);
    let offset = 0;
    stage.setColors(structure.chains.map((chain) => {
      const slice = chainOf.subarray(offset, offset + chain.seq.length);
      offset += chain.seq.length;
      return colorResidues(color, {
        sequence: chain.seq,
        secondaryStructure: chain.ss,
        bFactors: chain.bf,
        chainOf: slice,
      });
    }));
  }, [structure, color, trajectory.status]);

  const dragging = useRef(false);

  return (
    <div
      ref={containerRef}
      className="stage"
      onPointerDown={() => { dragging.current = true; }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerLeave={() => { dragging.current = false; onHover(null); }}
      onPointerMove={(event) => {
        const stage = stageRef.current;
        if (stage === null) return;
        if (dragging.current) {
          stage.orbit(event.movementX * 0.006, event.movementY * 0.006);
          return;
        }
        const box = event.currentTarget.getBoundingClientRect();
        const hit = stage.pick(event.clientX - box.left, event.clientY - box.top);
        onHover(hit === null ? null : hit.residue);
      }}
      onClick={(event) => {
        const stage = stageRef.current;
        if (stage === null) return;
        const box = event.currentTarget.getBoundingClientRect();
        const hit = stage.pick(event.clientX - box.left, event.clientY - box.top);
        setSelected(hit === null ? -1 : hit.residue);
      }}
      onWheel={(event) => stageRef.current?.zoom(1 + event.deltaY * 0.001)}
    />
  );
}
