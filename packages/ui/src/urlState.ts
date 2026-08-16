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
export const MODES = ["mechanism", "fold", "anatomy", "chemistry"] as const;

export type Representation = (typeof REPRESENTATIONS)[number];
export type ColorModeKey = (typeof COLOR_MODE_KEYS)[number];
export type Mode = (typeof MODES)[number];

/**
 * Each field on its own, so a mangled parameter can fall back to what the rest
 * of the link implies rather than to a fixed constant.
 *
 * `?m=fold&t=banana` should give the Fold preset's timeline position, not some
 * other mode's. That only works if the fallback is the base view, which the
 * schema cannot see — hence per-field validation in `decodeView` below.
 */
const FIELDS = {
  structure: z.string().min(1).max(64),
  /** Frames are a position in [0, 1] so a link survives a frame-count change. */
  progress: z.coerce.number().min(0).max(1),
  mode: z.enum(MODES),
  representation: z.enum(REPRESENTATIONS),
  color: z.enum(COLOR_MODE_KEYS),
  /** Selected residue index, or -1 for none. */
  selected: z.coerce.number().int().min(-1),
  /** Comparison pair id, or "" for none. */
  compare: z.string().max(64),
  playing: z.enum(["0", "1"]).transform((v) => v === "1"),
  /** Which stage of the causal chain, in Mechanism mode. */
  stage: z.coerce.number().int().min(0).max(31),
  /**
   * Mechanism control settings, as `id:value` pairs.
   *
   * These are what make a mechanism link worth pasting: not "here is sickle
   * cell" but "here is sickle cell at low oxygen, at the assembly step".
   */
  vars: z.string().max(160),
} as const;

export const viewStateSchema = z.object(FIELDS);

export type ViewState = z.infer<typeof viewStateSchema>;

export const DEFAULT_VIEW: ViewState = {
  structure: "hba-deoxy",
  progress: 1,
  mode: "mechanism",
  representation: "cartoon",
  color: "hydropathy",
  selected: -1,
  compare: "",
  playing: false,
  stage: 0,
  vars: "",
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
  stage: "st",
  vars: "v",
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

  // Each parameter is validated on its own, so one mangled field degrades to
  // the base view rather than throwing the whole link away.
  const view: Record<string, unknown> = { ...base };
  for (const [field, value] of Object.entries(raw)) {
    const parsed = FIELDS[field as keyof typeof FIELDS].safeParse(value);
    if (parsed.success) view[field] = parsed.data;
  }
  return view as ViewState;
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
  if (view.stage !== DEFAULT_VIEW.stage) params.set(KEYS.stage, String(view.stage));
  if (view.vars !== DEFAULT_VIEW.vars) params.set(KEYS.vars, view.vars);

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
    key: "mechanism",
    label: "Mechanism",
    hint: "Follow the chain from gene to patient, and change what causes it.",
    representation: "cartoon",
    color: "hydropathy",
    jumpToNative: true,
  },
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
    // Leaving Mechanism mode should not carry its stage into a mode that has
    // no stages; re-entering it starts at the top of the chain.
    stage: mode === "mechanism" ? view.stage : 0,
  };
}

/**
 * Mechanism control settings, to and from the URL.
 *
 * `genotype:hbs,oxygen:low` — short enough to survive a chat client, and
 * readable enough that a lecturer can see what a link says before sending it.
 * Both directions are total: unparseable input yields an empty setting rather
 * than an exception, because this is a URL and URLs arrive mangled.
 */
export function encodeVars(vars: Readonly<Record<string, string>>): string {
  return Object.entries(vars)
    .filter(([id, value]) => SAFE_TOKEN.test(id) && SAFE_TOKEN.test(value))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, value]) => `${id}:${value}`)
    .join(",");
}

export function decodeVars(encoded: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of encoded.split(",")) {
    const [id, value] = pair.split(":");
    if (id === undefined || value === undefined) continue;
    if (!SAFE_TOKEN.test(id) || !SAFE_TOKEN.test(value)) continue;
    out[id] = value;
  }
  return out;
}

/** Control and option identifiers are authored, so this is a tight allowlist. */
const SAFE_TOKEN = /^[a-z0-9][a-z0-9-]{0,31}$/;
