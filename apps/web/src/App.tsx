import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { COLOR_MODES } from "@foldwise/render";
import { REPRESENTATIONS, coverage, unobservedResidues, type Structure } from "@foldwise/ui";

import {
  ORIENTATION, comparison, comparisonForStory, storyForStructure, storyTour,
  structureContent, type Level,
} from "@foldwise/content";
import type { Stage } from "@foldwise/render";

import { FirstLook, NotationKey } from "./components/Explain.js";
import { Compare } from "./components/Compare.js";
import { HonestySheet } from "./components/HonestySheet.js";
import { Library } from "./components/Library.js";
import { StoryPanel } from "./components/StoryPanel.js";
import { Tour, shouldAutoStart, type TourRun } from "./components/Tour.js";
import { ModeTabs } from "./components/ModeTabs.js";
import { ChainStepper } from "./components/mechanism/ChainStepper.js";
import { Controls } from "./components/mechanism/Controls.js";
import { Outcome } from "./components/mechanism/Outcome.js";
import { Playback, type Speed } from "./components/mechanism/Playback.js";
import { StagePanel } from "./components/mechanism/StagePanel.js";
import { resolveResidues } from "./components/mechanism/focus.js";
import { useMechanism } from "./components/mechanism/useMechanism.js";
import { Readouts, type Hit } from "./components/Readouts.js";
import { StageView } from "./components/StageView.js";
import { Transport } from "./components/Transport.js";
import { entryFor } from "./data/library.js";
import { useTrajectory } from "./fold/useTrajectory.js";
import { listenToHistory, useView } from "./state/store.js";
import type { ColorModeKey, Representation } from "@foldwise/ui";

/** The display name a comparison label should show. */
function appClass(comparing: boolean, layout: string, mechanism: boolean): string {
  if (comparing) {
    return layout === "side-by-side" ? "app app--comparing app--split" : "app app--comparing";
  }
  return mechanism ? "app app--mechanism" : "app";
}

function leftName(structureId: string): string {
  return structureContent(structureId)?.name ?? structureId;
}

