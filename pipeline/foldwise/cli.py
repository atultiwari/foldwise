"""`uv run python -m foldwise.cli build` -- regenerate every structure in the catalog."""

from __future__ import annotations

import argparse
import sys
import traceback
from pathlib import Path

from .build import BuildError, build, write
from .catalog import V1_ENTRIES, Entry
from .reference import generate

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CACHE = ROOT / "data" / "cache"
DEFAULT_OUT = ROOT / "data" / "structures"
FIXTURE_OUT = ROOT / "packages" / "core" / "test" / "fixtures" / "reference.json"

SS_GROUPS = {"helix": "HGI", "strand": "EB", "turn": "TS", "coil": "C"}


def _fractions(structure) -> str:
    ss = "".join(c.ss for c in structure.chains)
    total = max(len(ss), 1)
    parts = [
        f"{name} {sum(ss.count(code) for code in codes) / total:.0%}"
        for name, codes in SS_GROUPS.items()
    ]
    return "  ".join(parts)


def build_one(entry: Entry, cache: Path, out: Path) -> bool:
    try:
        structure = build(entry, cache)
    except BuildError as exc:
        print(f"  FAIL  {entry.pdb_id:6s} {exc}", file=sys.stderr)
        return False
    except Exception:  # noqa: BLE001 -- report and continue to the next entry
        print(f"  ERROR {entry.pdb_id:6s} unexpected:", file=sys.stderr)
        traceback.print_exc()
        return False

    path = write(structure, out)
    gaps = sum(len(c.gaps) for c in structure.chains)
    size_kb = path.stat().st_size / 1024
    print(
        f"  ok    {entry.pdb_id:6s} {structure.residue_count:5d} res  "
        f"{len(structure.chains)} ch  {gaps} gap  "
        f"{len(structure.ligands)} lig  {len(structure.disulfides)} ss  "
        f"{size_kb:6.1f} KB  |  {_fractions(structure)}"
    )
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="foldwise")
    parser.add_argument("command", choices=["build", "reference"])
    parser.add_argument("--only", nargs="*", help="limit to these catalog ids")
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args(argv)

    if args.command == "reference":
        fixture = generate(args.cache, FIXTURE_OUT)
        size_kb = FIXTURE_OUT.stat().st_size / 1024
        print(f"Reference fixture -> {FIXTURE_OUT}  ({size_kb:.1f} KB)")
        for case in fixture["cases"]:
            expected = case["expected"]
            print(
                f"  {case['pdbId']}  {len(case['seq']):4d} res  "
                f"SASA {expected['sasaTotal']:10,.1f} A^2  Rg {expected['radiusOfGyrationCa']:6.2f} A"
            )
        return 0

    entries = V1_ENTRIES
    if args.only:
        wanted = set(args.only)
        entries = tuple(e for e in entries if e.id in wanted or e.pdb_id in wanted)
        if not entries:
            print(f"no catalog entries match {sorted(wanted)}", file=sys.stderr)
            return 2

    print(f"Building {len(entries)} structures -> {args.out}")
    ok = sum(build_one(entry, args.cache, args.out) for entry in entries)
    failed = len(entries) - ok
    print(f"\n{ok} built, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
