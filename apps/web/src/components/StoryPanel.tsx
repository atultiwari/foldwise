/**
 * The clinical framing.
 *
 * This is the panel that makes the difference between an instrument and a
 * lesson: the reader arrives asking about sickle cell, and this answers in
 * their own register before showing them a molecule.
 */

import {
  LEVELS, citation, citationHref, formatCitation,
  storyForStructure, structureContent, type Level,
} from "@foldwise/content";

interface StoryPanelProps {
  readonly structureId: string;
  readonly level: Level;
  readonly onLevel: (level: Level) => void;
}

const LEVEL_LABELS: Record<Level, string> = {
  lay: "Plain",
  student: "Student",
  researcher: "Research",
};

export function StoryPanel({ structureId, level, onLevel }: StoryPanelProps) {
  const content = structureContent(structureId);
  const story = storyForStructure(structureId);
  if (content === undefined || story === undefined) return null;

  const sources = [...new Set([...story.citations, ...content.citations])]
    .map((id) => citation(id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);

  return (
    <section className="card story">
      <div className="story__head">
        <h2>{story.title}</h2>
        <div className="levels" role="group" aria-label="Reading level">
          {LEVELS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === level}
              onClick={() => onLevel(key)}
            >
              {LEVEL_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <p className="story__question">{story.question}</p>

      <h3 className="story__name">
        {content.name}
        <span className="story__role">{content.role.replace("-", " ")}</span>
      </h3>
      <p className="story__tagline">{content.tagline}</p>
      <p className="story__summary">{content.summary[level]}</p>

      <p className="story__fact"><strong>Worth remembering.</strong> {content.keyFact}</p>

      {content.annotations.length > 0 ? (
        <>
          <h4>What to look at</h4>
          <ul className="annotations">
            {content.annotations.map((annotation) => (
              <li key={annotation.id}>
                <strong>{annotation.label}</strong>
                <span>{annotation.description}</span>
                <span className="annotations__where">
                  {annotation.residues
                    .map((r) => `${r.code}${r.resNum}${r.chain === "A" ? "" : ` (chain ${r.chain})`}`)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {content.caveats.length > 0 ? (
        <div className="caveats">
          <h4>Read this with</h4>
          {content.caveats.map((caveat) => (
            <p key={caveat.subject}>
              <strong>{caveat.subject}.</strong> {caveat.text}
            </p>
          ))}
        </div>
      ) : null}

      <details className="objectives">
        <summary>What you should be able to do afterwards</summary>
        <ul>
          {story.objectives.map((objective) => <li key={objective}>{objective}</li>)}
        </ul>
      </details>

      {sources.length > 0 ? (
        <details className="sources">
          <summary>Sources ({sources.length})</summary>
          <ol>
            {sources.map((source) => (
              <li key={source.id}>
                <a href={citationHref(source)} target="_blank" rel="noopener noreferrer">
                  {formatCitation(source)}
                </a>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}
