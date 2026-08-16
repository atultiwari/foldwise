"""Typed, validated shape of everything the pipeline emits.

The browser never parses mmCIF. It receives exactly these structures as JSON,
so this module is the contract between the pipeline and `packages/core`.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

SS_ALPHABET = set("HGIEBTSC")

# Residues that are foldable and renderable in the viewer.
Foldability = Literal["fold", "static"]


class Gap(BaseModel):
    """A chain break: residues that exist in the protein but not in the map.

    Real crystal structures are full of these -- 2BBO is missing CFTR's entire
    regulatory insertion -- and bridging one silently would draw a peptide bond
    where no density exists. The viewer must render these as breaks and say why.
    """

    model_config = ConfigDict(frozen=True)

    after_index: int = Field(ge=0, description="0-based residue index the gap follows")
    after_res_num: int
    before_res_num: int
    missing_count: int = Field(ge=0, description="Residues unobserved across the break")
    ca_distance: float = Field(description="Observed Ca-Ca distance across the break, A")


class Chain(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    seq: str
    ss: str = Field(description="DSSP 8-state string, same length as seq")
    res_nums: tuple[int, ...]
    ins_codes: str = Field(description="One char per residue; space = none")
    ca: tuple[float, ...]
    n: tuple[float, ...]
    c: tuple[float, ...]
    o: tuple[float, ...]
    cb: tuple[float, ...] = Field(description="Virtual Cb for glycine")
    sc: tuple[float, ...] = Field(
        description="Side-chain functional-group centroid; charged group where there is one"
    )
    bf: tuple[float, ...]
    gaps: tuple[Gap, ...] = ()

    @model_validator(mode="after")
    def _lengths_agree(self) -> Chain:
        n_res = len(self.seq)
        if n_res == 0:
            raise ValueError(f"chain {self.id}: empty")
        for name in ("ss", "ins_codes"):
            if len(getattr(self, name)) != n_res:
                raise ValueError(
                    f"chain {self.id}: {name} is {len(getattr(self, name))}, expected {n_res}"
                )
        if len(self.res_nums) != n_res or len(self.bf) != n_res:
            raise ValueError(f"chain {self.id}: res_nums/bf length mismatch")
        for name in ("ca", "n", "c", "o", "cb", "sc"):
            got = len(getattr(self, name))
            if got != n_res * 3:
                raise ValueError(f"chain {self.id}: {name} is {got}, expected {n_res * 3}")
        bad = set(self.ss) - SS_ALPHABET
        if bad:
            raise ValueError(f"chain {self.id}: bad SS codes {sorted(bad)}")
        return self


class LigandAtom(BaseModel):
    model_config = ConfigDict(frozen=True)

    element: str
    xyz: tuple[float, float, float]


class Ligand(BaseModel):
    model_config = ConfigDict(frozen=True)

    comp_id: str
    name: str
    chain: str
    res_num: int
    atoms: tuple[LigandAtom, ...]
    bonds: tuple[tuple[int, int], ...] = ()


class Disulfide(BaseModel):
    model_config = ConfigDict(frozen=True)

    chain_a: str
    res_a: int
    chain_b: str
    res_b: int
    distance: float


class Provenance(BaseModel):
    """Every number the app displays must be traceable to a dated source."""

    model_config = ConfigDict(frozen=True)

    source: str = "RCSB Protein Data Bank"
    licence: str = "CC0 1.0 (public domain)"
    retrieved: str
    pdb_deposited: str
    pdb_revised: str | None = None
    pipeline_version: str


class Structure(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    pdb_id: str
    title: str
    method: str
    resolution: float | None
    organism: str | None
    classification: str | None
    chains: tuple[Chain, ...]
    ligands: tuple[Ligand, ...] = ()
    disulfides: tuple[Disulfide, ...] = ()
    foldability: Foldability = "fold"
    deposited_residues: int = Field(
        description="Residue count RCSB reports for the entry, including unobserved ones"
    )
    provenance: Provenance

    @property
    def residue_count(self) -> int:
        """Residues actually resolved, with a complete backbone. This is what
        the viewer renders and what every metric is computed from."""
        return sum(len(c.seq) for c in self.chains)

    @property
    def unobserved_residues(self) -> int:
        return sum(gap.missing_count for chain in self.chains for gap in chain.gaps)

    @property
    def coverage(self) -> float:
        """Fraction of the deposited construct that is actually visible."""
        return self.residue_count / max(self.deposited_residues, 1)
