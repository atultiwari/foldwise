/**
 * The library, organised by clinical story rather than by fold class.
 *
 * This is the whole differentiator in one component: the reader arrives asking
 * about sickle cell, not about beta-grasp topology.
 */

import { structureContent } from "@foldwise/content";

import { LIBRARY } from "../data/library.js";
import { useView } from "../state/store.js";

export function Library() {
  const current = useView((s) => s.structure);
  const setStructure = useView((s) => s.setStructure);

  return (
    <nav className="library" aria-label="Structure library">
      {LIBRARY.map((group) => (
        <section key={group.story}>
          <h2>{group.story}</h2>
          <ul>
            {group.entries.map((entry) => {
              // Names come from the editorial content, so there is one place
              // to change them and the test that checks coverage catches gaps.
              const content = structureContent(entry.id);
              const label = {
                name: content?.name ?? entry.id,
                role: content?.role.replace("-", " ") ?? "",
              };
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    aria-current={entry.id === current ? "true" : undefined}
                    onClick={() => setStructure(entry.id)}
                  >
                    <span className="library__name">{label.name}</span>
                    <span className="library__role">{label.role}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
