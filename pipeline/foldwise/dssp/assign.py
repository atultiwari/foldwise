"""Turn the hydrogen-bond map into an 8-state secondary-structure string.

States, in DSSP's own precedence order:

    H  alpha helix          G  3-10 helix       I  pi helix
    E  extended strand      B  isolated bridge
    T  hydrogen-bonded turn S  bend             C  coil (DSSP writes ' ')
"""

from __future__ import annotations

import numpy as np

#: DSSP resolves overlaps in this order; earlier wins.
PRECEDENCE = "HBEGITS"

#: Ca(i-2)->Ca(i)->Ca(i+2) sharper than this is a bend, in degrees.
BEND_ANGLE = 70.0


def n_turns(hb: np.ndarray, n: int) -> np.ndarray:
    """``turn[i]`` is True when the C=O of *i* bonds to the N-H of *i+n*."""
    size = len(hb)
    turn = np.zeros(size, dtype=bool)
    for i in range(size - n):
        turn[i] = hb[i, i + n]
    return turn


def helices_from_turns(turn: np.ndarray, n: int) -> np.ndarray:
    """A helix of type *n* is two consecutive n-turns.

    When turns start at both *i* and *i+1*, residues *i+1* through *i+n* are
    inside the helix.
    """
    size = len(turn)
    mask = np.zeros(size, dtype=bool)
    for i in range(size - 1):
        if turn[i] and turn[i + 1]:
            mask[i + 1 : min(size, i + n + 1)] = True
    return mask


def _bonded(hb: np.ndarray, acceptor: int, donor: int) -> bool:
    """`hb` lookup that treats out-of-range indices as 'no bond'.

    Bridge tests reach one residue either side of the pair, so the first and
    last residue of a chain would otherwise be excluded from every ladder --
    which shortens every terminal strand by a residue.
    """
    size = len(hb)
    if not (0 <= acceptor < size and 0 <= donor < size):
        return False
    return bool(hb[acceptor, donor])


def _parallel_bridge(hb: np.ndarray, i: int, j: int) -> bool:
    return (_bonded(hb, i - 1, j) and _bonded(hb, j, i + 1)) or (
        _bonded(hb, j - 1, i) and _bonded(hb, i, j + 1)
    )


def _antiparallel_bridge(hb: np.ndarray, i: int, j: int) -> bool:
    return (_bonded(hb, i, j) and _bonded(hb, j, i)) or (
        _bonded(hb, i - 1, j + 1) and _bonded(hb, j - 1, i + 1)
    )


def bridges(hb: np.ndarray) -> list[tuple[int, int, str]]:
    """Every bridge partner pair, tagged 'P' (parallel) or 'A' (antiparallel).

    Partners must be at least three apart in sequence; closer than that and the
    geometry is a turn, not a sheet.
    """
    size = len(hb)
    found: list[tuple[int, int, str]] = []
    for i in range(size):
        for j in range(i + 3, size):
            if _antiparallel_bridge(hb, i, j):
                found.append((i, j, "A"))
            elif _parallel_bridge(hb, i, j):
                found.append((i, j, "P"))
    return found


def strands_from_bridges(
    bridge_list: list[tuple[int, int, str]], size: int
) -> tuple[np.ndarray, np.ndarray]:
    """Split bridges into ladders. Two or more consecutive bridges make a
    strand (E); a lone bridge stays an isolated bridge (B).
    """
    in_ladder = np.zeros(size, dtype=bool)
    isolated = np.zeros(size, dtype=bool)
    partners = {(i, j): kind for i, j, kind in bridge_list}

    for (i, j), kind in partners.items():
        step = 1 if kind == "P" else -1
        extends = (i + 1, j + step) in partners or (i - 1, j - step) in partners
        target = in_ladder if extends else isolated
        target[i] = True
        target[j] = True

    isolated &= ~in_ladder
    return in_ladder, isolated


def bends(ca: np.ndarray) -> np.ndarray:
    """Residues where the chain turns a sharp corner."""
    size = len(ca)
    mask = np.zeros(size, dtype=bool)
    for i in range(2, size - 2):
        u = ca[i] - ca[i - 2]
        v = ca[i + 2] - ca[i]
        nu, nv = np.linalg.norm(u), np.linalg.norm(v)
        if nu < 1e-6 or nv < 1e-6:
            continue
        cos = float(np.clip(np.dot(u, v) / (nu * nv), -1.0, 1.0))
        if np.degrees(np.arccos(cos)) > BEND_ANGLE:
            mask[i] = True
    return mask


def assign(hb: np.ndarray, ca: np.ndarray) -> str:
    """Full 8-state assignment for one chain."""
    size = len(ca)
    if size == 0:
        return ""

    turn3, turn4, turn5 = (n_turns(hb, n) for n in (3, 4, 5))
    states: dict[str, np.ndarray] = {
        "G": helices_from_turns(turn3, 3),
        "H": helices_from_turns(turn4, 4),
        "I": helices_from_turns(turn5, 5),
    }

    ladder, isolated = strands_from_bridges(bridges(hb), size)
    states["E"] = ladder
    states["B"] = isolated

    # Any residue spanned by an n-turn but not already helical is a turn.
    turn_mask = np.zeros(size, dtype=bool)
    for turn, n in ((turn3, 3), (turn4, 4), (turn5, 5)):
        for i in np.flatnonzero(turn):
            turn_mask[i + 1 : min(size, i + n)] = True
    states["T"] = turn_mask
    states["S"] = bends(ca)

    out = []
    for i in range(size):
        code = "C"
        for candidate in PRECEDENCE:
            if states[candidate][i]:
                code = candidate
                break
        out.append(code)
    return "".join(out)
