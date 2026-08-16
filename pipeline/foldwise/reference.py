"""Generate reference values for the TypeScript core's tests.

`packages/core` implements the same biophysics the pipeline does, but in the
browser's language. Rather than trust two independent implementations to agree,
we pin the TypeScript side against **FreeSASA**, an established C library, and
commit the expected numbers as a fixture.

The fixture is self-contained: it carries the coordinates as well as the
expected values, so the TypeScript tests need no Python and no network.

Run with `python -m foldwise.cli reference`.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import freesasa
import numpy as np

from . import fetch, parse, saltbridges
from .dssp.hbond import amide_hydrogens, hbond_map

#: Van der Waals radii, A. Bondi (1964), as used by essentially every SASA tool.
VDW_RADII = {"N": 1.55, "C": 1.70, "O": 1.52, "S": 1.80}

#: Water probe.
PROBE_RADIUS = 1.4

#: Sphere sampling for the reference. Far higher than the viewer will use --
#: the point is to pin down the true value, not to be fast.
REFERENCE_POINTS = 5000

#: The atoms our model actually carries. FreeSASA must see exactly these and no
#: others, or we would be comparing an all-atom surface against a backbone one.
MODEL_ATOMS = ("n", "ca", "c", "o", "cb")

#: Emitted alongside, but excluded from the SASA model -- one centroid per side
#: chain is not a surface.
EXTRA_ARRAYS = ("sc",)

#: Element of each, in the same order.
MODEL_ELEMENTS = ("N", "C", "C", "O", "C")

#: Structures used only for validation. They need not be in the app catalog --
#: ubiquitin is here because its contact order is a published number.
CASES: tuple[tuple[str, str, str], ...] = (
    (
        "1ubi",
        "1UBI",
        "Ubiquitin. Small, well studied, and its relative contact order is a "
        "published value (~15%), which makes it a real external check.",
    ),
    (
        "7vh8",
        "7VH8",
        "SARS-CoV-2 main protease with nirmatrelvir. Four times larger, to catch "
        "anything that only breaks at scale.",
    ),
)


def _model_atoms(chain) -> tuple[list[float], list[float]]:
    """Flatten one chain into FreeSASA's coordinate and radius lists."""
    n_res = len(chain.seq)
    coords: list[float] = []
    radii: list[float] = []
    arrays = {name: getattr(chain, name) for name in MODEL_ATOMS}
    for i in range(n_res):
        for name, element in zip(MODEL_ATOMS, MODEL_ELEMENTS):
            values = arrays[name]
            coords.extend(values[i * 3 : i * 3 + 3])
            radii.append(VDW_RADII[element])
    return coords, radii


def _freesasa_parameters() -> freesasa.Parameters:
    return freesasa.Parameters(
        {
            "algorithm": freesasa.ShrakeRupley,
            "probe-radius": PROBE_RADIUS,
            "n-points": REFERENCE_POINTS,
        }
    )


def _case(case_id: str, pdb_id: str, description: str, cache: Path) -> dict:
    st = parse.load(str(fetch.coordinates(pdb_id, cache)))
    chain = next(c for c in (parse.build_chain(ch) for ch in st[0]) if c is not None)

    coords, radii = _model_atoms(chain)
    result = freesasa.calcCoord(coords, radii, _freesasa_parameters())

    per_atom = [result.atomArea(i) for i in range(len(radii))]
    stride = len(MODEL_ATOMS)
    per_residue = [
        round(sum(per_atom[i * stride : (i + 1) * stride]), 3) for i in range(len(chain.seq))
    ]

    backbone = {
        name: np.asarray(getattr(chain, name), dtype=float).reshape(-1, 3)
        for name in ("n", "ca", "c", "o")
    }
    starts = np.zeros(len(chain.seq), dtype=bool)
    starts[0] = True
    for gap in chain.gaps:
        starts[gap.after_index + 1] = True
    hydrogens, is_donor = amide_hydrogens(
        backbone["n"], backbone["c"], backbone["o"],
        np.array([c == "P" for c in chain.seq]), starts,
    )
    hb = hbond_map(
        backbone["ca"], backbone["n"], backbone["c"], backbone["o"], hydrogens, is_donor
    )
    bonds = [[int(a), int(d)] for a, d in zip(*np.nonzero(hb))]

    ca = np.asarray(chain.ca, dtype=float).reshape(-1, 3)
    centroid = ca.mean(axis=0)
    rg = float(np.sqrt(((ca - centroid) ** 2).sum(axis=1).mean()))

    return {
        "id": case_id,
        "pdbId": pdb_id,
        "description": description,
        "chain": chain.id,
        "seq": chain.seq,
        "ss": chain.ss,
        "resNums": list(chain.res_nums),
        "coords": {
            name: [round(v, 3) for v in getattr(chain, name)]
            for name in (*MODEL_ATOMS, *EXTRA_ARRAYS)
        },
        "expected": {
            "sasaTotal": round(result.totalArea(), 3),
            "sasaPerResidue": per_residue,
            "radiusOfGyrationCa": round(rg, 4),
            "hydrogenBonds": bonds,
            "saltBridgePairs": [
                [a, b]
                for a, b in saltbridges.find(st)
                if a.startswith(f"{chain.id}:") and b.startswith(f"{chain.id}:")
            ],
        },
    }


def generate(cache: Path, out_path: Path) -> dict:
    fixture = {
        "generated": date.today().isoformat(),
        "generator": (
            f"FreeSASA, Shrake-Rupley, {REFERENCE_POINTS} test points, "
            f"probe {PROBE_RADIUS} A"
        ),
        "note": (
            "SASA is computed over the N/CA/C/O/CB model only -- the same atoms the "
            "viewer carries -- not over all atoms. Comparing a backbone surface "
            "against an all-atom one would be meaningless."
        ),
        "vdwRadii": VDW_RADII,
        "probeRadius": PROBE_RADIUS,
        "modelAtoms": list(MODEL_ATOMS),
        "modelElements": list(MODEL_ELEMENTS),
        "cases": [_case(cid, pdb, desc, cache) for cid, pdb, desc in CASES],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(fixture, separators=(",", ":")))
    return fixture
