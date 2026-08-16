/**
 * The causal variables.
 *
 * This is the difference between this view and a slideshow. A reader who sets
 * HbS with low oxygen and watches a fibre grow, then raises the oxygen and
 * watches it not, has derived why crises are triggered by hypoxia rather than
 * being told. Every control propagates through the whole chain at once, so the
 * consequence is visible in the stepper above without stepping anywhere.
 */

import type { Mechanism } from "@foldwise/content";

interface ControlsProps {
  readonly mechanism: Mechanism;
  readonly vars: Readonly<Record<string, string>>;
  readonly onSet: (id: string, value: string) => void;
}

export function Controls({ mechanism, vars, onSet }: ControlsProps) {
  return (
    <section className="card controls">
      <h2>Change the cause</h2>
      <p className="controls__lede">{mechanism.question}</p>

      {mechanism.controls.map((control) => (
        <fieldset key={control.id} className="controls__group">
          <legend>{control.label}</legend>
          {control.options.map((option) => {
            const id = `${control.id}-${option.value}`;
            return (
              <label key={option.value} className="controls__option" htmlFor={id}>
                <input
                  id={id}
                  type="radio"
                  name={control.id}
                  value={option.value}
                  checked={vars[control.id] === option.value}
                  onChange={() => onSet(control.id, option.value)}
                />
                <span className="controls__label">{option.label}</span>
                {option.note !== undefined && option.note.length > 0
                  ? <span className="controls__note">{option.note}</span>
                  : null}
              </label>
            );
          })}
        </fieldset>
      ))}

      <p className="controls__caveat">
        The structures and their measurements are real. What each setting leads
        to is established biology, written down — not a simulation. Nothing here
        is computed from physics.
      </p>
    </section>
  );
}
