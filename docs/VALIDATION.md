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

## 9. Not yet validated

Named here so nothing is quietly assumed:

- [ ] Contact order at more than one calibration point — currently ubiquitin only
- [ ] Salt-bridge cutoff on more than two structures — 12 bridges is a thin basis
- [ ] Trajectory invariants on multi-chain structures — 1UBI and 7VH8 are single chains
- [ ] The ΔF508 / T315I variant deltas — nothing computed yet
