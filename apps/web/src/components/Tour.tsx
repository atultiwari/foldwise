/**
 * The orientation tour.
 *
 * A spotlight cut out of a dimming overlay, plus a card anchored beside it.
 * Six steps, once, skippable at every point, replayable from the masthead.
 *
 * Two rules it holds to that most product tours do not:
 *
 * - **It never fires on a deep link.** Someone who arrived at a specific
 *   residue was sent there deliberately, and interrupting that is hostile.
 * - **Focus is trapped and returned.** A modal that lets Tab wander behind it
 *   is unusable with a keyboard and invisible to a screen reader.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { ORIENTATION, ORIENTATION_VERSION, type Level } from "@foldwise/content";

const STORAGE_KEY = `foldwise.tour.orientation.v${ORIENTATION_VERSION}`;

/** Whether the tour should open by itself on this visit. */
export function shouldAutoStart(): boolean {
  if (typeof window === "undefined") return false;
  // A deep link means the reader was sent to something specific.
  if (window.location.search.length > 0) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === null;
  } catch {
    // Private browsing can throw on access. Erring toward not interrupting.
    return false;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Nothing to do; the tour simply offers itself again next time.
  }
}

interface Rect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

interface TourProps {
  readonly open: boolean;
  readonly level: Level;
  readonly onClose: () => void;
}

const PADDING = 6;
const CARD_WIDTH = 300;
const GAP = 14;

export function Tour({ open, level, onClose }: TourProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const returnFocusTo = useRef<Element | null>(null);

  const step = ORIENTATION[index];
  const last = index === ORIENTATION.length - 1;

  const finish = useCallback(() => {
    markSeen();
    setIndex(0);
    onClose();
  }, [onClose]);

  // Measure the anchor. Layout effect so the spotlight is positioned before
  // paint rather than flashing at the top-left corner first.
  useLayoutEffect(() => {
    if (!open || step === undefined) return;
    const measure = () => {
      const element = document.querySelector(step.anchor);
      if (element === null) {
        // Anchors are the part of a tour most likely to rot. Say so rather
        // than spotlighting nothing and looking broken.
        if (import.meta.env.DEV) {
          console.warn(`[tour] step "${step.id}" anchor not found: ${step.anchor}`);
        }
        setRect(null);
        return;
      }
      const box = element.getBoundingClientRect();
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement;
    cardRef.current?.focus();
    return () => {
      // Put focus back where the reader left it.
      if (returnFocusTo.current instanceof HTMLElement) returnFocusTo.current.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { finish(); return; }
      if (event.key === "ArrowRight" && !last) { setIndex((i) => i + 1); return; }
      if (event.key === "ArrowLeft" && index > 0) { setIndex((i) => i - 1); return; }
      if (event.key !== "Tab") return;

      // Trap: cycle within the card's own controls.
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
  }, [open, last, index, finish]);

  if (!open || step === undefined) return null;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Guided tour">
      {rect !== null ? (
        <div
          className="tour__spot"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
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
          Step {index + 1} of {ORIENTATION.length}
        </p>
        <h2>{step.title}</h2>
        <p className="tour__copy">{step.copy[level]}</p>

        <div className="tour__actions">
          <button type="button" className="tour__skip" onClick={finish}>
            {last ? "Close" : "Skip"}
          </button>
          <span className="tour__dots" aria-hidden="true">
            {ORIENTATION.map((s, i) => (
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
            {last ? "Start exploring" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Put the card beside its anchor, kept inside the viewport. */
function cardPosition(rect: Rect, placement: TourStepPlacement): React.CSSProperties {
  const margin = 12;
  let top = rect.top;
  let left = rect.left + rect.width + GAP;

  if (placement === "left") left = rect.left - CARD_WIDTH - GAP;
  else if (placement === "above") { top = rect.top - GAP; left = rect.left; }
  else if (placement === "below") { top = rect.top + rect.height + GAP; left = rect.left; }

  // The card is measured after paint, so clamp generously rather than exactly.
  const maxLeft = window.innerWidth - CARD_WIDTH - margin;
  const maxTop = window.innerHeight - 210;
  return {
    top: Math.max(margin, Math.min(top, maxTop)),
    left: Math.max(margin, Math.min(left, maxLeft)),
    ...(placement === "above" ? { transform: "translateY(-100%)" } : {}),
  };
}

type TourStepPlacement = (typeof ORIENTATION)[number]["placement"];
