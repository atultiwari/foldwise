/**
 * Turning an authored residue claim into something the renderer can point at.
 *
 * Content names residues the way a clinician does — chain B, number 6 — and
 * the renderer indexes them the way an array does. Author numbering is not
 * sequential (structures have gaps, insertion codes and constructs that start
 * at 400), so this lookup is the only correct way across.
 *
 * Missing residues resolve to nothing rather than to index 0, because pointing
 * confidently at the wrong atom is worse than pointing at none.
 */

import type { ResidueClaim } from "@foldwise/content";
import type { Structure } from "@foldwise/ui";

export interface ResidueRef {
  readonly chain: number;
  readonly residue: number;
}

export function resolveResidue(structure: Structure, claim: ResidueClaim): ResidueRef | null {
  const chain = structure.chains.findIndex((c) => c.id === claim.chain);
  if (chain < 0) return null;
  const residue = structure.chains[chain]!.res_nums.indexOf(claim.resNum);
  if (residue < 0) return null;
  return { chain, residue };
}

export function resolveResidues(
  structure: Structure,
  claims: readonly ResidueClaim[],
): readonly ResidueRef[] {
  return claims
    .map((claim) => resolveResidue(structure, claim))
    .filter((ref): ref is ResidueRef => ref !== null);
}
