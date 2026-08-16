# Validation Record

What has actually been proven, with numbers. Every claim the app makes about
being "real" has to trace back to a line in this file.

**Pipeline version:** 0.1.0 · **Run:** 2026-08-16 · **PDB release:** as retrieved 2026-08-16

---

## 1. Secondary structure

We compute DSSP ourselves (Kabsch & Sander 1983 electrostatic H-bond energy,
`pipeline/foldwise/dssp/`) rather than shelling out to `mkdssp`, which is not
installed on most machines and cannot be verified from inside the pipeline.

Validated against **PDBe's independent secondary-structure assignment**
(`ebi.ac.uk/pdbe/api/pdb/entry/secondary_structure`), 3-state (helix / strand / other):

| Entry | Chains | Agreement |
|---|---|---|
| 2HHB | A–D | 96.6 – 99.3 % |
| 2HBS | A–H | 94.5 – 99.3 % |
| 2BBO | A | 96.1 % |
| 2BBS | A, B | 94.5 %, 94.8 % |
| 6MSM | A | 97.4 % |
| 1IEP | A, B | 94.2 %, 96.7 % |
| 3IK3 | A, B | 94.6 %, 94.4 % |
| 7VH8 | A | 92.8 % |
| 8DZ2 | A, B | 94.4 %, 92.1 % |

**Weighted overall: 96.0 % across 23 chains and 5,668 residues.** Every chain
clears 92 %; the gate in CI is 90 % per chain and 94 % overall.

### Two traps found on the way here

1. **The depositor's HELIX/SHEET records are not a DSSP reference.** Foldscape's
   own 1UBI string (`EEEEEEECC...`) matches the mmCIF `struct_conf` /
   `struct_sheet_range` ranges exactly, not DSSP — author assignments are
   systematically more generous at strand ends. Measured against it our output
   looked like 83 %; against real DSSP the same output is 97.4 %.
2. **PDBe's `residue_number` is entity-sequential, not author numbering.** Using
   it silently scored domain constructs like 1IEP (author numbering starts at
   229) and 2BBO (starts at 389) at ~40 %. The correct field is
   `author_residue_number`.

Both are recorded because either one would have produced a confidently wrong
number.

### Fixed during validation

- Bridge detection excluded index 0 and the final residue, shortening every
  terminal strand by a residue. Regression test:
  `test_terminal_residues_can_form_bridges`.

---

## 2. Virtual Cβ

Glycine has no Cβ, but burial and hydropathy need a side-chain direction for
every residue, so one is constructed from N, CA and C.

- Ideal backbone geometry (1.458 Å, 1.525 Å, 111°) → **|CA–CB| = 1.530 Å**, the
  textbook value.
- Against **observed** Cβ positions on 70 real non-glycine residues in 1UBI:
  **mean deviation 0.092 Å, worst 0.457 Å.** A mirrored construction would land
  ~2.4 Å out, so this also fixes the chirality.

---

## 3. Structure coverage

Unobserved residues are a fact about the experiment, not a pipeline failure.
The viewer reports them rather than hiding them.

| Entry | Resolved | Deposited | Coverage | Unobserved | Note |
|---|---:|---:|---:|---:|---|
| 2HHB | 574 | 574 | 100 % | 0 | |
| 2HBS | 1148 | 1148 | 100 % | 0 | |
| 7VH8 | 306 | 306 | 100 % | 0 | |
| 8DZ2 | 607 | 612 | 99 % | 0 | |
| 3IK3 | 566 | 576 | 98 % | 6 | |
| 1IEP | 548 | 586 | 94 % | 0 | |
| 2BBO | 254 | 291 | 87 % | 34 | **Regulatory insertion (405–435) is disordered** |
| 2BBS | 484 | 580 | 83 % | 82 | Same RI, both copies |
| 6MSM | 1181 | 1506 | 78 % | 270 | **R domain of CFTR is intrinsically disordered** |

The two lowest-coverage entries are low for a genuinely interesting reason, and
both are teaching material rather than defects: CFTR's regulatory insertion and
R domain are disordered, which is *why* they are hard to study and part of why
the protein is fragile.

---

## 4. Biological sanity checks

Secondary-structure fractions match what each fold should be — an independent
check that the assignment is not merely self-consistent:

