"""Dependency-free DSSP. See `hbond` for the energy model, `assign` for the states."""

from __future__ import annotations

import numpy as np

from .assign import assign
from .hbond import amide_hydrogens, hbond_map

__all__ = ["assign", "amide_hydrogens", "hbond_map", "secondary_structure"]


def secondary_structure(
    ca: np.ndarray,
    n: np.ndarray,
    c: np.ndarray,
    o: np.ndarray,
    is_proline: np.ndarray,
    chain_start: np.ndarray,
) -> str:
    """Convenience wrapper: backbone coordinates in, 8-state string out.

    `chain_start[i]` marks residues with no bonded predecessor -- the first
    residue of a chain, and the residue after every chain break.
    """
    h, is_donor = amide_hydrogens(n, c, o, is_proline, chain_start)
    hb = hbond_map(ca, n, c, o, h, is_donor)
    return assign(hb, ca)
