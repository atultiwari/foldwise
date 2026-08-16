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

## 7. Not yet validated

Named here so nothing is quietly assumed:

- [ ] SASA (Shrake–Rupley) — needs a FreeSASA comparison
- [ ] Contact order — needs published RCO values
- [ ] Kabsch superposition, Rg, RMSD — `packages/core`, not yet written
- [ ] Folding trajectory invariants — engine not yet written
- [ ] The ΔF508 / T315I variant deltas — nothing computed yet
