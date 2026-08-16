/**
 * The view, encoded in the address bar.
 *
 * Every visible choice -- which structure, which frame, which colouring, which
 * residue is selected -- lives in the URL. That makes each view a link, which
 * is what turns this from something to look at into something to teach with: a
 * lecturer pastes a URL and the class lands on the exact residue.
 *
 * Foldscape has no URL state at all, and cannot be linked into.
 *
 * Everything is parsed defensively. A URL is user input, and often a mangled
 * one that has been through a chat client; a bad parameter falls back to its
 * default rather than breaking the page.
 */

import { z } from "zod";

export const REPRESENTATIONS = ["cartoon", "spacefill", "sticks", "surface"] as const;
export const COLOR_MODE_KEYS = [
  "structure", "direction", "hydropathy", "charge", "flexibility", "burial", "chain",
] as const;
export const MODES = ["fold", "anatomy", "chemistry"] as const;

export type Representation = (typeof REPRESENTATIONS)[number];
export type ColorModeKey = (typeof COLOR_MODE_KEYS)[number];
export type Mode = (typeof MODES)[number];

/** Frames are stored as a position in [0, 1] so a link survives a frame-count change. */
const progress = z.coerce.number().min(0).max(1).catch(0);

export const viewStateSchema = z.object({
  structure: z.string().min(1).max(64).catch("hba-deoxy"),
  progress,
  mode: z.enum(MODES).catch("fold"),
  representation: z.enum(REPRESENTATIONS).catch("cartoon"),
  color: z.enum(COLOR_MODE_KEYS).catch("structure"),
  /** Selected residue index, or -1 for none. */
  selected: z.coerce.number().int().min(-1).catch(-1),
  /** Comparison pair id, or "" for none. */
  compare: z.string().max(64).catch(""),
  playing: z.enum(["0", "1"]).transform((v) => v === "1").catch(false),
});

export type ViewState = z.infer<typeof viewStateSchema>;

export const DEFAULT_VIEW: ViewState = {
  structure: "hba-deoxy",
  progress: 0,
  mode: "fold",
  representation: "cartoon",
  color: "structure",
  selected: -1,
  compare: "",
  playing: false,
};

/** Short keys, because these end up in links people paste into messages. */
const KEYS = {
  structure: "p",
  progress: "t",
  mode: "m",
  representation: "r",
  color: "c",
  selected: "s",
  compare: "cmp",
  playing: "go",
} as const;

export function decodeView(search: string): ViewState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw: Record<string, string> = {};
  for (const [field, key] of Object.entries(KEYS)) {
    const value = params.get(key);
    if (value !== null) raw[field] = value;
  }

  // A link that names a mode but not a representation or colour means the
  // preset: those fields are omitted from the URL precisely *because* the
  // preset supplies them. Without this, `?m=chemistry` restores the Chemistry
  // tab as selected while showing the Fold tab's colouring.
  const mode = MODES.includes(raw["mode"] as Mode) ? (raw["mode"] as Mode) : DEFAULT_VIEW.mode;
  const base = applyPreset(DEFAULT_VIEW, mode);

  // `catch` on each field means a mangled parameter degrades to its default
  // instead of throwing the whole view away.
  return viewStateSchema.parse({ ...base, ...raw });
}

/**
 * Encode a view, omitting anything left at its default.
 *
 * A link to the default view should be the bare URL, not a page of parameters
 * that say nothing.
 */
export function encodeView(view: ViewState): string {
  const params = new URLSearchParams();
  if (view.structure !== DEFAULT_VIEW.structure) params.set(KEYS.structure, view.structure);
  if (view.progress !== DEFAULT_VIEW.progress) {
    params.set(KEYS.progress, view.progress.toFixed(4).replace(/0+$/, "").replace(/\.$/, ""));
  }
  if (view.mode !== DEFAULT_VIEW.mode) params.set(KEYS.mode, view.mode);
  if (view.representation !== DEFAULT_VIEW.representation) {
    params.set(KEYS.representation, view.representation);
  }
  if (view.color !== DEFAULT_VIEW.color) params.set(KEYS.color, view.color);
  if (view.selected !== DEFAULT_VIEW.selected) params.set(KEYS.selected, String(view.selected));
  if (view.compare !== DEFAULT_VIEW.compare) params.set(KEYS.compare, view.compare);
  if (view.playing) params.set(KEYS.playing, "1");

  const query = params.toString();
  return query.length > 0 ? `?${query}` : "";
}

/**
 * The presets.
 *
 * Modes, not settings: each tab is a bundle of choices that answers a
 * question, rather than a control the reader has to assemble an answer from.
 * The underlying controls stay available, but the preset is the default path.
 */
export interface ModePreset {
  readonly key: Mode;
  readonly label: string;
  readonly hint: string;
  readonly representation: Representation;
  readonly color: ColorModeKey;
  /** Jump to the folded state rather than staying on the timeline. */
  readonly jumpToNative: boolean;
}

export const MODE_PRESETS: readonly ModePreset[] = [
  {
    key: "fold",
    label: "Fold",
    hint: "Watch the chain find its shape.",
    representation: "cartoon",
    color: "structure",
    jumpToNative: false,
  },
  {
    key: "anatomy",
    label: "Anatomy",
    hint: "Study the finished structure up close.",
    representation: "surface",
    color: "structure",
    jumpToNative: true,
  },
  {
    key: "chemistry",
    label: "Chemistry",
    hint: "See which residues hide from water.",
    representation: "cartoon",
    color: "hydropathy",
    jumpToNative: true,
  },
];

export function presetFor(mode: Mode): ModePreset {
  return MODE_PRESETS.find((preset) => preset.key === mode) ?? MODE_PRESETS[0]!;
}

/** Apply a preset, keeping everything it does not speak to. */
export function applyPreset(view: ViewState, mode: Mode): ViewState {
  const preset = presetFor(mode);
  return {
    ...view,
    mode,
    representation: preset.representation,
    color: preset.color,
    progress: preset.jumpToNative ? 1 : view.progress,
    playing: preset.jumpToNative ? false : view.playing,
  };
}
