/**
 * What follows, at this stage, given what the reader has set.
 *
 * Deliberately narrow: one headline and one paragraph. The failure mode of a
 * teaching interface is a wall of true statements, and a reader who is
 * interrogating a mechanism needs the consequence of *this* setting, not a
 * summary of the disease.
 */

import { LEVELS, SCALE_LABELS, type Level, type MechanismStage, type Outcome as OutcomeData } from "@foldwise/content";

interface OutcomeProps {
  readonly stage: MechanismStage;
  readonly outcome: OutcomeData;
  readonly level: Level;
  readonly onLevel: (level: Level) => void;
  readonly stepOf: string;
}

const LEVEL_LABELS: Readonly<Record<Level, string>> = {
  lay: "Plain",
  student: "Student",
  researcher: "Specialist",
};

export function Outcome({ stage, outcome, level, onLevel, stepOf }: OutcomeProps) {
  return (
    <section className={`card outcome outcome--${outcome.tone}`}>
      <div className="outcome__head">
        <span className="outcome__scale">{SCALE_LABELS[stage.scale]}</span>
        <span className="outcome__count">{stepOf}</span>
      </div>

      <h2 className="outcome__title">{stage.title}</h2>
      <p className="outcome__headline">{outcome.headline}</p>
      <p className="outcome__detail">{outcome.detail[level]}</p>

      <div className="outcome__levels" role="group" aria-label="Reading level">
        {LEVELS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === level}
            onClick={() => onLevel(option)}
          >
            {LEVEL_LABELS[option]}
          </button>
        ))}
      </div>
    </section>
  );
}
