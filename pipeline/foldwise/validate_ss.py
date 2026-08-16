"""Cross-validate our DSSP against PDBe's independent assignment.

PDBe runs its own secondary-structure assignment over every entry and serves the
result through a public API. Comparing against it is the only honest way to
claim our own implementation is correct.

Note that the *depositor's* HELIX/SHEET records in the mmCIF are a different
thing again -- author-assigned, systematically more generous at strand ends.
They are not a DSSP reference and must not be used as one.
"""

from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass

PDBE_SS = "https://www.ebi.ac.uk/pdbe/api/pdb/entry/secondary_structure/{pdb_id}"
TIMEOUT = 30

#: Collapse to helix / strand / other. Comparing 8 states across two different
#: implementations mostly measures tie-breaking convention, not correctness.
THREE_STATE = {"H": "H", "G": "H", "I": "H", "E": "E", "B": "E", "T": "-", "S": "-", "C": "-"}


@dataclass(frozen=True)
class Agreement:
    pdb_id: str
    chain: str
    length: int
    matches: int

    @property
    def fraction(self) -> float:
        return self.matches / max(self.length, 1)


def pdbe_reference(pdb_id: str, chain_id: str, res_nums: tuple[int, ...]) -> str | None:
    """Build a 3-state string aligned to `res_nums`, or None if PDBe has no data."""
    url = PDBE_SS.format(pdb_id=pdb_id.lower())
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT) as response:  # noqa: S310
            payload = json.load(response)
    except Exception:  # noqa: BLE001 -- offline is not a test failure
        return None

    entry = payload.get(pdb_id.lower())
    if not entry:
        return None

    ranges: dict[int, str] = {}
    for molecule in entry.get("molecules", []):
        for chain in molecule.get("chains", []):
            if chain.get("chain_id") != chain_id:
                continue
            ss = chain.get("secondary_structure", {})
            for key, code in (("helices", "H"), ("strands", "E")):
                for element in ss.get(key, []):
                    # `residue_number` is entity-sequential and starts at 1;
                    # our res_nums are author numbering, which for a domain
                    # construct like the ABL kinase starts in the hundreds.
                    start = element["start"]["author_residue_number"]
                    end = element["end"]["author_residue_number"]
                    for num in range(start, end + 1):
                        ranges[num] = code
    if not ranges:
        return None
    return "".join(ranges.get(num, "-") for num in res_nums)


def compare(pdb_id: str, chain_id: str, ss: str, res_nums: tuple[int, ...]) -> Agreement | None:
    reference = pdbe_reference(pdb_id, chain_id, res_nums)
    if reference is None:
        return None
    ours = "".join(THREE_STATE[c] for c in ss)
    matches = sum(a == b for a, b in zip(ours, reference))
    return Agreement(pdb_id=pdb_id, chain=chain_id, length=len(reference), matches=matches)
