/**
 * Guided tours: orientation, and the story tours that do the teaching.
 *
 * One component drives both. A step is a view of the application plus an
 * anchor plus copy, so the same machinery that spotlights a panel can also fly
 * to a residue in the model and explain what is now on screen.
 *
 * Two rules it holds to that most product tours do not:
 *
 * - **The orientation tour never fires on a deep link.** Someone who arrived
 *   at a specific residue was sent there deliberately, and interrupting that
 *   is hostile.
 * - **Focus is trapped and returned.** A modal that lets Tab wander behind it
 *   is unusable with a keyboard and invisible to a screen reader.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  ORIENTATION, ORIENTATION_VERSION, type Level, type TourStep,
} from "@foldwise/content";
import { flatten, type Structure } from "@foldwise/ui";

import { useView } from "../state/store.js";
import type { ColorModeKey, Representation } from "@foldwise/ui";

const STORAGE_KEY = `foldwise.tour.orientation.v${ORIENTATION_VERSION}`;

/** Whether the orientation tour should open by itself on this visit. */
export function shouldAutoStart(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.search.length > 0) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === null;
  } catch {
    // Private browsing can throw on access. Err toward not interrupting.
    return false;
  }
}

export function markOrientationSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Nothing to do; the tour simply offers itself again next time.
  }
}

interface Rect { top: number; left: number; width: number; height: number }

/** Locates a residue on screen. Supplied by the stage. */
export type Locator = (chainIndex: number, residueIndex: number) => { x: number; y: number } | null;

export interface TourRun {
  readonly steps: readonly TourStep[];
  /** Orientation marks itself as seen; a story tour does not. */
  readonly kind: "orientation" | "story";
  readonly title?: string;
}

interface TourProps {
  readonly run: TourRun | null;
  readonly level: Level;
  readonly structure: Structure | null;
  readonly locate: Locator | null;
  readonly onClose: () => void;
}

const PADDING = 6;
const CARD_WIDTH = 320;
const GAP = 16;
/** Radius of the ring drawn around a residue, in CSS pixels. */
const RESIDUE_RING = 30;

