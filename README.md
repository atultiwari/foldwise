# Foldwise

An interactive protein-folding explorer built around clinical stories.

Existing folding visualisers answer *"what is protein folding?"*. Foldwise is built to
answer **"why does this patient have this disease, and why does this drug work?"** —
with folding as the mechanism.

Every structure is a real PDB entry. Every measurement is computed from the coordinates
on screen. Everything that is a model rather than a measurement is labelled as one.

---

## Status

**Phases 0–5 complete.** The application runs: pick a structure, press play, and
watch it fold, with every read-out computed live from the coordinates on screen.
What remains is the editorial layer — the writing that makes it teach.

| Phase | Scope | State |
|---|---|---|
| 0 · Spike and decide | Stack choice, end-to-end proof | ✅ **Done** |
| 1 · Data pipeline | mmCIF → validated JSON, own DSSP | ✅ **Done** — 51 tests, 96.0% DSSP agreement |
| 2 · Core maths | Kabsch, Rg, RMSD, contacts, SASA, H-bonds, salt bridges, composition | ✅ **Done** — 107 tests, SASA within 0.02% of FreeSASA |
| 3 · Trajectory engine | Calibrated coil, folding schedule, constrained morph | ✅ **Done** — 24 invariant tests, runs in a Worker |
| 4 · Renderer | Cartoon, atoms, sticks, surface, colour modes, picking | ✅ **Done** — 81 tests, all four representations verified visually |
| 5 · UI shell | React panels, SVG charts, URL state | ✅ **Done** — every view is a shareable link |
| 6 · Editorial layer | Per-structure copy, honesty panel, citations | ⏳ **Next** |
| 7 · Ship | Export, PWA, accessibility | ⬜ Pending |

Phase gates and the full plan live in the parent workspace, outside this repo:
`../docs/02-BUILD-PLAN.md`.

### What works today

```bash
pnpm dev        # the application                         -> localhost:5274
pnpm data       # rebuild all 9 structures from RCSB     -> 9 built, 0 failed
pnpm test       # core, fold, render, ui                  -> 255 passed
pnpm dev:render # renderer-only visual harness            -> localhost:5273
pnpm coverage   #                                        -> 99% statements
pnpm typecheck
cd pipeline && uv run pytest                            # -> 51 passed
```

Regenerate the FreeSASA reference fixture after changing the pipeline:

```bash
cd pipeline && uv run python -m foldwise.cli reference
```

### What does not exist yet

- No editorial content. Structures have no story, no annotations and no
  citations yet — that is Phase 6, and it is what makes this teach rather than
  merely display.
- No assessment, no Anki export, no compare mode.

---

## Setup

**Prerequisites**

