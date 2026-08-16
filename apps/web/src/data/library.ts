/**
 * The structure library.
 *
 * Files are pulled in by glob at build time, so adding a structure means
 * regenerating the data and nothing else. Each one is validated on load --
 * see `parseStructure` for why the browser does not trust the pipeline.
 */

import { parseStructure, type Structure } from "@foldwise/ui";

const files = import.meta.glob<unknown>("../../../../data/structures/*.json", {
  import: "default",
});

export interface LibraryEntry {
  readonly id: string;
  readonly load: () => Promise<Structure>;
}

/** Clinical stories, in the order they should be read. */
const STORIES: ReadonlyArray<{ story: string; ids: readonly string[] }> = [
  { story: "Sickle cell", ids: ["hba-deoxy", "hbs-deoxy"] },
  { story: "Cystic fibrosis", ids: ["nbd1-wt", "nbd1-df508", "cftr-full"] },
  { story: "Imatinib", ids: ["abl-imatinib", "abl-t315i-ponatinib"] },
  { story: "Nirmatrelvir", ids: ["mpro-nirmatrelvir", "mpro-dimer"] },
];

const byId = new Map<string, () => Promise<unknown>>(
  Object.entries(files).map(([path, load]) => [
    path.split("/").pop()!.replace(".json", ""),
    load,
  ]),
);

export interface StoryGroup {
  readonly story: string;
  readonly entries: readonly LibraryEntry[];
}

export const LIBRARY: readonly StoryGroup[] = STORIES.map(({ story, ids }) => ({
  story,
  entries: ids
    .filter((id) => byId.has(id))
    .map((id) => ({ id, load: async () => parseStructure(await byId.get(id)!()) })),
}));

export const ALL_ENTRIES: readonly LibraryEntry[] = LIBRARY.flatMap((group) => group.entries);

export function entryFor(id: string): LibraryEntry | undefined {
  return ALL_ENTRIES.find((entry) => entry.id === id);
}
