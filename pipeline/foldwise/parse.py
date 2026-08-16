"""mmCIF -> validated `Structure`.

Everything Foldscape's pipeline skipped is handled here: alternate locations,
insertion codes, modified residues, incomplete backbones, and chain breaks.
"""

from __future__ import annotations

from dataclasses import dataclass

import gemmi
import numpy as np

from .dssp import secondary_structure
from .model import Chain, Disulfide, Gap, Ligand, LigandAtom
from .residues import BACKBONE, is_ligand, one_letter, side_chain_centre, virtual_cb

#: Ca-Ca further apart than this means the chain is broken, not stretched.
#: Consecutive residues sit at 3.8 A; cis-proline can reach ~2.9 A.
CHAIN_BREAK_CA = 4.5

#: S-S bond length is ~2.05 A; allow for coordinate error.
DISULFIDE_MAX = 2.5

#: Polymer chains shorter than this are peptides or tags, not domains.
MIN_CHAIN_LENGTH = 20


@dataclass(frozen=True)
class RawResidue:
    code: str
    res_num: int
    ins_code: str
    n: np.ndarray
    ca: np.ndarray
    c: np.ndarray
    o: np.ndarray
    cb: np.ndarray
    sc: np.ndarray
    bf: float


def load(path: str) -> gemmi.Structure:
    st = gemmi.read_structure(path)
    st.setup_entities()
    st.remove_alternative_conformations()  # keeps altloc A
    st.remove_hydrogens()
    st.remove_waters()
    return st


def _atom(residue: gemmi.Residue, name: str) -> gemmi.Atom | None:
    for atom in residue:
        if atom.name == name:
            return atom
    return None


def _extract_residues(chain: gemmi.Chain) -> list[RawResidue]:
    out: list[RawResidue] = []
    for residue in chain:
        code = one_letter(residue.name)
        if code is None:
            continue
        atoms = [_atom(residue, name) for name in BACKBONE]
        if any(a is None for a in atoms):
            continue  # incomplete backbone: unusable, and a gap either side
        n, ca, c, o = (np.array([a.pos.x, a.pos.y, a.pos.z]) for a in atoms if a is not None)
        cb_atom = _atom(residue, "CB")
        cb = (
            np.array([cb_atom.pos.x, cb_atom.pos.y, cb_atom.pos.z])
            if cb_atom is not None
            else virtual_cb(n, ca, c)
        )
        out.append(
            RawResidue(
                code=code,
                res_num=residue.seqid.num,
                ins_code=residue.seqid.icode or " ",
                n=n, ca=ca, c=c, o=o, cb=cb,
                sc=side_chain_centre(residue, ca),
                bf=float(np.mean([a.b_iso for a in atoms if a is not None])),
            )
        )
    return out


def _find_gaps(residues: list[RawResidue]) -> tuple[list[Gap], np.ndarray]:
    """Locate chain breaks and mark the residues that start a new segment.

    Two independent signals, because either alone misses cases. A jump in
    residue numbering is the authoritative record of unobserved residues, but
    a disordered stretch can loop back so the flanking Ca atoms stay close.
    Conversely an unnumbered break still shows up as a stretched Ca-Ca step.
    """
    gaps: list[Gap] = []
    starts = np.zeros(len(residues), dtype=bool)
    if residues:
        starts[0] = True

    for i in range(len(residues) - 1):
        here, nxt = residues[i], residues[i + 1]
        d = float(np.linalg.norm(nxt.ca - here.ca))
        numbering_jump = nxt.res_num - here.res_num
        # Insertion codes make consecutive residues share a number legitimately.
        unobserved = max(0, numbering_jump - 1) if here.ins_code == " " else 0

        if unobserved == 0 and d <= CHAIN_BREAK_CA:
            continue

        gaps.append(
            Gap(
                after_index=i,
                after_res_num=here.res_num,
                before_res_num=nxt.res_num,
                missing_count=unobserved,
                ca_distance=round(d, 2),
            )
        )
        starts[i + 1] = True
    return gaps, starts


def _round_flat(vectors: list[np.ndarray], dp: int = 2) -> tuple[float, ...]:
    return tuple(round(float(v), dp) for vec in vectors for v in vec)


def build_chain(chain: gemmi.Chain) -> Chain | None:
    residues = _extract_residues(chain)
    if len(residues) < MIN_CHAIN_LENGTH:
        return None

    gaps, starts = _find_gaps(residues)
    stack = lambda attr: np.array([getattr(r, attr) for r in residues])  # noqa: E731
    seq = "".join(r.code for r in residues)

    ss = secondary_structure(
        ca=stack("ca"), n=stack("n"), c=stack("c"), o=stack("o"),
        is_proline=np.array([r.code == "P" for r in residues]),
        chain_start=starts,
    )

    return Chain(
        id=chain.name,
        seq=seq,
        ss=ss,
        res_nums=tuple(r.res_num for r in residues),
        ins_codes="".join(r.ins_code for r in residues),
        ca=_round_flat([r.ca for r in residues]),
        n=_round_flat([r.n for r in residues]),
        c=_round_flat([r.c for r in residues]),
        o=_round_flat([r.o for r in residues]),
        cb=_round_flat([r.cb for r in residues]),
        sc=_round_flat([r.sc for r in residues]),
        bf=tuple(round(r.bf, 2) for r in residues),
        gaps=tuple(gaps),
    )


def build_ligands(st: gemmi.Structure) -> list[Ligand]:
    ligands: list[Ligand] = []
    for chain in st[0]:
        for residue in chain:
            if one_letter(residue.name) is not None:
                continue
            if not is_ligand(residue.name):
                continue
            info = gemmi.find_tabulated_residue(residue.name)
            ligands.append(
                Ligand(
                    comp_id=residue.name,
                    name=(info.name if info else residue.name) or residue.name,
                    chain=chain.name,
                    res_num=residue.seqid.num,
                    atoms=tuple(
                        LigandAtom(
                            element=a.element.name,
                            xyz=(round(a.pos.x, 2), round(a.pos.y, 2), round(a.pos.z, 2)),
                        )
                        for a in residue
                    ),
                )
            )
    return ligands


def find_disulfides(st: gemmi.Structure) -> list[Disulfide]:
    sulfurs: list[tuple[str, int, gemmi.Position]] = []
    for chain in st[0]:
        for residue in chain:
            if residue.name != "CYS":
                continue
            sg = _atom(residue, "SG")
            if sg is not None:
                sulfurs.append((chain.name, residue.seqid.num, sg.pos))

    bonds: list[Disulfide] = []
    for i in range(len(sulfurs)):
        for j in range(i + 1, len(sulfurs)):
            chain_a, res_a, pos_a = sulfurs[i]
            chain_b, res_b, pos_b = sulfurs[j]
            d = pos_a.dist(pos_b)
            if d <= DISULFIDE_MAX:
                bonds.append(
                    Disulfide(
                        chain_a=chain_a, res_a=res_a,
                        chain_b=chain_b, res_b=res_b,
                        distance=round(d, 2),
                    )
                )
    return bonds
