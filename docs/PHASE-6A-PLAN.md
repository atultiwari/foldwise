# Phase 6a — Teaching the reader how to read it

**Status:** 6a.1 done · 6a.2–6a.4 planned · **Between** Phase 6 (editorial) and Phase 7 (ship)
**Estimated:** 4 weeks

---

## The problem

Phase 6 gave every structure a story, sourced claims and verified annotations.
It did not give the reader the ability to *use* any of it.

A cartoon representation is a **notation**. Ribbons, arrows and tubes are a
convention someone invented, and nobody is born able to read them any more than
they are born able to read an ECG. We would never hand a student a rhythm strip
and expect them to interpret it unprompted — but that is exactly what the app
currently does with a 3D model, a folding timeline and four live biophysical
read-outs.

Two consequences, and this phase addresses both:

1. **A first-time reader does not know what to click, or what they are looking
   at.** The interface has no on-ramp.
2. **A reader cannot see what actually differs** between wild type and variant,
   which is the whole point of three of the four clinical stories. Loading HbA,
   memorising it, then loading HbS is not comparison — it is a memory test.

---

## What this phase adds

| | Deliverable | Why it earns its place |
|---|---|---|
| **6a.1** ✅ | Explain layer | Teaches the notation. Cheapest, highest leverage. |
| **6a.2** | Orientation tour | Six steps, once, on first run. What the panels are. |
| **6a.3** | Story tours | The actual teaching: camera flies to β6, and says why. |
| **6a.4** | Compare mode | Two structures at once, with the difference made honest. |

Ordered by dependency and by value-per-effort. 6a.1 alone would meaningfully
improve the app; 6a.4 is the largest piece and depends on nothing before it, so
it can be resequenced if you would rather have comparison sooner.

---

## 6a.1 — The explain layer

**~4 days.** Teach the notation, in place, at the reader's chosen level.

Three mechanisms, all reusing the reading-level switch already built:

- **A notation key.** A small, permanent legend that says what the shapes mean:
  a spiral ribbon is a helix, a flat arrow is a β-strand pointing from N to C, a
  thin tube is a loop. Not buried in a help sheet — visible while looking at the
  thing it explains.
- **Read-out explainers.** Every number gets a proper affordance (not a `title`
  attribute, which is invisible on touch and to screen readers) giving a
  plain-English definition and, crucially, **what a change in it means**.
  "RMSD 12 Å" means nothing; "still 12 Å away from its folded shape" means
  something.
- **A first-look checklist.** Three things to notice in *this* structure,
  authored per entry — the structural equivalent of "check rate, rhythm, axis".
  For haemoglobin: no arrows anywhere; four subunits; a haem in each pocket.

**Content model:** extends `packages/content` with `notation` and `firstLook`
fields. Same verification discipline as Phase 6 — a first-look item that names a
residue is checked against the structure file.

**Gate:** every read-out has an explainer at all three levels; every structure
has three first-look items; nothing relies on hover alone.

---

## 6a.2 — Orientation tour

**~4 days.** Six steps, shown once, skippable, replayable from the menu.

Deliberately **not** the whole app. This answers "where am I and what can I
touch": the library is organised by disease, this is the model and you can drag
it, this is the timeline, these numbers are computed live, this button tells you
what is real. It must be finishable in under a minute.

Everything about *reading* a molecule belongs in 6a.3, not here. Conflating the
two produces the tour everyone skips.

**Behaviour**

- Fires on first visit only (persisted in `localStorage`, keyed by a tour
  version so a rewritten tour can re-fire).
- Never fires when the reader arrived on a deep link — they were sent to
  something specific, and interrupting that is hostile.
- Replayable any time from the masthead.
- `Esc` and a visible Skip always available. Focus is trapped in the coach-mark
  while it is open, and returned to where it came from on exit.
- Honours `prefers-reduced-motion`: spotlight moves cut rather than animate.

---

## 6a.3 — Story tours

**~1 week.** The valuable one. This is the teaching.

