import { useEffect, useState } from "react";

import { COLOR_MODES } from "@foldwise/render";
import { REPRESENTATIONS, coverage, unobservedResidues, type Structure } from "@foldwise/ui";

import type { Level } from "@foldwise/content";

import { FirstLook, NotationKey } from "./components/Explain.js";
import { HonestySheet } from "./components/HonestySheet.js";
import { Library } from "./components/Library.js";
import { StoryPanel } from "./components/StoryPanel.js";
import { ModeTabs } from "./components/ModeTabs.js";
import { Readouts } from "./components/Readouts.js";
import { StageView } from "./components/StageView.js";
import { Transport } from "./components/Transport.js";
import { entryFor } from "./data/library.js";
import { useTrajectory } from "./fold/useTrajectory.js";
import { listenToHistory, useView } from "./state/store.js";
import type { ColorModeKey, Representation } from "@foldwise/ui";

export function App() {
  const view = useView();
  const [structure, setStructure] = useState<Structure | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [level, setLevel] = useState<Level>("student");
  const [honestyOpen, setHonestyOpen] = useState(false);

  useEffect(() => listenToHistory(), []);

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

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <h1>Foldwise</h1>
          <p>Watch real proteins fold — and see why it matters clinically</p>
        </div>
        <ModeTabs />
        <button type="button" className="honesty-link" onClick={() => setHonestyOpen(true)}>
          What&apos;s real here?
        </button>
      </header>

      <aside className="rail rail--left">
        <Library />
        <StoryPanel structureId={view.structure} level={level} onLevel={setLevel} />
        <FirstLook structureId={view.structure} />
        <NotationKey />
      </aside>

      <main className="centre">
        <StageView structure={structure} trajectory={trajectory} onHover={setHovered} />

        <div className="overlay overlay--top">
          {structure !== null ? (
            <div className="chip">
              <strong>{structure.pdb_id}</strong>
              <span>{structure.method}</span>
              {structure.resolution !== null ? <span>{structure.resolution} Å</span> : null}
            </div>
          ) : null}
        </div>

        <div className="overlay overlay--right">
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

        {loadError !== null ? <p className="error" role="alert">{loadError}</p> : null}
      </main>

      <aside className="rail rail--right">
        {structure !== null ? (
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

      <HonestySheet open={honestyOpen} onClose={() => setHonestyOpen(false)} />

      <footer className="foot">
        <Transport trajectory={trajectory} speed={speed} onSpeed={setSpeed} />
      </footer>
    </div>
  );
}
