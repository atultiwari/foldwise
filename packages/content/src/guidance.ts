/**
 * Teaching the notation.
 *
 * A cartoon representation is a convention someone invented. Nobody is born
 * able to read it, any more than they are born able to read an ECG — and the
 * app was handing clinical readers a 3D model, a folding timeline and four
 * biophysical read-outs with no key to any of it.
 *
 * Three things live here: what the shapes mean, what the numbers mean and what
 * a change in them means, and three things worth noticing in each structure.
 *
 * Kept separate from `structures.ts` so the editorial voice and the teaching
 * scaffolding can be edited independently.
 */

import type { LeveledText, ResidueClaim } from "./schema.js";

// ── The notation key ───────────────────────────────────────────────────────

export interface NotationEntry {
  readonly id: string;
  readonly label: string;
  /** Which palette entry draws it, so the key and the model cannot drift. */
  readonly shape: "helix" | "strand" | "coil";
  readonly meaning: string;
  /** What it tells you, beyond what it is. */
  readonly soWhat: string;
}

export const NOTATION: readonly NotationEntry[] = [
  {
    id: "helix",
    label: "Spiral ribbon",
    shape: "helix",
    meaning:
      "An α-helix. The backbone coils, held by a hydrogen bond from each residue to the one four along.",
    soWhat:
      "Helices are local: everything holding them together is a few residues away, so they form early and fast.",
  },
  {
    id: "strand",
    label: "Flat arrow",
    shape: "strand",
    meaning:
      "A β-strand. Extended stretches line up side by side into a sheet. The arrowhead points from the start of the chain toward the end.",
    soWhat:
      "Strands pair with partners that can be far away in sequence, so sheets close late — and their arrows tell you whether neighbours run together or in opposite directions.",
  },
  {
    id: "coil",
    label: "Thin tube",
    shape: "coil",
    meaning:
      "Loop and turn. Everything that is neither helix nor sheet, drawn thin because there is no repeating pattern to show.",
    soWhat:
      "Loops look like slack, but they are usually where a protein moves, binds, and gets cut.",
  },
];

// ── Read-out explainers ────────────────────────────────────────────────────

export interface Explainer {
  /** Matches the read-out's label. */
  readonly id: string;
  readonly what: LeveledText;
  /** The half that is usually missing: what a change in it means. */
  readonly rising: string;
  readonly falling: string;
}

export const EXPLAINERS: readonly Explainer[] = [
  {
    id: "rmsd",
    what: {
      lay: "How far this shape is from the finished one, averaged over the whole chain. Zero means it has arrived.",
      student: "Root-mean-square deviation from the deposited structure after optimal superposition, in ångström. It measures shape, not position.",
      researcher: "RMSD to the native coordinates after Kabsch superposition on all α-carbons.",
    },
    rising: "The chain is moving away from its folded shape — you are scrubbing backwards.",
    falling: "It is finding its fold. This falls fastest during collapse, then creeps as the core settles.",
  },
  {
    id: "radius",
    what: {
      lay: "How spread out the chain is. A loose string has a big number; a packed ball has a small one.",
      student: "Radius of gyration — the root-mean-square distance of residues from their centre of mass.",
      researcher: "Rg over α-carbons, unweighted. The denatured starting value is calibrated to Rg = 1.93·N^0.598 Å.",
    },
    rising: "The chain is expanding — unfolding, or being pulled apart.",
    falling: "Hydrophobic collapse. This is the single clearest signal that folding is happening.",
  },
  {
    id: "contacts",
    what: {
      lay: "How much of the finished structure's internal contact has formed yet.",
      student: "The fraction of native contacts present, Q — the standard reaction coordinate for folding.",
      researcher: "Q over residue pairs within 8 Å and at least three apart in sequence, with a 1.2× tolerance.",
    },
    rising: "The fold is assembling. Q reaching 1 is the definition of arriving.",
    falling: "Contacts are breaking — the structure is coming apart.",
  },
  {
    id: "buried",
    what: {
      lay: "How much of the protein is hidden inside, away from water. Folding is mostly the act of burying things.",
      student: "The fraction of residues with less than a quarter of their maximum surface exposed.",
      researcher: "Relative solvent accessibility below 0.25, using Tien et al. maximum ASA values.",
    },
    rising: "A core is forming. This is what folding is *for*.",
    falling: "The interior is being exposed to solvent.",
  },
];

