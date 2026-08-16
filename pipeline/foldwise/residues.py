"""Residue-level facts: one-letter codes, virtual Cb, and what counts as a ligand."""

from __future__ import annotations

import gemmi
import numpy as np

BACKBONE = ("N", "CA", "C", "O")

#: Components that are crystallisation furniture, not biology. Excluded from
#: the ligand list so the viewer does not present a cryoprotectant as a drug.
CRYSTALLISATION_JUNK = frozenset(
    {
        "HOH", "DOD", "WAT",                                    # water
        "GOL", "EDO", "PEG", "PG4", "PGE", "1PE", "P6G", "MPD", # cryo / precipitants
        "DMS", "TRS", "EPE", "MES", "BME", "IMD", "FMT", "ACT", # buffers
        "ACY", "CIT", "TLA", "SO4", "PO4", "NO3", "IOD", "AZI",
        "NA", "K", "CL", "BR", "CS", "RB", "LI",                # bulk ions
    }
)

#: Ions and cofactors that ARE biology when bound to these targets. Kept even
#: though they look like junk -- haem carries the oxygen, Mg gates the ATPase.
ALWAYS_KEEP = frozenset({"HEM", "HEC", "ATP", "ADP", "MG", "ZN", "FE", "CA", "MN", "NAD", "FAD"})


def one_letter(residue_name: str) -> str | None:
    """Standard one-letter code, resolving modified residues to their parent.

    MSE (selenomethionine) is used routinely for phasing and is chemically
    methionine as far as the fold is concerned -- it must not be dropped.
    """
    info = gemmi.find_tabulated_residue(residue_name)
    if info is None or not info.is_amino_acid():
        return None
    code = info.one_letter_code
    if not code or code == " ":
        return None
    return code.upper()


def is_ligand(residue_name: str) -> bool:
    if residue_name in ALWAYS_KEEP:
        return True
    return residue_name not in CRYSTALLISATION_JUNK


def virtual_cb(n: np.ndarray, ca: np.ndarray, c: np.ndarray) -> np.ndarray:
    """Ideal Cb position from the backbone.

    Glycine has no Cb, but the burial and hydropathy models need a side-chain
    direction for every residue, so we place the one glycine would have.
    Coefficients are the standard tetrahedral construction.
    """
    b = ca - n
    d = c - ca
    a = np.cross(b, d)
    return -0.58273431 * a + 0.56802827 * b - 0.54067466 * d + ca