export function App() {
  const view = useView();
  const [structure, setStructure] = useState<Structure | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<Hit | null>(null);
  const [speed, setSpeed] = useState(1);
  const [level, setLevel] = useState<Level>("student");
  const [honestyOpen, setHonestyOpen] = useState(false);
  const [tour, setTour] = useState<TourRun | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [chainPlaying, setChainPlaying] = useState(false);
  const [chainSpeed, setChainSpeed] = useState<Speed>(1);
  const pair = view.compare === "" ? undefined : comparison(view.compare);
  const run = useMechanism();
  const inMechanism = view.mode === "mechanism" && run !== null && pair === undefined;
  const [compareLayout, setCompareLayout] = useState<"side-by-side" | "superposed">("side-by-side");
  const stageRef = useRef<Stage | null>(null);
  const locate = useCallback(
    (chain: number, residue: number) => stageRef.current?.locate(chain, residue) ?? null,
    [],
  );
  const onStageReady = useCallback((next: Stage | null) => {
    stageRef.current = next;
    setStage(next);
  }, []);

  useEffect(() => listenToHistory(), []);

  // Offer the tour on a first visit, once the shell has painted so its
  // anchors can be measured.
  useEffect(() => {
    if (!shouldAutoStart()) return;
    const timer = setTimeout(() => setTour({ steps: ORIENTATION, kind: "orientation" }), 700);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const entry = entryFor(view.structure);
    if (entry === undefined) {
      setLoadError(`No structure called "${view.structure}".`);
      return;
    }
    setLoadError(null);
    entry.load().then(
      (loaded) => { if (!cancelled) setStructure(loaded); },
      (error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Could not load that structure.");
        }
      },
    );
    return () => { cancelled = true; };
  }, [view.structure]);

  const trajectory = useTrajectory(structure);

  /**
   * The residues Mechanism mode is talking about, so everything else can be
   * faded. Memoised by identity because StageView repaints the whole molecule
   * whenever this changes.
   */
  const emphasis = useMemo(() => {
    if (!inMechanism || structure === null) return null;
    const panel = run!.panel;
    if (panel.kind !== "structure" || structure.id !== panel.structure) return null;
    return resolveResidues(structure, [panel.focus, ...(panel.emphasise ?? [])]);
  }, [inMechanism, run?.panel, structure]);

  return (
    <div className={appClass(pair !== undefined, compareLayout, inMechanism)}>
      <header className="masthead">
        <div className="brand">
          <h1>Foldwise</h1>
          <p>From a change in the gene to what the patient feels</p>
        </div>
        <ModeTabs />
        <button
          type="button"
          className="masthead__link"
          onClick={() => setTour({ steps: ORIENTATION, kind: "orientation" })}
        >
          Show me around
        </button>
        <button type="button" className="honesty-link" onClick={() => setHonestyOpen(true)}>
          What&apos;s real here?
        </button>
      </header>

      <aside className="rail rail--left">
        {/* In Mechanism mode the controls come first: they are what the reader
            is here to change, and the library is how they switch topic. */}
        {inMechanism ? (
          <Controls mechanism={run!.mechanism} vars={run!.vars} onSet={run!.setVar} />
        ) : null}
        {pair === undefined ? <Library /> : null}
        {pair === undefined && !inMechanism ? (
        <StoryPanel
          structureId={view.structure}
          level={level}
          onLevel={setLevel}
          onStartTour={() => {
            const story = storyForStructure(view.structure);
            const found = story === undefined ? undefined : storyTour(story.id);
            if (found !== undefined) {
              setTour({ steps: found.steps, kind: "story", title: found.title });
            }
          }}
          onCompare={() => {
            const story = storyForStructure(view.structure);
            const found = story === undefined ? undefined : comparisonForStory(story.id);
            if (found !== undefined) {
              if (view.structure !== found.left) view.setStructure(found.left);
              // Both structures must be folded. Comparing a generated coil
              // against a deposited structure measures the coil, not the
              // difference between the two proteins.
              view.setProgress(1);
              view.setPlaying(false);
              view.setCompare(found.id);
            }
          }}
        />
        ) : null}
        {pair === undefined ? (
          inMechanism ? null : (
          <>
            <FirstLook structureId={view.structure} />
            <NotationKey />
          </>
          )
        ) : (
          <Compare
            pair={pair}
            left={structure}
            stage={stage}
            level={level}
            onClose={() => view.setCompare("")}
            onLayout={setCompareLayout}
          />
        )}
      </aside>

      <main className="centre">
        <StageView
          structure={structure}
          trajectory={trajectory}
          onHover={setHovered}
          onReady={onStageReady}
          emphasis={emphasis}
        />

        {inMechanism ? (
          <>
            <ChainStepper
              mechanism={run!.mechanism}
              current={run!.stageIndex}
              vars={run!.vars}
              onGo={run!.goTo}
            />
            <StagePanel
              outcome={run!.outcome}
              panel={run!.panel}
              structure={structure}
              renderer={stage}
            />
          </>
        ) : null}

        <div className="overlay overlay--top">
          {structure !== null ? (
            <div className="chip">
              <strong>{structure.pdb_id}</strong>
              <span>{structure.method}</span>
              {structure.resolution !== null ? <span>{structure.resolution} Å</span> : null}
            </div>
          ) : null}
        </div>

        <div className="overlay overlay--right" hidden={inMechanism}>
          <label>
            <span className="sr-only">Representation</span>
            <select
              value={view.representation}
              onChange={(e) => view.setRepresentation(e.target.value as Representation)}
            >
              {REPRESENTATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Colour by</span>
            <select
              value={view.color}
              onChange={(e) => view.setColor(e.target.value as ColorModeKey)}
            >
              {COLOR_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
        </div>

        {pair !== undefined && compareLayout === "side-by-side" ? (
          <div className="compare__labels" aria-hidden="true">
            <span>{leftName(pair.left)}</span>
            <span>{leftName(pair.right)}</span>
          </div>
        ) : null}

        {loadError !== null ? <p className="error" role="alert">{loadError}</p> : null}
      </main>

      <aside className="rail rail--right">
        {inMechanism ? (
          <Outcome
            stage={run!.stage}
            outcome={run!.outcome}
            level={level}
            onLevel={setLevel}
            stepOf={`${run!.stageIndex + 1} of ${run!.mechanism.stages.length}`}
          />
        ) : null}
        {structure !== null && !inMechanism ? (
          <>
            <Readouts
              structure={structure}
              trajectory={trajectory}
              progress={view.progress}
              hovered={hovered}
              level={level}
            />
            <section className="card">
              <h2>About this structure</h2>
              <p className="about__title">{structure.title.toLowerCase()}</p>
              <dl className="about">
                <dt>Organism</dt><dd>{structure.organism ?? "—"}</dd>
                <dt>Resolved</dt>
                <dd>
                  {Math.round(coverage(structure) * 100)}% of the deposited construct
                  {unobservedResidues(structure) > 0
                    ? ` · ${unobservedResidues(structure)} residues never seen`
                    : ""}
                </dd>
                <dt>Retrieved</dt><dd>{structure.provenance.retrieved}</dd>
              </dl>
              <p className="disclaimer">
                Structure and measurements are real. The folding path between the
                unfolded and folded states is a model — no protein&apos;s route has
                been observed.{" "}
                <button type="button" onClick={() => setHonestyOpen(true)}>
                  What&apos;s real here?
                </button>
              </p>
            </section>
          </>
        ) : null}
      </aside>

      <Tour
        run={tour}
        level={level}
        structure={structure}
        locate={locate}
        onClose={() => setTour(null)}
      />
      <HonestySheet open={honestyOpen} onClose={() => setHonestyOpen(false)} />

      <footer className="foot">
        {inMechanism ? (
          <Playback
            playing={chainPlaying}
            speed={chainSpeed}
            atStart={run!.atStart}
            atEnd={run!.atEnd}
            onPlay={(next) => {
              // "Play from the top" — restarting is more useful than a button
              // that does nothing once the chain has finished.
              if (next && run!.atEnd) run!.goTo(0);
              setChainPlaying(next);
            }}
            onSpeed={setChainSpeed}
            onNext={run!.next}
            onPrevious={run!.previous}
          />
        ) : (
          <Transport trajectory={trajectory} speed={speed} onSpeed={setSpeed} />
        )}
      </footer>
    </div>
  );
}