A story tour drives the whole application: it changes structure, moves the
timeline, switches colour mode, flies the camera to a residue, spotlights it,
and explains what the reader is now looking at — in their chosen register.

### The key architectural insight

**A tour step is a `ViewState` plus an anchor plus copy.** Nothing new is
needed to drive the app; the store, the URL codec and the presets already exist,
and `project()` in `packages/render/src/picking.ts` already converts a residue
position to a screen coordinate for placing a callout.

```
TourStep {
  id
  view      Partial<ViewState>        // structure, timeline, colour, representation
  anchor    { kind: "element", selector } | { kind: "residue", chain, resNum }
  copy      LeveledText
  camera?   { orient?, zoom? }
  dwell?    ms before auto-advance, if the reader wants it hands-free
}
```

Because a step is a `ViewState`, **every step is also a shareable link** — the
existing URL work means a lecturer can send someone to step 4 of the sickle cell
tour without any new machinery.

### The four tours

One per clinical story, authored in `packages/content`:

- **Sickle cell** (8 beats) — HbA's β6 glutamate on the surface → the acceptor
  pocket that sits empty → switch to HbS → the same position is now valine →
  the neighbouring tetramer → *why deoxy only*, and therefore why crises are
  triggered by hypoxia.
- **Cystic fibrosis** (7 beats) — Phe508 on the NBD1 surface → the ATP site,
  nowhere near it → switch to ΔF508 → the numbering skips 508 → **the fold is
  broadly the same**, which is the lesson → full-length CFTR for the interface
  it breaks.
- **Imatinib** (6 beats) — the DFG-out conformation → Thr315 and its hydrogen
  bond → switch to T315I → isoleucine, bulkier and no hydroxyl → ponatinib's
  linker threading past it.
- **Nirmatrelvir** (6 beats) — the catalytic dyad → the nitrile at Cys145 →
  the monomer's incomplete site → the dimer's N-finger completing it.

### Staying in step with the app

Tours are the classic thing that rots: a selector changes, and step 3 points at
nothing. Guarded by tests, in the same spirit as Phase 6's residue checks:

- Every `element` anchor selector must match exactly one node in a rendered app
- Every `residue` anchor is verified against the structure file, as in Phase 6
- Every step's `view` must parse against the `ViewState` schema
- Every step has copy at all three reading levels
- Tour order must visit structures in the order its story lists them

---

## 6a.4 — Compare mode

**~2 weeks.** Two structures at once, with the difference told honestly.

### The trap that has to be designed around

**Crystallographic noise is larger than the biological difference.** Two
structures of the same protein solved independently typically differ by
0.3–0.5 Å RMSD from crystal packing, temperature and refinement alone. HbA and
HbS differ by *one residue out of 574*.

So a naive "difference colouring" would light up the whole molecule with noise,
and β6 — the residue that causes the disease — would not stand out at all. A
reader would conclude the structures are different all over, which is false and
worse than showing nothing.

This is not a detail to discover during implementation. It changes the design:

- Per-residue deviation is displayed **against an explicit noise floor**,
  labelled as such, so a reader can see which deviations mean anything.
- The headline framing is inverted: not "here is what differs" but **"these are
  almost identical, and yet one causes disease."** That is the more accurate
  statement *and* the better teaching point.
- Curated annotation carries the mechanism. Geometry alone cannot.

The same applies with force to ΔF508, where **what does not differ is the
lesson**: the ATP site is intact, the fold is broadly preserved. A diff view
that only highlighted change would actively teach the wrong thing — that the
channel is broken, when the whole point is that the channel would work.

### Two comparison modes, because the questions differ

| | Side by side | Superposed |
|---|---|---|
| Layout | Two viewports, linked cameras | One viewport, two overlaid models |
| Good for | Different assemblies — HbA's 4 chains vs HbS's 8 | Same domain, local change — NBD1 vs ΔF508 |
| Shows | Whole-structure architecture | Precise local deviation |

Each curated pair declares its default; the reader can switch.

### Superposition needs real alignment, not indices

