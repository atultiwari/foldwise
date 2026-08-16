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


#: The chemically meaningful end of each charged side chain. A salt bridge is
#: between these groups, not between Cb atoms, so the viewer needs their
#: positions if it is to draw real ionic interactions rather than guesses.
CHARGED_GROUP_ATOMS: dict[str, tuple[str, ...]] = {
    "ARG": ("NE", "CZ", "NH1", "NH2"),      # guanidinium
    "LYS": ("NZ",),                          # ammonium
    "HIS": ("CG", "ND1", "CD2", "CE1", "NE2"),  # imidazole
    "ASP": ("CG", "OD1", "OD2"),             # carboxylate
    "GLU": ("CD", "OE1", "OE2"),             # carboxylate
}

#: Atoms that actually carry the charge, used for the all-atom salt-bridge
#: criterion of Barlow & Thornton (1983): any of these within 4 A of an
#: oppositely charged one.
SALT_BRIDGE_ATOMS: dict[str, tuple[str, ...]] = {
    "ARG": ("NE", "NH1", "NH2"),
    "LYS": ("NZ",),
    "HIS": ("ND1", "NE2"),
    "ASP": ("OD1", "OD2"),
    "GLU": ("OE1", "OE2"),
}

POSITIVE_RESIDUES = frozenset({"ARG", "LYS", "HIS"})
NEGATIVE_RESIDUES = frozenset({"ASP", "GLU"})

#: Barlow & Thornton (1983) J Mol Biol 168:867.
SALT_BRIDGE_CUTOFF = 4.0


def side_chain_centre(residue, ca: np.ndarray) -> np.ndarray:
    """Where the side chain's business end sits.

    For a charged residue this is the centroid of its charged group; for
    anything else it is the centroid of the side-chain heavy atoms. Glycine has
    no side chain, so it falls back to its own Ca.
    """
    wanted = CHARGED_GROUP_ATOMS.get(residue.name)
    if wanted is not None:
        positions = [
            np.array([a.pos.x, a.pos.y, a.pos.z]) for a in residue if a.name in wanted
        ]
        if positions:
            return np.mean(positions, axis=0)

    positions = [
        np.array([a.pos.x, a.pos.y, a.pos.z])
        for a in residue
        if a.name not in BACKBONE and a.element.name != "H"
    ]
    return np.mean(positions, axis=0) if positions else ca


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
