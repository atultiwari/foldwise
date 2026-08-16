/**
 * The library, organised by clinical story rather than by fold class.
 *
 * This is the whole differentiator in one component: the reader arrives asking
 * about sickle cell, not about beta-grasp topology.
 */

import { LIBRARY } from "../data/library.js";
import { useView } from "../state/store.js";

const LABELS: Record<string, { name: string; role: string }> = {
  "hba-deoxy": { name: "Haemoglobin A", role: "wild type" },
  "hbs-deoxy": { name: "Haemoglobin S", role: "variant" },
  "nbd1-wt": { name: "CFTR NBD1", role: "wild type" },
  "nbd1-df508": { name: "CFTR NBD1 ΔF508", role: "variant" },
  "cftr-full": { name: "CFTR, full length", role: "context" },
  "abl-imatinib": { name: "ABL + imatinib", role: "drug bound" },
  "abl-t315i-ponatinib": { name: "ABL T315I + ponatinib", role: "resistance" },
  "mpro-nirmatrelvir": { name: "Mpro + nirmatrelvir", role: "drug bound" },
  "mpro-dimer": { name: "Mpro dimer", role: "context" },
};

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
              const label = LABELS[entry.id] ?? { name: entry.id, role: "" };
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