| Entry | Helix | Strand | Expected |
|---|---:|---:|---|
| 2HHB / 2HBS | 81 % / 80 % | **0 %** | Globin fold is all-α. Zero β-sheet is correct. |
| 6MSM | 62 % | 9 % | Membrane protein, dominated by TM helices. |
| 1IEP / 3IK3 | 42 % / 47 % | 15 % | Bilobal kinase: β-rich N-lobe, α-rich C-lobe. |
| 2BBO / 2BBS | 38 % / 41 % | 21 % / 22 % | ABC nucleotide-binding domain, α/β. |
| 7VH8 / 8DZ2 | 26 % / 27 % | 28 % | Two β-barrels plus helical domain III. |

## 5. Ligands

Crystallisation furniture (glycerol, PEG, sulfate, bulk ions) is filtered out;
biology is kept. All four target drugs are present:

| Entry | Component | Is |
|---|---|---|
| 1IEP | `STI` ×2, 37 atoms | **imatinib** |
| 3IK3 | `0LI` ×2, 39 atoms | **ponatinib** |
| 7VH8 | `4WI`, 35 atoms | **nirmatrelvir** |
| 8DZ2 | `4WI` ×2, 35 atoms | nirmatrelvir, both protomers |
| 2HHB / 2HBS | `HEM` ×4 / ×8 | haem b |
| 2BBO / 2BBS / 6MSM | `ATP`, `MG` | bound nucleotide |

---

## 6. Test suite

`pipeline/tests` — **51 tests, all passing.** 40 s (network tests dominate).

- `test_dssp.py` — H-bond energy, amide-H placement, turn/helix/bridge/ladder
  logic, DSSP precedence, on synthetic maps
- `test_parse.py` — residue coding (MSE→MET), ligand filtering, virtual Cβ,
  gap detection (numbering jumps, stretched bonds, insertion codes), schema
- `test_cross_validation.py` — PDBe agreement per chain and catalog-wide,
  observed-Cβ deviation (marked `network`)

---

## 7. Core maths — `packages/core` (Phase 2)

**107 tests, 99.8% statement / 96.7% branch coverage.**

### SASA — against FreeSASA

Our Shrake–Rupley is compared against **FreeSASA**, an established C library,
over *exactly* the N/CA/C/O/CB atoms our model carries. Comparing a backbone
surface against an all-atom one would mean nothing, so the reference is
regenerated on the same atom set by `python -m foldwise.cli reference`.

| Structure | Atoms | Ours | FreeSASA | Deviation | Worst residue |
|---|---:|---:|---:|---:|---:|
| 1UBI | 380 | 4,997.0 Å² | 4,996.2 Å² | **0.02 %** | 1.37 Å² |
| 7VH8 | 1,530 | 17,105.1 Å² | 17,094.9 Å² | **0.06 %** | 1.54 Å² |

Per-residue Pearson correlation > 0.995 on both. Gate in CI is 2 % total,
0.995 correlation, and no residue off by more than 12 Å².

At 960 sample points, 1,530 atoms take **46 ms** — comfortably inside an
interactive budget.

### Radius of gyration

Matches NumPy to 4 decimal places on both fixtures (1UBI 11.4776 Å,
7VH8 21.5731 Å). Also checked against analytic cases: points on a sphere of
radius *r* give exactly *r*; a uniform rod of length *L* gives *L*/√12.

### Kabsch superposition

Solved in the quaternion form via Jacobi eigendecomposition of Horn's key
matrix, so the result is a proper rotation **by construction**.

- Self-superposition, pure translation and known rotation all recover to
  10 decimal places
- `det(R) = 1` to 9 decimal places
- **A mirror image does not fit.** The SVD form of Kabsch can silently return a
  reflection, which would superpose a molecule perfectly onto its enantiomer.
  Proteins are chiral, so this has a regression test.

### Contact order — and a trap that cost a factor of two

Ubiquitin's relative contact order comes out at **15.3 %** against the ~15 %
in Plaxco, Simons & Baker (1998).

Getting there exposed a real conflation. **Contact order and the folding
coordinate Q use different contact definitions:**

| | Cutoff | Min. separation | Ubiquitin RCO |
|---|---:|---:|---:|
| Q (native contact map) | 8 Å | \|i−j\| ≥ 3 | 28.5 % |
| **Contact order** | 6.5 Å | **\|i−j\| ≥ 1** | **15.3 %** |

Q excludes near-neighbours because residues that are nearly bonded are in
contact trivially. Contact order includes them, because they are part of what
makes a protein's contacts local. Applying Q's exclusion to contact order
roughly doubles the answer. The two conventions are now separate constants with
a regression test asserting they disagree, so the mistake cannot recur silently.

