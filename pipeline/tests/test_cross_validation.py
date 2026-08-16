"""Agreement between our DSSP and PDBe's independent assignment.

This is the test that earns the right to display a secondary-structure ribbon
and call it real. It needs the structure cache; run `python -m foldwise.cli
build` first, or the tests skip rather than fail.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from foldwise import parse
from foldwise.catalog import V1_ENTRIES
from foldwise.validate_ss import compare

CACHE = Path(__file__).resolve().parents[2] / "data" / "cache"

#: Every individual chain must clear this against PDBe.
MIN_CHAIN_AGREEMENT = 0.90

#: And the whole catalog, weighted by residue count, must clear this.
MIN_OVERALL_AGREEMENT = 0.94

pytestmark = pytest.mark.network


def _cached(pdb_id: str) -> Path | None:
    path = CACHE / f"{pdb_id.lower()}.cif"
    return path if path.exists() else None


@pytest.mark.parametrize("entry", V1_ENTRIES, ids=lambda e: e.pdb_id)
def test_chain_agrees_with_pdbe(entry) -> None:
    path = _cached(entry.pdb_id)
    if path is None:
        pytest.skip(f"{entry.pdb_id} not cached; run the build first")

    st = parse.load(str(path))
    checked = 0
    for gemmi_chain in st[0]:
        chain = parse.build_chain(gemmi_chain)
        if chain is None:
            continue
        agreement = compare(entry.pdb_id, chain.id, chain.ss, chain.res_nums)
        if agreement is None:
            pytest.skip("PDBe unreachable")
        checked += 1
        assert agreement.fraction >= MIN_CHAIN_AGREEMENT, (
            f"{entry.pdb_id} chain {chain.id}: {agreement.fraction:.1%} agreement "
            f"({agreement.matches}/{agreement.length})"
        )
    assert checked > 0, f"{entry.pdb_id}: no chains survived parsing"


def test_virtual_cb_matches_observed_positions() -> None:
    """The Cb we construct for glycine must be the one a real residue has.

    Checked against every non-glycine residue with an observed Cb: if the
    construction were mirrored, the deviation would be a couple of angstroms
    rather than a tenth of one.
    """
    import numpy as np

    from foldwise.residues import one_letter, virtual_cb

    path = _cached("1UBI")
    if path is None:
        pytest.skip("1UBI not cached; run the build first")

    deviations = []
    for residue in parse.load(str(path))[0][0]:
        if one_letter(residue.name) is None or residue.name == "GLY":
            continue
        atoms = {a.name: np.array([a.pos.x, a.pos.y, a.pos.z]) for a in residue}
        if not {"N", "CA", "C", "CB"} <= atoms.keys():
            continue
        predicted = virtual_cb(atoms["N"], atoms["CA"], atoms["C"])
        deviations.append(float(np.linalg.norm(predicted - atoms["CB"])))

    assert len(deviations) > 50, "not enough residues to be meaningful"
    assert np.mean(deviations) < 0.15, f"mean deviation {np.mean(deviations):.3f} A"
    assert max(deviations) < 0.60, f"worst deviation {max(deviations):.3f} A"


def test_catalog_agreement_overall() -> None:
    matches = total = 0
    for entry in V1_ENTRIES:
        path = _cached(entry.pdb_id)
        if path is None:
            continue
        st = parse.load(str(path))
        for gemmi_chain in st[0]:
            chain = parse.build_chain(gemmi_chain)
            if chain is None:
                continue
            agreement = compare(entry.pdb_id, chain.id, chain.ss, chain.res_nums)
            if agreement is None:
                pytest.skip("PDBe unreachable")
            matches += agreement.matches
            total += agreement.length

    if total == 0:
        pytest.skip("no cached structures; run the build first")
    fraction = matches / total
    assert fraction >= MIN_OVERALL_AGREEMENT, (
        f"catalog-wide agreement {fraction:.1%} over {total} residues"
    )
