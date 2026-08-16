"""Kabsch-Sander backbone hydrogen bonds.

The electrostatic H-bond energy from Kabsch & Sander (1983), Biopolymers 22:2577.
`mkdssp` is not installed on most machines and is an awkward build dependency, so
we compute this ourselves. It is ~60 lines, exact, and testable -- which is better
than a shell-out we cannot verify.
"""

from __future__ import annotations

import numpy as np

# q1 * q2 * f, with q1 = 0.42e, q2 = 0.20e and f = 332 kcal/mol per e^2/A.
COUPLING = 0.42 * 0.20 * 332.0

#: An H-bond exists below this energy, in kcal/mol.
ENERGY_CUTOFF = -0.5

#: Pairs further apart than this (Ca-Ca) cannot hydrogen-bond; used to prune.
MAX_CA_DISTANCE = 9.0

#: N-H bond length, A.
NH_LENGTH = 1.0


def amide_hydrogens(
    n: np.ndarray, c: np.ndarray, o: np.ndarray, is_proline: np.ndarray, chain_start: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """Place the amide H on each backbone N.

    DSSP puts H one angstrom from N, along the direction of the preceding
    residue's C->O bond. Proline has no amide H, and neither does the first
    residue of a chain (there is no preceding carbonyl to orient it).

    Returns (positions, is_donor).
    """
    n_res = len(n)
    h = np.zeros_like(n)
    is_donor = np.ones(n_res, dtype=bool)

    is_donor &= ~is_proline
    is_donor &= ~chain_start

    prev_co = c[:-1] - o[:-1]
    norms = np.linalg.norm(prev_co, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    h[1:] = n[1:] + NH_LENGTH * (prev_co / norms)

    # A residue whose predecessor is in another chain has a meaningless H.
    is_donor[0] = False
    return h, is_donor


def _inv_distance(a: np.ndarray, b: np.ndarray) -> float:
    d = float(np.linalg.norm(a - b))
    return 1.0 / d if d > 1e-6 else 1e6


def bond_energy(
    n_d: np.ndarray, h_d: np.ndarray, c_a: np.ndarray, o_a: np.ndarray
) -> float:
    """Energy of the bond donating from residue D's N-H to residue A's C=O."""
    return COUPLING * (
        _inv_distance(o_a, n_d)
        + _inv_distance(c_a, h_d)
        - _inv_distance(o_a, h_d)
        - _inv_distance(c_a, n_d)
    )


def hbond_map(
    ca: np.ndarray,
    n: np.ndarray,
    c: np.ndarray,
    o: np.ndarray,
    h: np.ndarray,
    is_donor: np.ndarray,
) -> np.ndarray:
    """Boolean matrix `hb` where ``hb[i, j]`` means the C=O of residue *i*
    hydrogen-bonds to the N-H of residue *j*.

    This is DSSP's ``Hbond(i, j)`` orientation: acceptor first, donor second.
    """
    n_res = len(ca)
    hb = np.zeros((n_res, n_res), dtype=bool)

    # Prune on Ca-Ca separation before doing any of the four distance terms.
    deltas = ca[:, None, :] - ca[None, :, :]
    near = (deltas**2).sum(-1) < MAX_CA_DISTANCE**2

    for acceptor in range(n_res):
        for donor in range(n_res):
            if acceptor == donor or not is_donor[donor]:
                continue
            if abs(acceptor - donor) < 2:
                continue
            if not near[acceptor, donor]:
                continue
            e = bond_energy(n[donor], h[donor], c[acceptor], o[acceptor])
            if e < ENERGY_CUTOFF:
                hb[acceptor, donor] = True
    return hb
