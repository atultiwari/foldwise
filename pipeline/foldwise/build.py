"""Assemble one catalog entry into a validated `Structure`, then to JSON."""

from __future__ import annotations

import json
from pathlib import Path

from . import fetch, parse
from .catalog import Entry
from .model import Provenance, Structure

PIPELINE_VERSION = "0.1.0"

#: Minimum fraction of the deposited construct that must actually be resolved.
#: Disordered regions are normal and expected -- 2BBO is missing CFTR's whole
#: regulatory insertion and is still the right structure. Coverage this low
#: instead means we have fetched something other than what the catalog describes.
MIN_COVERAGE = 0.70


class BuildError(RuntimeError):
    pass


def _organism(meta: dict) -> str | None:
    for entity in meta.get("rcsb_entry_container_identifiers", {}).get("polymer_entity_ids", []):
        del entity  # organism lives on the entity endpoint; keep the JSON small instead
    return None


def build(entry: Entry, cache: Path) -> Structure:
    cif_path = fetch.coordinates(entry.pdb_id, cache)
    meta = fetch.summarise(fetch.metadata(entry.pdb_id, cache))

    st = parse.load(str(cif_path))
    chains = tuple(c for c in (parse.build_chain(ch) for ch in st[0]) if c is not None)
    if not chains:
        raise BuildError(f"{entry.pdb_id}: no usable polymer chains")

    structure = Structure(
        id=entry.id,
        pdb_id=entry.pdb_id,
        title=meta["title"],
        method=meta["method"],
        resolution=meta["resolution"],
        organism=_organism(meta),
        classification=meta["classification"],
        chains=chains,
        ligands=tuple(parse.build_ligands(st)),
        disulfides=tuple(parse.find_disulfides(st)),
        foldability=entry.foldability,
        deposited_residues=entry.deposited_residues,
        provenance=Provenance(
            retrieved=meta["retrieved"],
            pdb_deposited=meta["deposited"],
            pdb_revised=meta["revised"],
            pipeline_version=PIPELINE_VERSION,
        ),
    )
    _check_against_catalog(entry, structure)
    return structure


def _check_against_catalog(entry: Entry, structure: Structure) -> None:
    """Fail loudly when a structure is not the one the catalog describes.

    Low coverage is not an error in itself -- unobserved residues are a fact
    about the experiment, and the viewer reports them. This guard only catches
    fetching the wrong entry, or an entry revised out from under us.
    """
    if structure.coverage < MIN_COVERAGE:
        raise BuildError(
            f"{entry.pdb_id}: only {structure.residue_count} of "
            f"{entry.deposited_residues} deposited residues resolved "
            f"({structure.coverage:.0%}). Expected at least {MIN_COVERAGE:.0%} -- "
            "the entry may have been revised, or this is not the structure we think it is."
        )
    if len(structure.chains) != entry.expect_chains:
        raise BuildError(
            f"{entry.pdb_id}: expected {entry.expect_chains} chains, parsed "
            f"{len(structure.chains)}"
        )


def write(structure: Structure, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"{structure.id}.json"
    target.write_text(
        json.dumps(structure.model_dump(mode="json"), separators=(",", ":"))
    )
    return target
