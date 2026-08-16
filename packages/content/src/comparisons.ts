/**
 * Curated comparisons.
 *
 * Geometry alone cannot carry a clinical point, and for these pairs it can
 * actively mislead. Measured on the real structures:
 *
 * - HbA against HbS differ by **0.26 Å** on the α chain, with a noise floor of
 *   0.17 Å. The most-deviated residues are the floppy N-terminus. β6 — the
 *   residue that causes the disease — does not appear in a deviation ranking
 *   at all.
 * - NBD1 against ΔF508 differ by 1.67 Å, and the largest deviation is Gly404,
 *   at the edge of the disordered regulatory insertion. Not the deletion site.
 *
 * So each pair carries `differs` and, more importantly, `unchanged`: for three
 * of these four the clinical lesson is what has *not* moved.
 */

import type { LeveledText } from "./schema.js";

export interface ComparisonPair {
  readonly id: string;
  readonly story: string;
  readonly title: string;
  /** Structure ids, shown left and right. */
  readonly left: string;
  readonly right: string;
  /**
   * Which chain to superpose on.
   *
   * Matters more than it looks. Chain A of haemoglobin is the α chain, which
   * carries no mutation at all — comparing on it would show two identical
   * molecules and teach nothing. The β chain is where β6 lives.
   */
  readonly chain: number;
  readonly chainLabel: string;
  readonly view: "side-by-side" | "superposed";
  readonly summary: LeveledText;
  /** What genuinely differs, beyond noise. */
  readonly differs: readonly string[];
  /** What does not — often the actual lesson. */
  readonly unchanged: readonly string[];
}

export const COMPARISONS: readonly ComparisonPair[] = [
  {
    id: "hba-hbs",
    story: "sickle-cell",
    title: "Normal against sickle haemoglobin",
    left: "hba-deoxy",
    right: "hbs-deoxy",
    chain: 1,
    chainLabel: "β chain",
    view: "side-by-side",
    summary: {
      lay: "Put them side by side and you will struggle to tell them apart — because they are almost the same. One building block in 574 has changed. That is the whole disease.",
      student: "Superposed on the β chain these differ by a few tenths of an ångström, which is within the noise of two separately solved crystals. The substitution changes surface chemistry, not fold.",
      researcher: "Backbone deviation is at the level of crystallographic variation. Pathology arises from an intermolecular contact available only in the deoxy quaternary state, not from any conformational change.",
    },
    differs: [
      "β6 is glutamate in one and valine in the other — charged becomes hydrophobic",
      "HbS is crystallised as two tetramers in contact; HbA is a single tetramer",
    ],
    unchanged: [
      "The fold. Backbone deviation is within the noise of two separate crystals",
      "The haem pockets, and therefore oxygen binding — HbS carries oxygen almost normally",
      "Everything about the α chains, which are not involved at all",
    ],
  },
  {
    id: "nbd1-df508",
    story: "cystic-fibrosis",
    title: "CFTR NBD1, with and without Phe508",
    left: "nbd1-wt",
    right: "nbd1-df508",
    chain: 0,
    chainLabel: "the domain",
    view: "superposed",
    summary: {
      lay: "The two shapes lie almost on top of each other. The missing piece has not wrecked the structure — which is exactly the problem, because the cell throws it away anyway.",
      student: "Overlaid, wild type and Phe508del are broadly the same fold. The defect is thermodynamic and kinetic — reduced stability, slower folding, a damaged docking surface — not a collapse you can see.",
      researcher: "Backbone RMSD around 1.7 Å, with the largest deviations at the regulatory insertion rather than at the deletion. The functional consequence is in folding kinetics and NBD1–ICL4 assembly.",
    },
    differs: [
      "Residue 508 is absent, and the numbering jumps from 507 to 509",
      "The largest backbone deviation is at the regulatory insertion, which is disordered in both and not the cause of anything",
    ],
    unchanged: [
      "The overall fold — this is a folding defect, not a broken shape",
      "The Walker A motif and the ATP site, which are intact",
      "The channel's chemistry. It would work, if the cell let it reach the membrane",
    ],
  },
  {
    id: "abl-t315i",
    story: "imatinib",
    title: "ABL kinase, wild type against T315I",
    left: "abl-imatinib",
    right: "abl-t315i-ponatinib",
    chain: 0,
    chainLabel: "kinase domain",
    view: "superposed",
    summary: {
      lay: "The two kinases are the same shape. One guard residue has been swapped for a slightly larger one, and that is enough to stop a drug fitting.",
      student: "Superposed, the domains are near-identical. The resistance is not conformational: it is one side chain that is bulkier and has lost a hydroxyl, at the entrance to the pocket the drug occupies.",
      researcher: "Around 1 Å backbone RMSD. T315I acts sterically and by removing a hydrogen-bond donor, not by shifting the DFG equilibrium or reorganising the lobe.",
    },
    differs: [
      "Residue 315 is threonine in one and isoleucine in the other",
      "A different drug is bound — ponatinib, because imatinib no longer binds at all",
    ],
    unchanged: [
      "The bilobal kinase fold",
      "The DFG-out inactive conformation both drugs require",
      "The ATP site itself. The enzyme is not broken; the drug simply cannot reach its pocket",
    ],
  },
  {
    id: "mpro-dimer",
    story: "nirmatrelvir",
    title: "Mpro alone and as its biological dimer",
    left: "mpro-nirmatrelvir",
    right: "mpro-dimer",
    chain: 0,
    chainLabel: "protomer",
    view: "side-by-side",
    summary: {
      lay: "One copy and two. The single copy looks complete, but it cannot cut anything — the second copy reaches across and finishes the first one's blade.",
      student: "The protomer's own fold is unchanged by dimerisation. What changes is the substrate site, which is only complete once the partner's N-terminal finger is in place.",
      researcher: "Protomer backbone is essentially identical between the two. The functional difference is entirely intermolecular: the N-finger contributes to the partner's S1 subsite.",
    },
    differs: [
      "One protomer against two, with the N-terminal finger of each completing the other's site",
      "Small shifts at the very N-terminus, where the finger docks",
    ],
    unchanged: [
      "The fold of each protomer",
      "The catalytic dyad, Cys145 and His41, in the same place either way",
      "The drug's binding pose",
    ],
  },
];

const byId = new Map(COMPARISONS.map((pair) => [pair.id, pair]));
const byStory = new Map(COMPARISONS.map((pair) => [pair.story, pair]));

export function comparison(id: string): ComparisonPair | undefined {
  return byId.get(id);
}

export function comparisonForStory(story: string): ComparisonPair | undefined {
  return byStory.get(story);
}