export function Tour({ run, level, structure, locate, onClose }: TourProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const returnFocusTo = useRef<Element | null>(null);

  const setStructure = useView((s) => s.setStructure);
  const setProgress = useView((s) => s.setProgress);
  const setColor = useView((s) => s.setColor);
  const setRepresentation = useView((s) => s.setRepresentation);

  const steps = run?.steps ?? [];
  const step = steps[index];
  const last = index === steps.length - 1;

  useEffect(() => { setIndex(0); }, [run]);

  const finish = useCallback(() => {
    if (run?.kind === "orientation") markOrientationSeen();
    setIndex(0);
    onClose();
  }, [onClose, run]);

  // Drive the application into the state this step wants.
  useEffect(() => {
    if (run === null || step?.view === undefined) return;
    const view = step.view;
    if (view.structure !== undefined && view.structure !== useView.getState().structure) {
      setStructure(view.structure);
    }
    if (view.color !== undefined) setColor(view.color as ColorModeKey);
    if (view.representation !== undefined) {
      setRepresentation(view.representation as Representation);
    }
    if (view.progress !== undefined) setProgress(view.progress);
  }, [run, step, setStructure, setColor, setRepresentation, setProgress]);

  /**
   * Measure the anchor.
   *
   * Residue anchors are re-measured on a short interval: the camera is still
   * easing toward its new framing after a structure change, so a single
   * measurement would pin the ring where the residue *was*.
   */
  useLayoutEffect(() => {
    if (run === null || step === undefined) return;

    const measure = () => {
      if (step.anchor.kind === "element") {
        const element = document.querySelector(step.anchor.selector);
        if (element === null) {
          if (import.meta.env.DEV) {
            console.warn(`[tour] "${step.id}" anchor not found: ${step.anchor.selector}`);
          }
          setRect(null);
          return;
        }
        const box = element.getBoundingClientRect();
        setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
        return;
      }

      // Residue anchor: chain id and author residue number into indices.
      const stage = document.querySelector(".stage")?.getBoundingClientRect();
      const at = locateResidue(step.anchor, structure, locate);

      if (at === null || stage === undefined) {
        // The residue may be facing away, off frame, or the camera may still
        // be easing toward it after a structure change. Spotlight the model
        // itself rather than dropping to a bare scrim: the copy still reads,
        // and the reader is still pointed at the right object.
        setRect(stage === undefined ? null : {
          top: stage.top, left: stage.left, width: stage.width, height: stage.height,
        });
        return;
      }

      setRect({
        top: stage.top + at.y - RESIDUE_RING,
        left: stage.left + at.x - RESIDUE_RING,
        width: RESIDUE_RING * 2,
        height: RESIDUE_RING * 2,
      });
    };

    measure();
    const settle = step.anchor.kind === "residue" ? setInterval(measure, 120) : undefined;
    window.addEventListener("resize", measure);
    return () => {
      if (settle !== undefined) clearInterval(settle);
      window.removeEventListener("resize", measure);
    };
  }, [run, step, structure, locate]);

  useEffect(() => {
    if (run === null) return;
    returnFocusTo.current = document.activeElement;
    cardRef.current?.focus();
    return () => {
      if (returnFocusTo.current instanceof HTMLElement) returnFocusTo.current.focus();
    };
  }, [run]);

  useEffect(() => {
    if (run === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { finish(); return; }
      if (event.key === "ArrowRight" && !last) { setIndex((i) => i + 1); return; }
      if (event.key === "ArrowLeft" && index > 0) { setIndex((i) => i - 1); return; }
      if (event.key !== "Tab") return;

      const focusable = cardRef.current?.querySelectorAll<HTMLElement>("button");
      if (focusable === undefined || focusable.length === 0) return;
      const first = focusable[0]!;
      const lastEl = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [run, last, index, finish]);

  if (run === null || step === undefined) return null;
  // Only draw the ring when the residue was actually found; a fallback
  // spotlight of the whole stage must not be drawn as a 60-pixel circle.
  const isResidue =
    step.anchor.kind === "residue" && rect !== null && rect.width === RESIDUE_RING * 2;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={run.title ?? "Guided tour"}>
      {rect !== null ? (
        <div
          className={isResidue ? "tour__spot tour__spot--residue" : "tour__spot"}
          style={{
            top: rect.top - (isResidue ? 0 : PADDING),
            left: rect.left - (isResidue ? 0 : PADDING),
            width: rect.width + (isResidue ? 0 : PADDING * 2),
            height: rect.height + (isResidue ? 0 : PADDING * 2),
          }}
        />
      ) : (
        <div className="tour__scrim" />
      )}

      <div
        className="tour__card"
        ref={cardRef}
        tabIndex={-1}
        style={rect === null ? undefined : cardPosition(rect, step.placement)}
      >
        <p className="tour__count">
          {run.title !== undefined ? `${run.title} · ` : ""}
          Step {index + 1} of {steps.length}
        </p>
        <h2>{step.title}</h2>
        <p className="tour__copy">{step.copy[level]}</p>

        <div className="tour__actions">
          <button type="button" className="tour__skip" onClick={finish}>
            {last ? "Close" : "Skip"}
          </button>
          <span className="tour__dots" aria-hidden="true">
            {steps.map((s, i) => (
              <span key={s.id} className={i === index ? "on" : undefined} />
            ))}
          </span>
          {index > 0 ? (
            <button type="button" onClick={() => setIndex(index - 1)}>Back</button>
          ) : null}
          <button
            type="button"
            className="tour__next"
            onClick={() => (last ? finish() : setIndex(index + 1))}
          >
            {last ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Resolve a residue anchor to a screen position, or null if it cannot be seen. */
function locateResidue(
  anchor: { chain: string; resNum: number },
  structure: Structure | null,
  locate: Locator | null,
): { x: number; y: number } | null {
  if (structure === null || locate === null) return null;
  const flat = flatten(structure);
  const chainIndex = flat.chainIds.indexOf(anchor.chain);
  const chain = structure.chains[chainIndex];
  if (chain === undefined) return null;
  const residueIndex = chain.res_nums.indexOf(anchor.resNum);
  if (residueIndex < 0) return null;
  return locate(chainIndex, residueIndex);
}

/** Put the card beside its anchor, kept inside the viewport. */
function cardPosition(rect: Rect, placement: TourStep["placement"]): React.CSSProperties {
  const margin = 12;
  let top = rect.top;
  let left = rect.left + rect.width + GAP;

  if (placement === "left") left = rect.left - CARD_WIDTH - GAP;
  else if (placement === "above") { top = rect.top - GAP; left = rect.left; }
  else if (placement === "below") { top = rect.top + rect.height + GAP; left = rect.left; }

  return {
    top: Math.max(margin, Math.min(top, window.innerHeight - 230)),
    left: Math.max(margin, Math.min(left, window.innerWidth - CARD_WIDTH - margin)),
    ...(placement === "above" ? { transform: "translateY(-100%)" } : {}),
  };
}
