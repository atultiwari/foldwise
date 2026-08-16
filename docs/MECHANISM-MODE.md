# Mechanism mode (Phase 6b)

## Why this exists

Phase 6a added a guided tour. It was better than nothing and it still failed the
test that matters. A step said *"this is position β6"* while drawing a 30-pixel
ring on a 574-residue tetramer framed whole. Nobody could see the residue. Worse,
a reader who *could* see it still had no path from that residue to a patient in
pain — because fibre formation, a red cell deforming and a vessel occluding are
not atomic-scale events and no amount of 3D will ever show them.

The underlying problem is that the application was **structure-first with
clinical text attached**, while a clinician reasons along a chain:

```
gene → protein → trigger → assembly → cell → patient
```

The atomic model can only ever show one or two links of that.

## What was built instead of a movie

The brief was "an interactive simulation of all the steps, like a movie but
interactive". A movie with a next button is still watching. The design shipped
here gives the reader **the causal variables** rather than the playhead:

- Set the genotype and the oxygen tension.
- Every stage of the chain re-resolves at once — visible in the stepper without
  stepping anywhere.
- HbS + low O₂ → a fibre grows → the cell sickles → the vessel jams.
- HbS + normal O₂ → nothing, at every stage after the protein.
- HbA + low O₂ → the pocket still opens, and nothing docks in it.
- HbS + high HbF → the fibre is terminated, and that is why hydroxyurea works.

A reader who does that has *derived* why crises are episodic. Manual stepping and
auto-play at three speeds are there too — they were asked for, and they are the
right way to walk a chain the first time — but they are the transport, not the
teaching.

## The pieces

| Piece | Where |
|---|---|
| Content model | `packages/content/src/mechanism.ts` |
| The four mechanisms | `packages/content/src/mechanisms.ts` |
| Schematics (11 drawings) | `apps/web/src/schematics/` |
| View | `apps/web/src/components/mechanism/` |
| Styles | `apps/web/src/styles/mechanism.css` |

### Data model

A `Mechanism` is a list of `MechanismStage`s ordered by scale, plus the
`MechanismControl`s the reader sets. Each stage carries `Outcome`s matched
first-wins against the control settings; the last must match anything.

An outcome may carry `shows`, replacing the stage's structure and focus residue.
That is what lets *choosing HbS* actually put HbS on screen — without it the
protein stage showed HbA's glutamate under a caption reading "valine is greasy",
which is the same class of error the whole phase exists to fix.

### Two kinds of evidence, never conflated

- **Structure stages** load a deposited entry, fly the camera to the residue
  (`Stage.focusOn`), fade everything else (`emphasise`), and pin a label to it
  that tracks the molecule as it turns. The provenance line reads
  *"Deposited structure · 2HBS · 2.05 Å"*.
- **Schematic stages** are hand-drawn SVG that varies with the outcome's state.
  The provenance line reads *"Diagram — this scale has no structure to show"*.

The honesty panel says the same thing at more length, including that the
outcomes are established biology written down rather than anything computed.

## Prerequisite fixes this phase required

- `Stage.focusOn(chain, residue, radius)` / `clearFocus()` — `frameAll()`
  short-circuits on a held focus, so a conformation change no longer yanks the
  camera back out to the whole molecule.
- `emphasise(colors, keep, dim)` — fades toward mid grey rather than black, so
  the silhouette still reads and a reader zoomed onto one residue knows where
  they are.
- Per-field URL decoding — a mangled parameter now falls back to what the rest
  of the link implies rather than to a fixed constant, so `?m=fold&t=banana`
  gives the Fold preset's timeline position.

## What is in the URL

`stage` (`st`) and `vars` (`v`, as `genotype:hbs,oxygen:low`), so *"sickle cell,
low oxygen, at the assembly step"* is a link. Keys are sorted on encode, so the
same setting always produces the same link. Both are validated against the
mechanism's own definition on the way in — a stale link from another story
degrades to the defaults rather than putting a control into a state with no
outcome behind it.

## Tests

108 tests over the content and the drawings. The ones that carry weight:

- Every residue any reachable control setting can focus is looked up in the
  emitted structure file and checked against the amino acid claimed.
- Every reachable combination of controls resolves an outcome, and the resolved
  outcome genuinely applies rather than falling through to the catch-all.
- Every mechanism has both a harmful and a safe outcome at the patient stage —
  if the settings converge, the reader learns nothing about why the variable
  matters.
- Every schematic a stage names exists, renders for every state it can be in,
  and **draws something different for each** — a drawing that ignores its state
  is a picture the controls cannot change.
- The chain never moves back down the scale, and always ends at the patient.

## Known limits

- The controls are switches; real patients are a spectrum. HbSC, β-thalassaemia
  compound heterozygotes and the full range of CFTR classes are not represented.
- The schematics are illustrative. Fibre geometry, cell dimensions and vessel
  calibre are not to scale and are not measurements.
- Four mechanisms only, matching the four v1 clinical stories.
