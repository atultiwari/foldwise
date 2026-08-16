/**
 * The explain layer.
 *
 * A `title` attribute is not an explanation: it is invisible on touch, absent
 * from screen readers in several combinations, and cannot be read at leisure.
 * These are real buttons with real popovers.
 */

import { useEffect, useRef, useState } from "react";

import { NOTATION, explainer, firstLook, type Level } from "@foldwise/content";
import { STRUCTURE_COLOURS, rgbToHex } from "@foldwise/render";

/** A "?" that opens a proper popover. */
export function Explain({ id, level }: { readonly id: string; readonly level: Level }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  const entry = explainer(id);

  useEffect(() => {
    if (!open) return;
    const onAway = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onAway);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onAway);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (entry === undefined) return null;

  return (
    <span className="explain" ref={ref}>
      <button
        type="button"
        className="explain__toggle"
        aria-expanded={open}
        aria-label={`What does this mean?`}
        onClick={() => setOpen(!open)}
      >
        ?
      </button>
      {open ? (
        <span className="explain__pop" role="tooltip">
          <span className="explain__what">{entry.what[level]}</span>
          <span className="explain__arrow explain__arrow--up">↑ {entry.rising}</span>
          <span className="explain__arrow explain__arrow--down">↓ {entry.falling}</span>
        </span>
      ) : null}
    </span>
  );
}

/** What the shapes on screen actually mean. */
export function NotationKey() {
  return (
    <section className="card">
      <h2>Reading the model</h2>
      <ul className="notation">
        {NOTATION.map((entry) => (
          <li key={entry.id}>
            <span className="notation__swatch" style={{ background: rgbToHex(STRUCTURE_COLOURS[entry.shape]) }} />
            <span className="notation__body">
              <strong>{entry.label}</strong>
              <span>{entry.meaning}</span>
              <em>{entry.soWhat}</em>
            </span>
          </li>
        ))}
      </ul>
      <p className="notation__note">
        Colours follow whichever mode is selected above the model; the shapes never change.
      </p>
    </section>
  );
}

/** Three things to notice, before anything else. */
export function FirstLook({ structureId }: { readonly structureId: string }) {
  const items = firstLook(structureId);
  if (items.length === 0) return null;

  return (
    <section className="card">
      <h2>Look for these three things</h2>
      <ol className="first-look">
        {items.map((item) => (
          <li key={item.text}>
            {item.text}
            {item.residue !== undefined ? (
              <span className="first-look__where">
                {item.residue.code}{item.residue.resNum}
                {item.residue.chain === "A" ? "" : ` · chain ${item.residue.chain}`}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
