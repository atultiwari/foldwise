"""Unit tests for structure parsing: geometry helpers, gap detection, schema."""

from __future__ import annotations

import math

import numpy as np
import pytest
from pydantic import ValidationError

from foldwise.model import Chain, Gap
from foldwise.parse import RawResidue, _find_gaps
from foldwise.residues import is_ligand, one_letter, virtual_cb


def _residue(res_num: int, ca: tuple[float, float, float], ins: str = " ") -> RawResidue:
    zero = np.zeros(3)
    return RawResidue(
        code="A", res_num=res_num, ins_code=ins,
        n=zero, ca=np.array(ca), c=zero, o=zero, cb=zero, sc=zero, bf=10.0,
    )


class TestOneLetter:
    def test_standard_residue(self) -> None:
        assert one_letter("ALA") == "A"
        assert one_letter("TRP") == "W"

    def test_selenomethionine_resolves_to_methionine(self) -> None:
        """MSE is used routinely for phasing. Dropping it would punch holes in
        the middle of otherwise complete chains."""
        assert one_letter("MSE") == "M"

    def test_non_amino_acid_returns_none(self) -> None:
        assert one_letter("HOH") is None
        assert one_letter("ATP") is None


class TestIsLigand:
    def test_cryoprotectant_is_not_a_ligand(self) -> None:
        assert not is_ligand("GOL")
        assert not is_ligand("PEG")
        assert not is_ligand("SO4")

    def test_haem_is_a_ligand(self) -> None:
        assert is_ligand("HEM")

    def test_drug_is_a_ligand(self) -> None:
        assert is_ligand("4WI")  # nirmatrelvir

    def test_magnesium_is_kept_despite_looking_like_an_ion(self) -> None:
        assert is_ligand("MG")


def _ideal_backbone() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """N, CA, C at textbook geometry: 1.458 A and 1.525 A bonds, 111 degrees.

    The Cb construction coefficients assume this. Feeding it a right angle
    gives a longer bond, which is the formula behaving correctly on
    non-physical input, not an error.
    """
    ca = np.zeros(3)
    n = np.array([1.458, 0.0, 0.0])
    angle = math.radians(111.0)
    c = 1.525 * np.array([math.cos(angle), math.sin(angle), 0.0])
    return n, ca, c


class TestVirtualCb:
    def test_bond_length_matches_the_textbook_value(self) -> None:
        n, ca, c = _ideal_backbone()
        assert np.linalg.norm(virtual_cb(n, ca, c) - ca) == pytest.approx(1.530, abs=0.005)

    def test_points_away_from_the_backbone(self) -> None:
        n, ca, c = _ideal_backbone()
        cb = virtual_cb(n, ca, c)
        assert np.dot(cb - ca, (n + c) / 2 - ca) < 0

    def test_is_chirally_correct(self) -> None:
        """L-amino acids put Cb on one specific side of the backbone plane.

        The construction takes its normal as cross(CA-N, C-CA) and subtracts
        along it, so Cb sits on the negative side of that normal. A sign error
        here would mirror every side chain in the model; `test_virtual_cb_
        matches_observed_positions` is what proves the sign against reality.
        """
        n, ca, c = _ideal_backbone()
        cb = virtual_cb(n, ca, c)
        normal = np.cross(ca - n, c - ca)
        assert np.dot(normal, cb - ca) < 0


class TestFindGaps:
    def test_continuous_chain_has_no_gaps(self) -> None:
        residues = [_residue(i + 1, (i * 3.8, 0.0, 0.0)) for i in range(5)]
        gaps, starts = _find_gaps(residues)
        assert gaps == []
        assert list(starts) == [True, False, False, False, False]

    def test_numbering_jump_is_a_gap_even_when_atoms_stay_close(self) -> None:
        """A disordered loop can double back, leaving the flanking Ca atoms
        adjacent. Only the numbering records that residues are missing."""
        residues = [_residue(1, (0.0, 0.0, 0.0)), _residue(40, (3.5, 0.0, 0.0))]
        gaps, starts = _find_gaps(residues)
        assert len(gaps) == 1
        assert gaps[0].missing_count == 38
        assert starts[1]

    def test_stretched_bond_is_a_gap_even_when_numbering_is_continuous(self) -> None:
        residues = [_residue(1, (0.0, 0.0, 0.0)), _residue(2, (30.0, 0.0, 0.0))]
        gaps, _ = _find_gaps(residues)
        assert len(gaps) == 1
        assert gaps[0].ca_distance == pytest.approx(30.0)
        assert gaps[0].missing_count == 0

    def test_insertion_codes_do_not_create_phantom_gaps(self) -> None:
        """Antibody numbering repeats a residue number with A, B, C suffixes."""
        residues = [
            _residue(100, (0.0, 0.0, 0.0)),
            _residue(100, (3.8, 0.0, 0.0), ins="A"),
            _residue(100, (7.6, 0.0, 0.0), ins="B"),
        ]
        gaps, _ = _find_gaps(residues)
        assert gaps == []


class TestChainSchema:
    @staticmethod
    def _valid(**overrides) -> dict:
        base = dict(
            id="A", seq="AAA", ss="CCC", res_nums=(1, 2, 3), ins_codes="   ",
            ca=(0.0,) * 9, n=(0.0,) * 9, c=(0.0,) * 9, o=(0.0,) * 9, cb=(0.0,) * 9,
            sc=(0.0,) * 9,
            bf=(1.0, 1.0, 1.0),
        )
        return {**base, **overrides}

    def test_accepts_consistent_chain(self) -> None:
        assert Chain(**self._valid()).seq == "AAA"

    def test_rejects_ss_of_wrong_length(self) -> None:
        with pytest.raises(ValidationError, match="ss is 2"):
            Chain(**self._valid(ss="CC"))

    def test_rejects_coordinate_array_of_wrong_length(self) -> None:
        with pytest.raises(ValidationError, match="ca is 6"):
            Chain(**self._valid(ca=(0.0,) * 6))

    def test_rejects_unknown_ss_code(self) -> None:
        with pytest.raises(ValidationError, match="bad SS codes"):
            Chain(**self._valid(ss="CXC"))

    def test_rejects_empty_chain(self) -> None:
        with pytest.raises(ValidationError):
            Chain(**self._valid(seq="", ss="", res_nums=(), ins_codes="",
                                ca=(), n=(), c=(), o=(), cb=(), sc=(), bf=()))

    def test_gap_is_frozen(self) -> None:
        gap = Gap(after_index=0, after_res_num=1, before_res_num=5,
                  missing_count=3, ca_distance=12.0)
        with pytest.raises(ValidationError):
            gap.missing_count = 4  # type: ignore[misc]
