"""Salt bridges by the all-atom criterion, for validating the browser's version.

Barlow & Thornton (1983) J Mol Biol 168:867 define a salt bridge as any
charged-group nitrogen of Arg/Lys/His within 4 A of a carboxylate oxygen of
Asp/Glu.

The browser only carries one point per side chain, so it cannot apply that test
directly -- it works on charged-group centroids instead. This module computes
the real answer from the full mmCIF so the approximation can be measured rather
than assumed.
"""

from __future__ import annotations

from dataclasses import dataclass

import gemmi
import numpy as np

from .residues import (
    NEGATIVE_RESIDUES,
    POSITIVE_RESIDUES,
    SALT_BRIDGE_ATOMS,
    SALT_BRIDGE_CUTOFF,
)


@dataclass(frozen=True)
class ChargedGroup:
    chain: str
    res_num: int
    res_name: str
    positive: bool
    atoms: tuple[np.ndarray, ...]


def charged_groups(st: gemmi.Structure) -> list[ChargedGroup]:
    groups: list[ChargedGroup] = []
    for chain in st[0]:
        for residue in chain:
            wanted = SALT_BRIDGE_ATOMS.get(residue.name)
            if wanted is None:
                continue
            positions = tuple(
                np.array([a.pos.x, a.pos.y, a.pos.z]) for a in residue if a.name in wanted
            )
            if not positions:
                continue
            groups.append(
                ChargedGroup(
                    chain=chain.name,
                    res_num=residue.seqid.num,
                    res_name=residue.name,
                    positive=residue.name in POSITIVE_RESIDUES,
                    atoms=positions,
                )
            )
    return groups


def find(st: gemmi.Structure, cutoff: float = SALT_BRIDGE_CUTOFF) -> list[tuple[str, str]]:
    """Every salt-bridged residue pair, as sorted ``(chain:resnum, ...)`` labels."""
    groups = charged_groups(st)
    pairs: set[tuple[str, str]] = set()

    for i, a in enumerate(groups):
        for b in groups[i + 1 :]:
            if a.positive == b.positive:
                continue
            if _closest_approach(a, b) > cutoff:
                continue
            labels = (f"{a.chain}:{a.res_num}", f"{b.chain}:{b.res_num}")
            pairs.add(tuple(sorted(labels)))  # type: ignore[arg-type]
    return sorted(pairs)


def _closest_approach(a: ChargedGroup, b: ChargedGroup) -> float:
    return min(
        float(np.linalg.norm(atom_a - atom_b)) for atom_a in a.atoms for atom_b in b.atoms
    )


def negative_set() -> frozenset[str]:
    return NEGATIVE_RESIDUES
