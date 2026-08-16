/**
 * Modes, not settings.
 *
 * Each tab is a bundle of choices that answers a question, rather than a
 * control the reader has to assemble an answer out of. The underlying controls
 * stay available below; this is the default path.
 */

import { MODE_PRESETS } from "@foldwise/ui";

import { useView } from "../state/store.js";

export function ModeTabs() {
  const mode = useView((s) => s.mode);
  const setMode = useView((s) => s.setMode);

  return (
    <div className="modes" role="tablist" aria-label="View mode">
      {MODE_PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          role="tab"
          aria-selected={preset.key === mode}
          title={preset.hint}
          onClick={() => setMode(preset.key)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