**Caveat, stated plainly:** Plaxco's criterion is any two *heavy atoms* within
6 Å. Our model has no side chains beyond Cβ, so we approximate it with a wider
Cα cutoff calibrated on a single protein. It is not the published definition and
should not be quoted as though it were.

### Hydrogen bonds — exact agreement across two languages

The pipeline computes the Kabsch–Sander map in Python to assign secondary
structure; `packages/core` computes it in TypeScript on every animation frame.
Both are checked against the same fixture:

| Structure | Native bonds | TypeScript reproduces |
|---|---:|---:|
| 1UBI | 57 | **57 / 57 — 100 %** |
| 7VH8 | 192 | **192 / 192 — 100 %** |

Bond for bond, donor for donor. Two independent implementations of the same
criterion agreeing exactly is a much stronger statement than either agreeing
with itself.

Also checked on real coordinates: within ubiquitin's α-helix (residues 23–34)
there are exactly **8 bonds, all of them i→i+4** — the defining ladder.

> An earlier version of that test bounded only one end of the bond and so also
> caught β-sheet bonds between strands 1 and 5, whose partners sit sixty
> residues apart. The fix was to the test.

### Salt bridges — a measured approximation

Barlow & Thornton (1983) define a salt bridge by an **all-atom** test: a charged
nitrogen of Arg/Lys/His within 4 Å of a carboxylate oxygen of Asp/Glu. The
browser holds one point per side chain and cannot apply that directly, so the
pipeline now emits a charged-group centroid (`sc`) per residue and the browser
uses a 5 Å centroid criterion.

The approximation is **measured against the real all-atom answer**, which the
pipeline computes from the full mmCIF:

| Structure | All-atom bridges | Recovered | False positives |
|---|---:|---:|---:|
| 1UBI | 3 | 2 | **0** |
| 7VH8 | 9 | **9** | **0** |

The single miss is Arg54–Asp58 in ubiquitin, whose group centroids are
**5.01 Å** apart — one hundredth of an angstrom past the threshold. The cutoff
has deliberately *not* been widened to capture it: tuning a threshold on one
data point is fitting noise, not calibrating.

---

## 8. Trajectory engine — `packages/fold` (Phase 3)

**24 tests.** These are not example checks: each one holds over *every frame* of
a trajectory, because a single bad frame is a frame in which the app is showing
something a protein cannot do.

| Invariant | 1UBI (76 res, 96 frames) | 7VH8 (306 res, 192 frames) |
|---|---|---|
| Worst bond-length error, any bond, any frame | **< 0.01 Å** | **< 0.01 Å** |
| Closest non-bonded approach vs the native structure's own floor | 4.00 Å vs 4.00 Å | 3.79 Å vs 3.92 Å |
| Frame 0 radius of gyration vs the Kohn scaling law | 25.70 vs 25.72 Å (**0.08 %**) | 60.38 vs 59.16 Å (2.1 %) |
| Final frame RMSD to the deposited structure | ~1×10⁻⁶ Å | ~1×10⁻⁶ Å |
| Same input ⇒ byte-identical output | yes | yes |
| Generation time | 84 ms | 932 ms |

The final-frame residual is Float32 storage precision, not algorithm error:
coordinates around 50 Å quantise at roughly 4×10⁻⁶ Å. The last frame is set to
the deposited coordinates directly rather than steered toward them.

**932 ms is why generation runs in a Web Worker.** Frames come back as
transferred buffers rather than copies.

### Three things that had to be got wrong first

**1. Bisecting the coil's stiffness was bisecting noise.** The radius of
gyration of a *single* self-avoiding walk is dominated by which path it took,
not by the stiffness it was drawn at. Measured across five seeds at fixed
stiffness, ubiquitin-length walks ranged from **17 Å to 36 Å**, while sweeping
stiffness end to end moved the mean by about 9 Å. Bisection on a parameter whose
effect is smaller than the noise around it converges to noise — it left the coil
13 % off target. Drawing candidates and *measuring* them gets to 0.08 %.

**2. The clash threshold cannot be a round number.** Real structures put
non-bonded α-carbons closer than any threshold one might pick: ubiquitin's own
minimum is 4.00 Å, Mpro's 3.92 Å. The first version used a fixed 4 Å and damped
the separating push by how folded each residue was, so as not to fight the
native packing — but that damping went to zero exactly where the chain is most
crowded, and residues ended up **0.68 Å apart, passing straight through each
other**. Taking the floor from the native structure removes the conflict
entirely, because whatever the folded state does is by definition possible.