const explainerById = new Map(EXPLAINERS.map((entry) => [entry.id, entry]));

export function explainer(id: string): Explainer | undefined {
  return explainerById.get(id);
}

// ── First look ─────────────────────────────────────────────────────────────

export interface FirstLookItem {
  readonly text: string;
  /** Optional residue this points at, verified against the structure. */
  readonly residue?: ResidueClaim;
}

/**
 * Three things worth noticing, per structure.
 *
 * The structural equivalent of "rate, rhythm, axis" — a fixed short list that
 * gives a reader somewhere to start instead of a rotatable blob.
 */
export const FIRST_LOOK: Readonly<Record<string, readonly FirstLookItem[]>> = {
  "hba-deoxy": [
    { text: "No arrows anywhere. The globin fold is all helix — a protein with zero β-sheet, which is unusual enough to be worth noticing." },
    { text: "Four separate subunits, packed as two matching pairs. Oxygen binding in one changes the shape of the others." },
    { text: "A haem sits in a pocket of each subunit. The iron in it is what actually carries the oxygen.", residue: { chain: "B", resNum: 92, code: "H" } },
  ],
  "hbs-deoxy": [
    { text: "Eight chains, not four: two whole tetramers, caught touching each other." },
    { text: "Find where they touch. That contact is the disease — everything else here is normal haemoglobin.", residue: { chain: "B", resNum: 6, code: "V" } },
    { text: "The shape of each tetramer is unchanged. One residue in 574 differs from healthy haemoglobin." },
  ],
  "nbd1-wt": [
    { text: "A mixed fold — helices and a sheet — which is what an ATP-binding domain usually looks like." },
    { text: "Phe508 sits on the outside surface, not tucked in a pocket. It matters because of what it touches.", residue: { chain: "A", resNum: 508, code: "F" } },
    { text: "The chain breaks and restarts. Around 34 residues were never seen — they are disordered, not absent." },
  ],
  "nbd1-df508": [
    { text: "Compare the overall shape with the wild-type domain. It is broadly the same, and that is the point." },
    { text: "The numbering skips from 507 to 509. The residue is simply gone.", residue: { chain: "A", resNum: 507, code: "I" } },
    { text: "The ATP site is untouched. This channel would work if the cell ever let it reach the surface." },
  ],
  "cftr-full": [
    { text: "Long helices crossing the middle: this is a membrane protein, and those sit in the lipid bilayer." },
    { text: "Two nucleotide-binding domains at the bottom. One of them is the whole story of the two structures before this." },
    { text: "Around 270 residues are missing — mostly the regulatory domain, which is disordered until phosphorylated." },
  ],
  "abl-imatinib": [
    { text: "Two lobes: a small sheet-rich one on top, a large helical one below. Every protein kinase looks like this." },
    { text: "The drug sits in the cleft between the lobes — the same cleft that normally holds ATP." },
    { text: "Thr315 guards the entrance to a pocket behind the drug. Its small side chain is what leaves the way open.", residue: { chain: "A", resNum: 315, code: "T" } },
  ],
  "abl-t315i-ponatinib": [
    { text: "The same bilobal kinase. Nothing about the overall architecture has changed." },
    { text: "Position 315 is now isoleucine — larger, and with no hydroxyl to offer a hydrogen bond.", residue: { chain: "A", resNum: 315, code: "I" } },
    { text: "A different drug is bound. Imatinib is absent because it no longer fits, not because nobody tried." },
  ],
  "mpro-nirmatrelvir": [
    { text: "Two β-barrels side by side, with a helical domain trailing behind them." },
    { text: "The drug lies in the groove between the barrels, where the viral polyprotein would normally sit." },
    { text: "Cys145 is the residue the drug bonds to. Almost every protease you have met uses serine here.", residue: { chain: "A", resNum: 145, code: "C" } },
  ],
  "mpro-dimer": [
    { text: "Two copies of the same protein. Colour by chain to tell them apart." },
    { text: "Look at where the first few residues of each chain go — they reach into the *other* copy." },
    { text: "That reach is why a single copy is dead: neither half has a complete site without the other.", residue: { chain: "A", resNum: 1, code: "S" } },
  ],
};

export function firstLook(structureId: string): readonly FirstLookItem[] {
  return FIRST_LOOK[structureId] ?? [];
}
