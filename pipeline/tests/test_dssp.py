"""Unit tests for the DSSP implementation.

The state machine is tested with synthetic hydrogen-bond maps, which isolates
the assignment logic from any question about geometry. Agreement with a real
external assignment is covered separately in `test_cross_validation.py`.
"""

from __future__ import annotations

import numpy as np
import pytest

from foldwise.dssp.assign import (
    assign,
    bends,
    bridges,
    helices_from_turns,
    n_turns,
    strands_from_bridges,
)
from foldwise.dssp.hbond import ENERGY_CUTOFF, amide_hydrogens, bond_energy


class TestBondEnergy:
    def test_ideal_geometry_is_a_bond(self) -> None:
        """A well-formed N-H...O=C at ~2 A gives roughly -3 kcal/mol."""
        o = np.array([0.0, 0.0, 0.0])
        c = np.array([-1.23, 0.0, 0.0])
        h = np.array([1.9, 0.0, 0.0])
        n = np.array([2.9, 0.0, 0.0])
        energy = bond_energy(n, h, c, o)
        assert energy < ENERGY_CUTOFF
        assert -6.0 < energy < -1.0

    def test_distant_pair_is_not_a_bond(self) -> None:
        o = np.array([0.0, 0.0, 0.0])
        c = np.array([-1.23, 0.0, 0.0])
        h = np.array([12.0, 0.0, 0.0])
        n = np.array([13.0, 0.0, 0.0])
        assert bond_energy(n, h, c, o) > ENERGY_CUTOFF

    def test_energy_weakens_with_distance(self) -> None:
        o, c = np.array([0.0, 0.0, 0.0]), np.array([-1.23, 0.0, 0.0])
        near = bond_energy(np.array([2.9, 0.0, 0.0]), np.array([1.9, 0.0, 0.0]), c, o)
        far = bond_energy(np.array([4.9, 0.0, 0.0]), np.array([3.9, 0.0, 0.0]), c, o)
        assert near < far


class TestAmideHydrogens:
    @staticmethod
    def _chain(size: int) -> tuple[np.ndarray, ...]:
        idx = np.arange(size, dtype=float)
        n = np.stack([idx * 3.8, np.zeros(size), np.zeros(size)], axis=1)
        c = n + np.array([1.5, 0.5, 0.0])
        o = c + np.array([0.0, 1.23, 0.0])
        return n, c, o

    def test_first_residue_is_never_a_donor(self) -> None:
        n, c, o = self._chain(5)
        _, is_donor = amide_hydrogens(
            n, c, o, np.zeros(5, dtype=bool), np.array([True, False, False, False, False])
        )
        assert not is_donor[0]
        assert is_donor[1:].all()

    def test_proline_is_never_a_donor(self) -> None:
        n, c, o = self._chain(5)
        proline = np.array([False, False, True, False, False])
        _, is_donor = amide_hydrogens(
            n, c, o, proline, np.array([True, False, False, False, False])
        )
        assert not is_donor[2]

    def test_residue_after_a_chain_break_is_not_a_donor(self) -> None:
        """Its H would be oriented by a carbonyl it is not bonded to."""
        n, c, o = self._chain(6)
        starts = np.array([True, False, False, True, False, False])
        _, is_donor = amide_hydrogens(n, c, o, np.zeros(6, dtype=bool), starts)
        assert not is_donor[3]

    def test_hydrogen_sits_one_angstrom_from_nitrogen(self) -> None:
        n, c, o = self._chain(4)
        h, _ = amide_hydrogens(n, c, o, np.zeros(4, dtype=bool), np.zeros(4, dtype=bool))
        for i in range(1, 4):
            assert np.linalg.norm(h[i] - n[i]) == pytest.approx(1.0, abs=1e-6)


class TestTurnsAndHelices:
    def test_n_turn_reads_the_map_diagonal(self) -> None:
        hb = np.zeros((10, 10), dtype=bool)
        hb[2, 6] = True
        turn = n_turns(hb, 4)
        assert turn[2]
        assert turn.sum() == 1

    def test_two_consecutive_turns_make_a_helix(self) -> None:
        turn = np.zeros(12, dtype=bool)
        turn[2] = turn[3] = True
        mask = helices_from_turns(turn, 4)
        # Turns at 2 and 3 place residues 3..6 inside the helix.
        assert list(np.flatnonzero(mask)) == [3, 4, 5, 6]

    def test_a_single_turn_is_not_a_helix(self) -> None:
        turn = np.zeros(12, dtype=bool)
        turn[2] = True
        assert not helices_from_turns(turn, 4).any()


class TestBridgesAndStrands:
    def test_antiparallel_bridge_from_reciprocal_bonds(self) -> None:
        hb = np.zeros((20, 20), dtype=bool)
        hb[4, 12] = hb[12, 4] = True
        assert (4, 12, "A") in bridges(hb)

    def test_terminal_residues_can_form_bridges(self) -> None:
        """Regression: the first and last residue were excluded from every
        ladder, which shortened terminal strands by a residue."""
        size = 10
        hb = np.zeros((size, size), dtype=bool)
        hb[0, 9] = hb[9, 0] = True
        found = bridges(hb)
        assert (0, 9, "A") in found

    def test_near_neighbours_are_not_bridges(self) -> None:
        hb = np.zeros((20, 20), dtype=bool)
        hb[4, 6] = hb[6, 4] = True
        assert not [b for b in bridges(hb) if b[:2] == (4, 6)]

    def test_lone_bridge_is_isolated_not_a_strand(self) -> None:
        ladder, isolated = strands_from_bridges([(3, 11, "A")], 20)
        assert not ladder.any()
        assert isolated[3] and isolated[11]

    def test_consecutive_bridges_make_a_ladder(self) -> None:
        pairs = [(3, 11, "A"), (4, 10, "A")]
        ladder, isolated = strands_from_bridges(pairs, 20)
        assert ladder[3] and ladder[4] and ladder[10] and ladder[11]
        assert not isolated.any()


class TestBends:
    def test_straight_chain_has_no_bend(self) -> None:
        ca = np.stack([np.arange(10) * 3.8, np.zeros(10), np.zeros(10)], axis=1)
        assert not bends(ca).any()

    def test_right_angle_is_a_bend(self) -> None:
        ca = np.array(
            [[0, 0, 0], [3.8, 0, 0], [7.6, 0, 0], [7.6, 3.8, 0], [7.6, 7.6, 0]], dtype=float
        )
        assert bends(ca)[2]


class TestAssign:
    def test_empty_chain(self) -> None:
        assert assign(np.zeros((0, 0), dtype=bool), np.zeros((0, 3))) == ""

    def test_output_length_matches_input(self) -> None:
        size = 15
        ca = np.stack([np.arange(size) * 3.8, np.zeros(size), np.zeros(size)], axis=1)
        assert len(assign(np.zeros((size, size), dtype=bool), ca)) == size

    def test_helix_wins_over_turn(self) -> None:
        """A residue inside an alpha helix is also inside 4-turns; DSSP's
        precedence must report H, not T."""
        size = 14
        hb = np.zeros((size, size), dtype=bool)
        for i in (2, 3, 4):
            hb[i, i + 4] = True
        ca = np.stack([np.arange(size) * 3.8, np.zeros(size), np.zeros(size)], axis=1)
        assert "H" in assign(hb, ca)
