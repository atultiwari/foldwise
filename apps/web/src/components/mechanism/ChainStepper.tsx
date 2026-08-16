/**
 * The causal chain, along the top.
 *
 * This is the piece that answers "where am I, and where is this going?" — the
 * question a guided tour never answers, because a tour only ever shows you the
 * step you are on. Seeing all six links at once, with the scale each belongs
 * to, is what makes a mutation feel connected to a crisis.
 *
 * Every step is reachable directly. A doctor who already knows why HbS
 * polymerises should be able to jump to the vessel.
 */

import { SCALE_LABELS, outcomeFor, type Mechanism } from "@foldwise/content";

interface ChainStepperProps {
  readonly mechanism: Mechanism;
  readonly current: number;
  readonly vars: Readonly<Record<string, string>>;
  readonly onGo: (index: number) => void;
}

export function ChainStepper({ mechanism, current, vars, onGo }: ChainStepperProps) {
  return (
    <nav className="chain" aria-label="Causal chain">
      <ol>
        {mechanism.stages.map((stage, index) => {
          const outcome = outcomeFor(stage, vars);
          const scale = SCALE_LABELS[stage.scale];
          const previousScale = index === 0 ? null : SCALE_LABELS[mechanism.stages[index - 1]!.scale];
          return (
            <li key={stage.id}>
              <button
                type="button"
                className={`chain__step chain__step--${outcome.tone}`}
                aria-current={index === current ? "step" : undefined}
                onClick={() => onGo(index)}
              >
                {/* The scale is only worth repeating when it changes; a column
                    of identical labels is noise. */}
                <span className="chain__scale">{scale === previousScale ? " " : scale}</span>
                <span className="chain__title">{stage.title}</span>
                <span className="chain__outcome">{outcome.headline}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