**3. Repairing overlaps is much harder than preventing them.** Declashing once
per frame let residues drive deep into each other across eight sub-steps, and
separating a deep overlap just displaces both residues into their neighbours.
A light pass after every sub-step keeps every correction small. Combined with
snapping bonds *inside* the declash loop rather than after it — the final snap
re-places every residue from the chain midpoint outward and was undoing the
separation it had just achieved — this took the worst overlap from 0.68 Å to
within 0.13 Å of the native floor.

### What the engine claims, and what it does not

- **Claimed:** the endpoints are real, every bond length is exact throughout,
  the unfolded state is the size the experiments say it is, and the *order* in
  which regions fold follows contact order — local structure first, long-range
  closures last (Plaxco, Simons & Baker 1998).
- **Not claimed:** that this is the pathway. No protein's folding route has ever
  been observed. The specific frames are a model, and the app says so.

---

## 9. Renderer — `packages/render` (Phase 4, cartoon only)

**49 tests.** Geometry and colour are three.js-free and tested without a
graphics context; the three.js binding is a thin layer over them.

### Mesh invariants

Checked on real structures: every index references a vertex that exists, no
triangle is degenerate, every normal is unit length, every vertex is assigned to
a real residue and sits within 4 Å of some α-carbon, and the frame never flips
between neighbours — the last of these is what stops a β-sheet's ribbon tearing
where its curvature reverses.

`updateRibbon` rewrites positions without touching the index buffer, so the
folding animation never reallocates topology. Measured at **under 8 ms** for 306
residues, against a 16 ms budget at 60 fps.

### Colour vision — the palettes are measured, not asserted

Around one man in twelve has a red-green colour vision deficiency. Every
categorical palette is simulated under protanopia, deuteranopia and tritanopia,
and every pair within a mode must stay above ΔE 15 (CIE76).

The check found two real failures and corrected one of its own:

1. **Purple against slate collapsed to 14.9 under tritanopia.** Secondary
   structure is now blue / orange / light neutral, which separates on lightness
   as well as hue.
2. **A hand-picked chain palette collapsed to 13.6 under deuteranopia.**
   Replaced with **Okabe–Ito**, the established colour-blind-safe qualitative
   set.
3. **The threshold itself was wrong.** Set at 18 on no particular basis, it then
   rejected two Okabe–Ito pairs — and a check that fails the reference palette
   is miscalibrated, not vigilant. Lowered to 15, which is still well above the
   ΔE ≈ 10 at which colours read as clearly different. The two palette changes
   above stand: they measured 13.6 and 14.9, and fail at 15 too.

Chain colours are **ordered** greedily by worst-case separation, because chains
are assigned colours in sequence and what matters is that each prefix is safe.
The first six stay ≥ 23.5 apart under all three deficiencies; at seven it falls
to 10.9, because blue against bluish-green collapses under tritanopia and no
eight-colour set avoids that. Of the v1 library only 2HBS, with eight chains, is
affected, and there the legend carries it.

### Looked at, not just asserted

Property tests can prove a mesh is closed and its normals are unit length. They
cannot say it looks like a protein. `dev/` is a visual harness for exactly that,
and three folds were checked against what they should be:

| Structure | Expected | Rendered |
|---|---|---|
| 1IEP ABL kinase | Bilobal: β-rich N-lobe, α-rich C-lobe | Both lobes clearly separated |
| 2HHB haemoglobin | All-α globin fold, **zero β-sheet** | Entirely helical, no strands |
| 8DZ2 Mpro dimer | Two β-rich protomers | Both, interface visible |

Haemoglobin is the useful one: rendering with no strands at all independently
confirms the pipeline's "81 % helix, 0 % strand".

Two bugs were found only by looking. `WebGLRenderer.setSize(w, h, false)`
sized the drawing buffer but never the CSS size, so on a retina display the
canvas laid out at twice its container and the molecule sat half off-screen.
And rotation was applied on the same group as the centring offset — three.js
applies rotation before position, so the molecule would have swung around a
point outside itself rather than spinning in place.

### Atoms and bonds

Instance transforms are computed as plain matrices and checked by transforming
points through them: a bond's cylinder must land exactly on the two α-carbons it
joins (verified to 4 decimal places over 20 real bonds), its cross-section must
stay circular in every direction, and a bond along the basis-construction's seed
axis — the degenerate case — must still come out finite.

