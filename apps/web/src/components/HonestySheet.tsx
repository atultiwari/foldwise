/**
 * What is real, what is illustration, and what this is not for.
 *
 * Reachable from everywhere, because a reader who is about to believe the
 * animation should be one click from being told not to.
 */

import { HONESTY } from "@foldwise/content";

interface HonestySheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function HonestySheet({ open, onClose }: HonestySheetProps) {
  if (!open) return null;

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="What's real and what's illustration"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <article className="sheet__panel">
        <button type="button" className="sheet__close" aria-label="Close" onClick={onClose}>✕</button>

        <h2>What am I looking at?</h2>
        <p className="sheet__lead">
          Every protein in your body starts as a string of amino acids and, within
          milliseconds, folds itself into a precise shape. That shape is what lets it do its
          job. Get it wrong and things go badly — which is what three of the four stories
          here are about.
        </p>

        <div className="sheet__split">
          <section>
            <h3 className="sheet__real">What's real</h3>
            {HONESTY.real.map((item) => (
              <p key={item.title}><strong>{item.title}.</strong> {item.text}</p>
            ))}
          </section>

          <section>
            <h3 className="sheet__model">What's illustration</h3>
            {HONESTY.illustration.map((item) => (
              <p key={item.title}><strong>{item.title}.</strong> {item.text}</p>
            ))}
          </section>
        </div>

        <h3>Limits</h3>
        <ul className="sheet__limits">
          {HONESTY.limits.map((limit) => <li key={limit}>{limit}</li>)}
        </ul>

        <p className="sheet__credit">
          Structural data from the RCSB Protein Data Bank, released into the public domain.
        </p>
      </article>
    </div>
  );
}
