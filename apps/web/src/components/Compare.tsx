/**
 * Compare mode.
 *
 * Two structures at once, with the difference told honestly — which for these
 * pairs mostly means telling the reader how little differs.
 *
 * Measured on the real files: HbA and HbS differ by 0.26 Å on the β chain
 * against a noise floor of 0.17 Å, and the most-deviated residues are the
 * floppy N-terminus. β6, the residue that causes the disease, does not appear
 * in a deviation ranking at all. A view that simply coloured by difference
 * would point confidently at the wrong thing, so the numbers are shown beside
 * their noise floor and the curated text carries the mechanism.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { compareStructures, notableDeviations, type Comparison } from "@foldwise/core";
import type { ComparisonPair, Level } from "@foldwise/content";
import { flatten, type Structure } from "@foldwise/ui";
import type { CompareMode, Stage } from "@foldwise/render";
import { colorResidues } from "@foldwise/render";

import { entryFor } from "../data/library.js";

/** The overlay's tint: warm, to sit against the cool structure palette. */
const OVERLAY_TINT: readonly [number, number, number] = [0.85, 0.42, 0.24];

function flatColour(residues: number, rgb: readonly [number, number, number]): Float32Array {
  const out = new Float32Array(residues * 3);
  for (let i = 0; i < residues; i++) {
    out[i * 3] = rgb[0];
    out[i * 3 + 1] = rgb[1];
    out[i * 3 + 2] = rgb[2];
  }
  return out;
}

interface CompareProps {
  readonly pair: ComparisonPair;
  readonly left: Structure | null;
  readonly stage: Stage | null;
  readonly level: Level;
  readonly onClose: () => void;
  readonly onLayout: (mode: "side-by-side" | "superposed") => void;
}

export function Compare({ pair, left, stage, level, onClose, onLayout }: CompareProps) {
  const [right, setRight] = useState<Structure | null>(null);
  const [mode, setMode] = useState<CompareMode>(pair.view);
  const [error, setError] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRight(null);
    entryFor(pair.right)?.load().then(
      (structure) => { if (!cancelled) setRight(structure); },
      () => { if (!cancelled) setError("Could not load the second structure."); },
    );
    return () => { cancelled = true; };
  }, [pair.right]);

  useEffect(() => { setMode(pair.view); }, [pair.view]);
  useEffect(() => { onLayout(mode === "off" ? "side-by-side" : mode); }, [mode, onLayout]);

  /** Superpose on the chain the pair nominates. */
  const result = useMemo<Comparison | null>(() => {
    if (left === null || right === null) return null;
    const a = flatten(left);
    const b = flatten(right);
    try {
      return compareStructures(
        { ca: a.ca, resNums: a.resNums, chainOf: a.chainOf },
        { ca: b.ca, resNums: b.resNums, chainOf: b.chainOf },
        { chain: pair.chain },
      );
    } catch (issue: unknown) {
      setError(issue instanceof Error ? issue.message : "Could not align these structures.");
      return null;
    }
  }, [left, right, pair.chain]);

  // Push the superposed comparison structure into the renderer.
  useEffect(() => {
    if (stage === null || right === null || result === null) return;
    const key = `${pair.id}:${mode}`;
    if (loadedFor.current !== key) {
      let offset = 0;
      stage.loadComparison(right.chains.map((chain) => {
        // Superposed coordinates for overlay; original for side by side, where
        // each structure has its own viewport and moving one would be wrong.
        const ca = mode === "superposed"
          ? result.superposed.subarray(offset, offset + chain.seq.length * 3)
          : chain.ca;
        offset += chain.seq.length * 3;
        return { ca, secondaryStructure: chain.ss };
      }));
      // Overlaid, both structures in the same palette are indistinguishable.
      // A flat contrasting tint on the second is the conventional answer and
      // makes the two easy to separate at a glance.
      stage.setComparisonColors(right.chains.map((chain, index) =>
        mode === "superposed"
          ? flatColour(chain.seq.length, OVERLAY_TINT)
          : colorResidues("structure", {
              sequence: chain.seq,
              secondaryStructure: chain.ss,
              chainOf: new Array(chain.seq.length).fill(index),
            }),
      ));
      loadedFor.current = key;
    }
    stage.setCompareMode(mode);
    stage.frameAll();
  }, [stage, right, result, mode, pair.id]);

  useEffect(() => () => {
    stage?.setCompareMode("off");
    stage?.clearComparison();
  }, [stage]);

  const notable = useMemo(
    () => (result === null ? [] : notableDeviations(result, 3, 6)),
    [result],
  );
  const flatLeft = useMemo(() => (left === null ? null : flatten(left)), [left]);

  return (
    <section className="card compare">
      <div className="compare__head">
        <h2>Comparing</h2>
        <button type="button" className="compare__close" onClick={onClose}>Exit</button>
      </div>

      <h3>{pair.title}</h3>
      <p className="compare__summary">{pair.summary[level]}</p>

      {mode === "superposed" ? (
        <p className="compare__key">
          <span className="compare__swatch compare__swatch--a" /> {"first"}
          <span className="compare__swatch compare__swatch--b" /> {"second"}
        </p>
      ) : null}

      <div className="compare__modes" role="group" aria-label="Comparison layout">
        {(["side-by-side", "superposed"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => setMode(option)}
          >
            {option === "side-by-side" ? "Side by side" : "Overlaid"}
          </button>
        ))}
      </div>

      {error !== null ? <p className="error" role="alert">{error}</p> : null}

      {result !== null ? (
        <>
          <dl className="compare__numbers">
            <div>
              <dt>Backbone difference</dt>
              <dd>{result.rmsd.toFixed(2)} Å</dd>
            </div>
            <div>
              <dt>Noise floor</dt>
              <dd>{result.noiseFloor.toFixed(2)} Å</dd>
            </div>
            <div>
              <dt>Residues aligned</dt>
              <dd>{result.alignment.count} <span>({pair.chainLabel})</span></dd>
            </div>
          </dl>

          <p className="compare__caveat">
            {result.rmsd < result.noiseFloor * 2
              ? "These two are the same shape to within the difference you would expect between any two crystals of the same protein. Do not read the deviations as biology."
              : "Deviations below the noise floor are crystallographic, not biological. Only the residues listed below are worth attention."}
          </p>

          {notable.length > 0 && flatLeft !== null ? (
            <>
              <h4>Furthest apart</h4>
              <ul className="compare__notable">
                {notable.map((index) => {
                  const residue = result.alignment.a[index]!;
                  return (
                    <li key={residue}>
                      <span className="compare__res">
                        {flatLeft.sequence[residue]}{flatLeft.resNums[residue]}
                      </span>
                      <span>{result.deviation[index]!.toFixed(1)} Å</span>
                    </li>
                  );
                })}
              </ul>
              <p className="compare__caveat">
                Being furthest apart does not make a residue important — flexible
                termini and disordered loops top this list in every comparison.
              </p>
            </>
          ) : null}
        </>
      ) : (
        <p className="compare__loading">Aligning…</p>
      )}

      <h4>What differs</h4>
      <ul className="compare__list">
        {pair.differs.map((item) => <li key={item}>{item}</li>)}
      </ul>

      <h4 className="compare__unchanged-head">What does not</h4>
      <ul className="compare__list compare__list--unchanged">
        {pair.unchanged.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}
