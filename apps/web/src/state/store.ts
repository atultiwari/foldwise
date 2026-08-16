/**
 * View state, kept in the address bar.
 *
 * The URL is the source of truth, not a copy of it. Every change writes back,
 * and the back button works because navigation is what changed the state in
 * the first place. That is what makes each view linkable.
 */

import { create } from "zustand";

import {
  DEFAULT_VIEW, applyPreset, decodeView, encodeView,
  type ColorModeKey, type Mode, type Representation, type ViewState,
} from "@foldwise/ui";

interface ViewStore extends ViewState {
  readonly setStructure: (structure: string) => void;
  readonly setProgress: (progress: number) => void;
  readonly setMode: (mode: Mode) => void;
  readonly setRepresentation: (representation: Representation) => void;
  readonly setColor: (color: ColorModeKey) => void;
  readonly setSelected: (selected: number) => void;
  readonly setPlaying: (playing: boolean) => void;
  readonly adopt: (view: ViewState) => void;
}

const initial = typeof window === "undefined"
  ? DEFAULT_VIEW
  : decodeView(window.location.search);

/**
 * Push the state into the URL.
 *
 * `replaceState`, not `pushState`: scrubbing a timeline generates hundreds of
 * changes, and a history entry per frame would make the back button useless.
 */
function publish(view: ViewState): void {
  if (typeof window === "undefined") return;
  const query = encodeView(view);
  const next = `${window.location.pathname}${query}`;
  if (next !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, "", next);
  }
}

export const useView = create<ViewStore>((set, get) => {
  const update = (patch: Partial<ViewState>) => {
    set(patch as never);
    publish({ ...stripActions(get()), ...patch });
  };

  return {
    ...initial,
    setStructure: (structure) =>
      // A new structure invalidates any residue that was selected in the old.
      update({ structure, selected: -1, progress: 0, playing: false }),
    setProgress: (progress) => update({ progress: Math.max(0, Math.min(1, progress)) }),
    setMode: (mode) => update(stripActions(applyPreset(stripActions(get()), mode))),
    setRepresentation: (representation) => update({ representation }),
    setColor: (color) => update({ color }),
    setSelected: (selected) => update({ selected }),
    setPlaying: (playing) => update({ playing }),
    adopt: (view) => {
      set(view as never);
      publish(view);
    },
  };
});

function stripActions(state: ViewStore | ViewState): ViewState {
  return {
    structure: state.structure,
    progress: state.progress,
    mode: state.mode,
    representation: state.representation,
    color: state.color,
    selected: state.selected,
    playing: state.playing,
  };
}

/** Adopt whatever the URL says when the user navigates. */
export function listenToHistory(): () => void {
  const onPop = () => useView.getState().adopt(decodeView(window.location.search));
  window.addEventListener("popstate", onPop);
  return () => window.removeEventListener("popstate", onPop);
}
