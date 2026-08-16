"""The v1 structure manifest.

Four clinical stories, nine structures. Every PDB ID here was verified against
the RCSB API on 2026-08-16 -- residue counts and resolutions are real, not
remembered.

`foldability` is a hard performance call, not a scientific one: structures above
roughly 700 residues are shown in their native state only, because generating a
96-frame constrained morph for them does not fit the frame budget.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

Story = Literal["sickle-cell", "cystic-fibrosis", "imatinib", "nirmatrelvir"]


@dataclass(frozen=True)
class Entry:
    """One PDB entry, plus why it is in the library."""

    id: str
    pdb_id: str
    story: Story
    role: str
    """Its job inside the story: 'wild-type', 'variant', 'context', 'resistance'."""

    foldability: Literal["fold", "static"]
    deposited_residues: int
    """Residue count RCSB reports, verified against its API on 2026-08-16.
    Includes residues that were never resolved; the pipeline reports coverage
    against this rather than expecting to match it."""

    expect_chains: int
    note: str = ""
    caveats: tuple[str, ...] = field(default_factory=tuple)
    """Disclosures that MUST reach the honesty panel."""


V1_ENTRIES: tuple[Entry, ...] = (
    # ── Sickle cell ────────────────────────────────────────────────────────
    Entry(
        id="hba-deoxy", pdb_id="2HHB", story="sickle-cell", role="wild-type",
        foldability="fold", deposited_residues=574, expect_chains=4,
        note="Deoxyhaemoglobin A at 1.74 A. The reference tetramer: two alpha, two beta, four haems.",
    ),
    Entry(
        id="hbs-deoxy", pdb_id="2HBS", story="sickle-cell", role="variant",
        foldability="static", deposited_residues=1148, expect_chains=8,
        note=(
            "Deoxyhaemoglobin S. Two tetramers in the asymmetric unit, which is the point: "
            "the lateral contact between them is where beta-Val6 docks into the acceptor "
            "pocket on a neighbouring molecule. The mutation and its consequence in one file."
        ),
        caveats=(
            "Shown in its native state only. At 1148 residues a folding trajectory does not "
            "fit the frame budget, and the fibre contact -- not the folding -- is the lesson.",
        ),
    ),
    # ── Cystic fibrosis ────────────────────────────────────────────────────
    Entry(
        id="nbd1-wt", pdb_id="2BBO", story="cystic-fibrosis", role="wild-type",
        foldability="fold", deposited_residues=291, expect_chains=1,
        note=(
            "Human CFTR nucleotide-binding domain 1 with Phe508 present. NBD1 is the domain "
            "that fails to fold in the commonest CF genotype, so it is the right unit of study."
        ),
    ),
    Entry(
        id="nbd1-df508", pdb_id="2BBS", story="cystic-fibrosis", role="variant",
        foldability="fold", deposited_residues=580, expect_chains=2,
        note="Human NBD1 with Phe508 deleted -- the same domain, one residue short.",
        caveats=(
            "This construct carries three solubilising mutations introduced to make deltaF508 "
            "NBD1 crystallisable at all. Differences from 2BBO are therefore not attributable "
            "to the deletion alone.",
        ),
    ),
    Entry(
        id="cftr-full", pdb_id="6MSM", story="cystic-fibrosis", role="context",
        foldability="static", deposited_residues=1506, expect_chains=1,
        note=(
            "Phosphorylated, ATP-bound full-length human CFTR by cryo-EM. Here only to show "
            "where NBD1 sits inside the whole channel."
        ),
        caveats=(
            "3.2 A cryo-EM. Side-chain positions are far less certain than in the crystal "
            "structures alongside it.",
            "RCSB counts two polymer instances; the second is a 17-residue peptide that falls "
            "below our 20-residue floor and is not rendered.",
        ),
    ),
    # ── Imatinib ───────────────────────────────────────────────────────────
    Entry(
        id="abl-imatinib", pdb_id="1IEP", story="imatinib", role="wild-type",
        foldability="fold", deposited_residues=586, expect_chains=2,
        note=(
            "ABL kinase domain with imatinib bound in the inactive DFG-out conformation. "
            "Thr315 is the gatekeeper: it hydrogen-bonds to the drug and its side chain sets "
            "the size of the pocket entrance."
        ),
    ),
    Entry(
        id="abl-t315i-ponatinib", pdb_id="3IK3", story="imatinib", role="resistance",
        foldability="fold", deposited_residues=576, expect_chains=2,
        note=(
            "T315I ABL with ponatinib. There is no structure of imatinib bound to T315I -- "
            "because it does not bind. Isoleucine loses the hydroxyl that donated the hydrogen "
            "bond and adds bulk at the gate. Ponatinib's alkyne linker was designed to pass it."
        ),
    ),
    # ── Nirmatrelvir ───────────────────────────────────────────────────────
    Entry(
        id="mpro-nirmatrelvir", pdb_id="7VH8", story="nirmatrelvir", role="wild-type",
        foldability="fold", deposited_residues=306, expect_chains=1,
        note=(
            "SARS-CoV-2 main protease with nirmatrelvir (ligand 4WI) at 1.59 A -- the sharpest "
            "view of this complex. The nitrile warhead forms a reversible covalent bond to Cys145."
        ),
        caveats=(
            "One protomer in the asymmetric unit. Mpro is an obligate homodimer and the active "
            "site is only complete when the partner's N-terminal finger is in place; see 8DZ2.",
        ),
    ),
    Entry(
        id="mpro-dimer", pdb_id="8DZ2", story="nirmatrelvir", role="context",
        foldability="static", deposited_residues=612, expect_chains=2,
        note=(
            "The biological dimer with nirmatrelvir in both sites. Shown so the N-finger "
            "contribution to the partner's active site is visible rather than asserted."
        ),
    ),
)

BY_ID = {entry.id: entry for entry in V1_ENTRIES}
BY_PDB = {entry.pdb_id: entry for entry in V1_ENTRIES}


def for_story(story: Story) -> tuple[Entry, ...]:
    return tuple(e for e in V1_ENTRIES if e.story == story)
