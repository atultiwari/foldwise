"""Download mmCIF coordinates and entry metadata from RCSB, with a local cache.

Every fetch records the date it happened. PDB entries get revised and
superseded; a structure with no retrieval date is a structure you cannot cite.
"""

from __future__ import annotations

import gzip
import json
from datetime import date
from pathlib import Path

import requests

COORDS_URL = "https://files.rcsb.org/download/{pdb_id}.cif.gz"
ENTRY_URL = "https://data.rcsb.org/rest/v1/core/entry/{pdb_id}"
TIMEOUT = 60


def _download(url: str) -> bytes:
    response = requests.get(url, timeout=TIMEOUT)
    response.raise_for_status()
    return response.content


def coordinates(pdb_id: str, cache: Path) -> Path:
    """Return a path to the uncompressed mmCIF, downloading it if absent."""
    cache.mkdir(parents=True, exist_ok=True)
    target = cache / f"{pdb_id.lower()}.cif"
    if target.exists():
        return target
    raw = _download(COORDS_URL.format(pdb_id=pdb_id.upper()))
    target.write_bytes(gzip.decompress(raw))
    return target


def metadata(pdb_id: str, cache: Path) -> dict:
    cache.mkdir(parents=True, exist_ok=True)
    target = cache / f"{pdb_id.lower()}.entry.json"
    if target.exists():
        return json.loads(target.read_text())
    payload = json.loads(_download(ENTRY_URL.format(pdb_id=pdb_id.upper())))
    payload["_retrieved"] = date.today().isoformat()
    target.write_text(json.dumps(payload))
    return payload


def summarise(meta: dict) -> dict:
    """Pull the handful of fields the viewer displays out of RCSB's payload."""
    info = meta.get("rcsb_entry_info", {})
    accession = meta.get("rcsb_accession_info", {})
    resolutions = info.get("resolution_combined") or []
    methods = meta.get("exptl") or [{}]
    return {
        "title": meta.get("struct", {}).get("title", ""),
        "method": methods[0].get("method", "UNKNOWN"),
        "resolution": resolutions[0] if resolutions else None,
        "classification": meta.get("struct_keywords", {}).get("pdbx_keywords"),
        "deposited": (accession.get("deposit_date") or "")[:10] or "unknown",
        "revised": (accession.get("revision_date") or "")[:10] or None,
        "retrieved": meta.get("_retrieved", date.today().isoformat()),
    }