| Tool | Version used | Notes |
|---|---|---|
| Node | 22.x | |
| pnpm | 9.12.0 | pinned via `packageManager` |
| Python | 3.10+ | |
| [uv](https://docs.astral.sh/uv/) | any recent | manages the pipeline's own venv |

No bioinformatics toolchain is required. DSSP is implemented in-tree, so there is
nothing to `brew install` — see [Design decisions](#design-decisions).

**Install**

```bash
pnpm install
cd pipeline && uv sync
```

**Build the structure data**

```bash
pnpm data
```

Downloads mmCIF and entry metadata from RCSB into `data/cache/` (gitignored), parses,
validates, and writes one JSON file per structure into `data/structures/`. The cache
makes reruns instant. To rebuild a single entry:

```bash
cd pipeline && uv run python -m foldwise.cli build --only nbd1-wt
```

**Run the tests**

```bash
cd pipeline && uv run pytest              # all 51
cd pipeline && uv run pytest -m "not network"   # skip PDBe cross-validation
```

---

## The v1 library

Four clinical stories, nine structures. Every PDB ID was verified against the RCSB API
on 2026-08-16; residue counts and resolutions in `pipeline/foldwise/catalog.py` are
real, and the build fails if an entry drifts from them.

| Story | Entry | PDB | Role | Residues | Ligand |
|---|---|---|---|---:|---|
| **Sickle cell** | `hba-deoxy` | 2HHB | wild-type | 574 | haem ×4 |
| | `hbs-deoxy` | 2HBS | variant | 1148 | haem ×8 |
| **Cystic fibrosis** | `nbd1-wt` | 2BBO | wild-type | 254 | ATP·Mg |
| | `nbd1-df508` | 2BBS | variant | 484 | ATP·Mg |
| | `cftr-full` | 6MSM | context | 1181 | ATP·Mg |
| **Imatinib** | `abl-imatinib` | 1IEP | wild-type | 548 | **STI** (imatinib) |
| | `abl-t315i-ponatinib` | 3IK3 | resistance | 566 | **0LI** (ponatinib) |
| **Nirmatrelvir** | `mpro-nirmatrelvir` | 7VH8 | wild-type | 306 | **4WI** (nirmatrelvir) |
| | `mpro-dimer` | 8DZ2 | context | 607 | **4WI** ×2 |

Structures above ~700 residues are marked `static` — shown in their native state, with
no folding trajectory, because a 96-frame constrained morph for them does not fit the
frame budget. That is a performance decision and it is disclosed in the UI.

---

## Repository layout

```
foldwise/
├── pipeline/                 Python. Runs offline; output is committed.
│   ├── foldwise/
│   │   ├── catalog.py        The v1 manifest: what to fetch and why
│   │   ├── fetch.py          RCSB mmCIF + metadata, cached and date-stamped
│   │   ├── parse.py          mmCIF → chains; gaps, altlocs, insertion codes
│   │   ├── residues.py       One-letter codes, virtual Cβ, ligand filtering
│   │   ├── dssp/             Kabsch–Sander secondary structure
│   │   ├── model.py          Pydantic schema — the contract with the browser
│   │   ├── validate_ss.py    Cross-validation against PDBe
│   │   └── cli.py            `python -m foldwise.cli build`
│   └── tests/                51 tests
├── packages/
│   ├── core/                 Pure biophysics maths -- no DOM, no three.js
│   │   ├── src/              vec3, rg, kabsch, rmsd, contacts, contactOrder,
│   │   │                     sasa, hbonds, saltBridges, composition
│   │   └── test/fixtures/    FreeSASA reference, generated by the pipeline
│   ├── fold/                 Folding trajectory engine
│   │   └── src/              random, spatialHash, coil, onset, constraints,
│   │                         morph, trajectory, worker
│   ├── render/               Geometry, colour and the renderer
│   │   └── src/              spline, profile, ribbon, instanced, surface,
│   │                         palette, colorModes, camera, picking,
│   │                         stage (the only three.js file)
│   └── ui/                   URL state, chart geometry, structure schema
├── apps/web/                 The application -- React shell around the renderer
├── dev/                      Visual harness -- `pnpm dev`
├── data/
│   ├── cache/                Raw downloads — gitignored
│   └── structures/           Emitted JSON — committed
└── docs/VALIDATION.md        What has actually been proven, with numbers
```

Every view is a shareable link: `?p=mpro-nirmatrelvir&t=1&m=chemistry` restores
the structure, the timeline position and the preset.

---

## Design decisions

**DSSP is implemented in-tree, not shelled out to `mkdssp`.** `mkdssp` is an awkward
build dependency and its output cannot be verified from inside the pipeline. Ours is
~200 lines, unit-tested against synthetic hydrogen-bond maps, and cross-validated
against PDBe's independent assignment at **96.0% across 5,668 residues**.

**Structures are pre-baked into typed JSON.** No mmCIF parser ships to the browser. The
heavy structural biology happens once, offline, in a language suited to it.

**Every frame keeps the chain a chain.** The animation is steered rather than
cross-faded: interpolating each residue straight from coil to native stretches
the chain to twice its length mid-transition. Instead the conformation is pulled
toward a target and snapped back onto exact native bond lengths after every
partial step, so at any point on the timeline every Cα–Cα distance is correct to
better than 0.01 Å.

**Approximations are measured, not assumed.** Where the browser cannot apply a
published criterion exactly — it has one point per side chain, not every atom —
the pipeline computes the real answer from the full mmCIF and the gap is
recorded in `docs/VALIDATION.md`. Salt bridges recover 11 of 12 with no false
positives; the miss is documented rather than tuned away.

**Unobserved residues are reported, not hidden.** 2BBO is missing CFTR's entire
regulatory insertion (405–435); 6MSM is missing 270 residues of the R domain. Both are
intrinsically disordered — which is part of *why* CFTR is fragile. Every chain break is
recorded with its missing-residue count so the viewer can render it honestly.

**The catalog asserts against reality.** Each entry records the residue count and chain
count RCSB reports. If a PDB entry is revised and no longer matches, the build fails
rather than silently shipping something else.

---

## Scientific integrity rules

These are constraints on the product, not aspirations. Full text in
`../docs/03-MEDICAL-LAYER.md §G`.

- **This is not a clinical decision tool** and must never resemble one. Computed values
  live in a visually separate, explicitly labelled region from any sourced clinical
  classification.
- **Variant interpretation is ACMG/AMP territory.** Structural evidence maps to PP3/BP4
  at most, PM1 for established hotspots. Say so in the interface.
- **No patient data.** Public reference variants only.
- **Version and date-stamp everything.** PDB entries are revised; every emitted
  structure carries its retrieval date and the pipeline version that produced it.
- **Label every model.** If an honest sentence cannot be written about a number, the
  number is not displayed.

---

## Licence

| What | Terms |
|---|---|
| Source code | [MIT](LICENSE) |
| Editorial and documentation content | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Structural data under `data/` | CC0 1.0 — from RCSB, not ours to license |

**Not a medical device.** Not for clinical decision-making, diagnosis, or treatment.
Full terms and constraints in [NOTICE.md](NOTICE.md).

## Attribution

Structural data from the [RCSB Protein Data Bank](https://www.rcsb.org), released into
the public domain (CC0 1.0). Secondary-structure cross-validation uses the
[PDBe API](https://www.ebi.ac.uk/pdbe/api/doc/) (EMBL-EBI).

Later phases will add sources with stricter terms — AlphaFold DB and UniProt are
CC-BY-4.0 and require attribution; ChEMBL is share-alike; DrugBank is non-commercial
only. See `../docs/02-BUILD-PLAN.md §4` in the parent workspace.