**Chain breaks are not drawn.** A bond longer than 4.5 Å is a gap in the
crystal, not a bond, and drawing a stick across it would assert a connection the
experiment never saw.

### Surface

Two deliberate departures from the usual approach, both to the good:

- **The field is an exact union of spheres, not metaballs.** A sum of Gaussians
  gives a pleasant blob, but pockets fill in and clefts round over — and a
  binding site that does not look like a binding site is worse than useless
  here. The minimum of per-atom signed distances gives the van der Waals
  surface exactly; adding the probe radius gives solvent-accessible exactly.
  Verified: a lone sphere of radius 3 meshes between 2.7 and 3.3 Å, and adding
  a 1.4 Å probe grows it by 1.4 Å.
- **Surface nets, not marching cubes.** Marching cubes needs a 256-case table —
  thousands of literal entries nobody can meaningfully review. Surface nets is a
  fraction of the code and produces a watertight mesh.

**Watertight** is tested, not assumed: zero edges belong to only one triangle.
A real protein does produce ~70 non-manifold edges out of 23,000 (0.3 %), where
two sheets of surface pass through one cell — the known limitation of one vertex
per cell. It is not visible at this scale.

Meshing 306 residues takes **~475 ms**, which is why it is debounced behind an
idle timer rather than rebuilt per frame.

> **Bug found only by looking:** the distance field was seeded with `+Infinity`,
> so any gradient touching an untouched voxel computed `Infinity − finite =
> Infinity` and then `Infinity / Infinity = NaN`. Vertices on the outer lip of a
> protrusion got NaN normals. Seeded with a large *finite* value instead, with a
> regression test that checks a real protein for NaN — the small synthetic cases
> never reached far enough out to hit it.

### Picking

Every α-carbon is projected and the nearest to the pointer wins, with depth
breaking ties so the residue in front is selected rather than one hidden behind
it. Points behind the camera are rejected explicitly: dividing through by a
negative *w* projects them back through the origin, where they reappear
mirrored in front of the viewer and can be picked by mistake.

Verified live on 7VH8 — three pointer positions returned three distinct
residues with the right identity and secondary structure.

### Looked at, again

All four representations were checked in the harness on 7VH8. Two more bugs
surfaced that no unit test would have caught:

1. **The surface rendered see-through.** `transparent: true` on a closed surface
   needs its triangles depth-sorted to composite correctly; without that the far
   wall shows through the near one and the molecule reads as a pile of interior
   fragments. Made opaque.
2. **Sticks and spacefill drew nothing.** Instance matrices start as identity,
   and they were only written on a conformation change — so a structure shown in
   its native state, which never has one, left every atom heaped at the origin.

A useful discriminating check when the surface still looked wrong: colouring it
flat. It resolved into a smooth closed solid, which established the geometry was
right and what looked like windows into the interior was hard-edged per-residue
colour patching plus genuine concavities.

### Not covered by tests

`stage.ts` — the three.js binding — has no unit tests. It is the one file that
needs a graphics context, and it is deliberately thin: every decision it makes
is delegated to a module that *is* tested. It is covered by looking at it, and
that is recorded above rather than glossed over.

---

## 10. Application shell — `apps/web` (Phase 5)

**43 tests** over the pure layer: URL state, chart geometry, and the structure
schema. React components are verified by using them, recorded below.

### Every view is a link

All view state lives in the address bar — structure, timeline position, mode,
representation, colouring, selected residue. Two decisions make the links
durable:

- **The timeline is stored as a fraction, not a frame number.** Frame counts
  depend on chain length and on the engine's settings, so a link pinned to
  "frame 64" would drift the moment either changed.
- **Defaults are omitted.** A link to the default view is the bare URL, not a
  page of parameters that say nothing.

Parsing is defensive: `?t=banana&r=hologram` degrades each bad field to its
default rather than throwing the view away, because URLs arrive truncated by
chat clients and edited by hand.

### End-to-end verification

Loaded haemoglobin and scrubbed the timeline. Every Phase 3 invariant holds in
the running application, computed live from the coordinates on screen:

| At the native state | Value |
|---|---|
| RMSD to the deposited structure | **0.00 Å** |
| Radius of gyration | 14.4 Å |
| Native contacts formed | **100 %** |
| Stage label | "Native state" |

At the unfolded end the same read-outs give RMSD 34.9 Å and Rg 37.3 Å, and the
model renders as four separate sprawling coils — which is what haemoglobin's
four chains should look like denatured.