ΔF508 has a residue deleted, so after position 508 the two chains' indices are
permanently off by one. Superposing by array index would misalign every residue
in the C-terminal half and produce a confident, meaningless number.

Alignment is by **author residue number**, on the intersection of residues
present in both, with the count of aligned residues reported. Kabsch runs on
that common set only. Where coverage differs (2BBO resolves 254 residues, 2BBS
242 per chain) the unaligned regions are drawn but excluded from the fit and
from the deviation statistics.

### One renderer, two viewports

Naively, side-by-side means two `Stage` instances and two `WebGLRenderer`s.
Browsers cap live WebGL contexts at roughly 8–16, and each renderer duplicates
shader programs and GPU state.

Instead: **one renderer, two scissored viewports** (`setViewport` /
`setScissor`), sharing lights and materials. This also makes camera linking
trivial — it is one camera used twice — and halves the memory for what is
already the heaviest screen in the app.

### Collapsing the non-essential

As requested. Compare mode hides the library rail and the story panel, shrinks
the read-outs to a single row, and gives the space to a **difference panel**:

- Aligned-residue count and overall RMSD, with the noise floor beside it
- A per-residue deviation track under the sequence, sharing the sequence-track
  component already built
- Metrics side by side: radius of gyration, buried core, contact order
- The curated "what differs / what does not" — the part that carries meaning

Leaving compare mode restores the previous layout.

### URL state

`?cmp=hba-deoxy,hbs-deoxy&cv=superposed&t=1`. Same rules as everything else:
defaults omitted, malformed values degrade rather than throw, and every compare
view is a link a lecturer can paste.

### Curated pairs for v1

Not arbitrary any-two — each pair carries editorial content and a verified
residue focus:

| Pair | Default view | The point |
|---|---|---|
| HbA ↔ HbS | Side by side | One residue in 574; the acceptor pocket |
| NBD1 ↔ NBD1 ΔF508 | Superposed | What does *not* change |
| ABL ↔ ABL T315I | Superposed | One side chain closes a pocket |
| Mpro ↔ Mpro dimer | Side by side | The N-finger completing its partner |

Arbitrary pairing can come later; it needs an alignment story for unrelated
proteins, which is a different problem.

---

## Sequencing and gates

| Step | Effort | Exit gate |
|---|---|---|
| 6a.1 Explain layer | ✅ done | Met: 4 read-outs explained at 3 levels with rise/fall meaning, 3 notation entries, 27 first-look items with residue claims verified |
| 6a.2 Orientation tour | 4 d | Finishable in under a minute; never fires on a deep link; focus trapped and restored |
| 6a.3 Story tours | 1 wk | Four tours; every anchor and residue claim verified by test; every step is a link |
| 6a.4 Compare mode | 2 wk | Alignment by residue number with count reported; one renderer; noise floor displayed; four curated pairs |

**Verification, in the pattern this project has settled into:** pure logic
(alignment, deviation statistics, tour-step resolution, URL codec) gets unit
tests; content claims get checked against the structure files; and the
interface gets looked at, because that is where every renderer and layout bug
so far has actually been found.

---

## Risks

| Risk | Mitigation |
|---|---|
| **Deviation plots read as noise** | Explicit noise floor, inverted framing, curated annotation carries the mechanism |
| **Superposition silently misaligns** | Align by residue number, never index; report aligned count; test on the ΔF508 pair specifically |
| **Tours rot as the UI changes** | Anchor-existence tests fail the build |
| **The tour is the thing everyone skips** | Keep orientation to six steps and under a minute; put the teaching in story tours the reader chooses to start |
| **Two WebGL contexts** | One renderer, scissored viewports |
| **Compare is unusable on a phone** | Stack vertically below 900 px; superposed becomes the default there, since side-by-side halves an already small viewport |

---

## What this phase deliberately does not do

- **No assessment.** Questions and Anki export remain later work; this phase is
  about comprehension, not testing it.
- **No arbitrary structure pairing.** Curated pairs only.
- **No sequence-alignment engine.** Residue-number intersection is sufficient
  for variants of the same protein, which is all v1 compares.