Deep links restore correctly: `?p=mpro-nirmatrelvir&t=1&m=chemistry` brings back
7VH8, the Chemistry preset and the folded state.

### Three bugs, all found by running it

1. **Worker replies were collected in arrival order, not by chain index.**
   Haemoglobin's chains are 141, 146, 141 and 146 residues, so a 146-residue
   trajectory could be handed to a 141-residue chain — reading off the end of
   the array and filling the geometry with `NaN`. The camera then fitted to a
   `NaN` bounding sphere, collapsed to zero distance, and the molecule vanished
   entirely. Now slotted by index.
2. **The camera framed once, at load, on the *native* structure.** An unfolded
   coil is around three times the size, so most of the chain sat outside the
   view for the first half of the animation. Re-fitting on every conformation
   change reads as a slow zoom in as the protein collapses, because the
   camera's distance is damped.
3. **`background: "transparent"` is not a colour three.js can parse.** It
   warned and left the scene opaque white. Replaced with the panel's own
   colour, read from the CSS custom property so the canvas and its container
   agree in either theme.

A fourth was found by the tests rather than by looking: a link naming a mode but
not spelling out its colouring — which is exactly what `encodeView` produces,
since presets supply those fields — restored the Chemistry tab as selected while
showing the Fold tab's colouring. `decodeView` now applies the preset first and
lets explicit parameters override it.

> **On how this was verified:** the preview pane does not run
> `requestAnimationFrame`, so the render loop had to be driven manually to
> capture screenshots. The scene, camera and triangle counts were read directly
> out of the renderer to confirm what was on screen. Frame-rate under sustained
> animation is still unmeasured — see below.

### Production build

1.5 MB total, with each structure code-split into its own chunk so only the one
being viewed is fetched.

---

## 11. Editorial content — `packages/content` (Phase 6)

**44 tests.** Prose is the part of this project most likely to be quietly
wrong: nothing crashes when a residue number is off by one or a mechanism is
misremembered. So the content is written to be *checkable*.

### Residue claims are verified against the structures

Every residue an annotation names carries the amino acid it is claimed to be,
and the test looks it up in the emitted structure file:

```ts
{ label: "Thr315 — the gatekeeper",
  residues: [{ chain: "A", resNum: 315, code: "T" }] }
```

Writing "Thr315" and being wrong is a test failure, not a plausible sentence
nobody catches. **It caught one on the first run:** an annotation claimed
Gly464 as part of CFTR's Walker A motif. The structure says residue 464 is
**lysine** — and checking the sequence shows the motif is G458-S459-T460-G461-
A462-G463-**K464**-T465, where Lys464 is the catalytic lysine that contacts the
nucleotide phosphates. The corrected annotation is both accurate and a better
teaching point than the one I wrote.

Currently 16 residue claims across 9 structures, all verified.

### Other content gates

- Every structure in the library has editorial content, and every entry belongs
  to a story that lists it
- Every citation reference resolves, and every citation defined is actually
  cited — an orphaned source usually means a claim was edited away and its
  replacement left unsourced
- All three reading levels are written for every story and structure, and the
  lay text must differ from the researcher text (which catches the common
  failure of writing one register and pasting it into all three)
- Every structure that cannot be animated carries a caveat explaining why — a
  reader is owed an explanation for a dead timeline
- The ΔF508 construct must disclose its solubilising mutations
- The honesty panel must state that the folding path has never been observed,
  that this is not a medical device, and the ACMG limit on structural evidence

### The honesty panel

Written before the features it describes. Five things declared real, four
declared illustration, five limits — deliberately balanced, because a long list
of guarantees beside a one-line disclaimer is a way of not saying something.
A test enforces that balance.

Every estimate in the interface is traceable to a line in it.

---

## 12. Not yet validated

Named here so nothing is quietly assumed:

- [ ] Contact order at more than one calibration point — currently ubiquitin only
- [ ] Salt-bridge cutoff on more than two structures — 12 bridges is a thin basis
- [ ] Trajectory invariants on multi-chain structures — 1UBI and 7VH8 are single chains
- [ ] Sustained frame rate under animation — mesh rebuild is measured, the full loop is not
- [ ] React components — only the pure layer beneath them has tests; no E2E yet
- [ ] Accessibility — keyboard transport works, but nothing has been run through axe
- [ ] The ΔF508 / T315I variant deltas — nothing computed yet
