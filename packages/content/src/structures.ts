/**
 * Per-structure editorial content.
 *
 * Every `residues` entry is a checkable claim: the test looks the residue up in
 * the emitted structure file and fails if the amino acid is not the one named
 * here. Writing "Thr315" and being wrong is a test failure, not a plausible
 * sentence nobody catches.
 */

import type { StructureContent } from "./schema.js";

export const STRUCTURE_CONTENT: readonly StructureContent[] = [
  // ── Sickle cell ─────────────────────────────────────────────────────────
  {
    id: "hba-deoxy",
    story: "sickle-cell",
    name: "Haemoglobin A",
    tagline: "The reference tetramer, in its oxygen-released state",
    role: "wild-type",
    summary: {
      lay: "Normal adult haemoglobin: four subunits, each cradling an iron-containing haem that carries one oxygen molecule.",
      student: "Deoxyhaemoglobin A at 1.74 Å — two α and two β chains in the tense (T) quaternary state, with four haems. The all-α globin fold has no β-sheet at all.",
      researcher: "Fermi and Perutz's deoxy structure, the reference point for every allosteric and variant comparison in the haemoglobin literature.",
    },
    keyFact: "Entirely helical — the globin fold contains no β-sheet whatsoever, which is why the model shows no arrows.",
    annotations: [
      {
        id: "beta6",
        label: "Position β6 — glutamate here",
        description:
          "In HbA this is glutamate: charged, comfortable on a surface facing water. " +
          "It is the single residue substituted in sickle cell disease. Note the two " +
          "numbering conventions — clinicians say β6, while HGVS counts the initiator " +
          "methionine and writes p.Glu7Val.",
        residues: [{ chain: "B", resNum: 6, code: "E" }],
        citation: "ingram-1957-sickle",
      },
      {
        id: "acceptor-pocket",
        label: "The acceptor pocket",
        description:
          "Phe85 and Leu88 on the β chain line a hydrophobic pocket. In HbA nothing " +
          "docks here. In HbS it receives the mutant valine of a neighbouring tetramer, " +
          "and that contact is what builds the fibre.",
        residues: [
          { chain: "B", resNum: 85, code: "F" },
          { chain: "B", resNum: 88, code: "L" },
        ],
        citation: "harrington-1997-hbs",
      },
      {
        id: "proximal-his",
        label: "Proximal histidine",
        description:
          "His92 of the β chain binds the haem iron directly and is the mechanical link " +
          "between oxygen binding and the quaternary shift that makes haemoglobin " +
          "cooperative.",
        residues: [{ chain: "B", resNum: 92, code: "H" }],
      },
    ],
    caveats: [],
    citations: ["fermi-1984-deoxyhb"],
  },
  {
    id: "hbs-deoxy",
    story: "sickle-cell",
    name: "Haemoglobin S",
    tagline: "The mutation and its consequence in a single file",
    role: "variant",
    summary: {
      lay: "Sickle haemoglobin. One building block has changed, and the crystal caught two molecules in the act of sticking together.",
      student: "Deoxy-HbS with two tetramers in the asymmetric unit. The lateral contact between them is the polymer contact itself: β6 valine of one tetramer inserted into the hydrophobic pocket of its neighbour.",
      researcher: "Eight chains, capturing the intermolecular geometry that underlies fibre formation rather than only the substitution that causes it.",
    },
    keyFact: "The valine only finds its pocket in the deoxygenated state — which is why hypoxia, acidosis and dehydration precipitate a crisis, and why oxygenated HbS behaves nearly normally.",
    annotations: [
      {
        id: "val6",
        label: "β6 valine — the substitution",
        description:
          "Glutamate replaced by valine. Charged becomes greasy, on a surface that faces " +
          "water. Nothing about the oxygen-binding site has changed: this residue is " +
          "nowhere near the haem.",
        residues: [{ chain: "B", resNum: 6, code: "V" }],
        citation: "ingram-1957-sickle",
      },
      {
        id: "receiving-pocket",
        label: "Where it docks",
        description:
          "Phe85 and Leu88 on a β chain of the adjacent tetramer. The valine of one " +
          "molecule and this pocket on the next is the repeating contact that builds a " +
          "fibre out of millions of tetramers.",
        residues: [
          { chain: "D", resNum: 85, code: "F" },
          { chain: "D", resNum: 88, code: "L" },
        ],
        citation: "harrington-1997-hbs",
      },
    ],
    caveats: [
      {
        subject: "No folding animation",
        text:
          "Shown in its native state only. At 1,148 residues a folding trajectory does " +
          "not fit the frame budget — and the lesson here is the contact between " +
          "molecules, not the folding of one.",
      },
      {
        subject: "A crystal, not a fibre",
        text:
          "This is two tetramers in a crystal lattice. The real polymer is a helical " +
          "fourteen-strand fibre; what the crystal preserves is the contact that builds " +
          "it, not the whole assembly.",
      },
    ],
    citations: ["harrington-1997-hbs"],
  },

  // ── Cystic fibrosis ─────────────────────────────────────────────────────
  {
    id: "nbd1-wt",
    story: "cystic-fibrosis",
    name: "CFTR NBD1",
    tagline: "The domain that fails to fold in most cystic fibrosis",
    role: "wild-type",
    summary: {
      lay: "One part of the CFTR gate, with all its building blocks present. This is the piece that goes wrong.",
      student: "The first nucleotide-binding domain of human CFTR, with ATP and magnesium bound. Phe508 sits on its surface — not in the ATP site, not in the pore.",
      researcher: "Human NBD1 with Phe508 present, the structural comparator for the Phe508del construct alongside it.",
    },
    keyFact: "Phe508 is on the surface, far from anything catalytic. It matters because of what it touches, not what it does.",
    annotations: [
      {
        id: "phe508",
        label: "Phe508 — present",
        description:
          "The phenylalanine deleted in roughly seven out of ten cystic fibrosis alleles " +
          "worldwide. It sits on the domain's surface, where it both stabilises NBD1's own " +
          "fold and forms part of the interface with the fourth intracellular loop of the " +
          "membrane domain.",
        residues: [{ chain: "A", resNum: 508, code: "F" }],
        citation: "lewis-2005-nbd1",
      },
      {
        id: "walker-a",
        label: "Walker A motif — GSTGAGKT",
        description:
          "The phosphate-binding loop that grips ATP, running 458 to 465. Lys464 is the " +
          "catalytic lysine that contacts the nucleotide's phosphates. All of it is intact " +
          "in Phe508del: the deletion does not touch the nucleotide machinery, which is " +
          "exactly why the channel would work if it ever reached the membrane.",
        residues: [
          { chain: "A", resNum: 458, code: "G" },
          { chain: "A", resNum: 464, code: "K" },
        ],
      },
    ],
    caveats: [
      {
        subject: "Missing residues",
        text:
          "Around 34 residues of this construct were never resolved, including most of the " +
          "regulatory insertion (roughly 405–435). They are not missing from the protein — " +
          "they are disordered, which is part of why NBD1 is difficult to study.",
      },
    ],
    citations: ["lewis-2005-nbd1"],
  },
  {
    id: "nbd1-df508",
    story: "cystic-fibrosis",
    name: "CFTR NBD1 ΔF508",
    tagline: "The same domain, one residue short",
    role: "variant",
    summary: {
      lay: "The same part of the gate with one building block missing. The shape it should form is now harder to reach, so the cell throws it away.",
      student: "Phe508del NBD1. The fold is broadly preserved in the crystal, which is the point: the defect is thermodynamic and kinetic, not a gross structural collapse. Less stable, folds more slowly, and presents a damaged interface for the rest of the protein to dock against.",
      researcher: "Crystallised with solubilising substitutions. The deletion reduces NBD1 stability and disrupts NBD1–ICL4 assembly; both contribute, and correctors address them to differing degrees.",
    },
    keyFact: "The channel would work. The cell never lets it get there — ER quality control degrades it before it reaches the membrane.",
    annotations: [
      {
        id: "deletion-site",
        label: "Where Phe508 was",
        description:
          "Numbering skips 508 here: the residue is simply absent, and its neighbours have " +
          "closed the gap. Compare the same position in the wild-type domain.",
        residues: [
          { chain: "A", resNum: 507, code: "I" },
          { chain: "A", resNum: 509, code: "G" },
        ],
        citation: "lewis-2005-nbd1",
      },
    ],
    caveats: [
      {
        subject: "Solubilising mutations",
        text:
          "This construct carries three solubilising substitutions, introduced solely to " +
          "make Phe508del NBD1 crystallisable at all. Differences from the wild-type " +
          "domain beside it are therefore not attributable to the deletion alone.",
      },
    ],
    citations: ["lewis-2005-nbd1", "middleton-2019-trikafta"],
  },
  {
    id: "cftr-full",
    story: "cystic-fibrosis",
    name: "CFTR, full length",
    tagline: "Where that one domain sits in the whole channel",
    role: "context",
    summary: {
      lay: "The complete gate, so you can see how small the broken piece is compared with the whole thing.",
      student: "Phosphorylated, ATP-bound human CFTR by cryo-electron microscopy. NBD1 is one of five domains; Phe508's interface partner, ICL4, reaches across from the second membrane domain.",
      researcher: "The assembled channel, showing the NBD1–ICL4 interface that Phe508del disrupts and that isolated NBD1 structures cannot show.",
    },
    keyFact: "Around 270 residues are unresolved, most of them the regulatory (R) domain — intrinsically disordered, and only ordered enough to see once phosphorylated.",
    annotations: [
      {
        id: "phe508-in-context",
        label: "Phe508, in the assembled channel",
        description:
          "The same residue, now visible against the membrane domain it helps hold. This " +
          "is the interface an isolated NBD1 structure cannot show you.",
        residues: [{ chain: "A", resNum: 508, code: "F" }],
        citation: "zhang-2018-cftr",
      },
    ],
    caveats: [
      {
        subject: "Cryo-EM at 3.2 Å",
        text:
          "Side-chain positions are far less certain here than in the crystal structures " +
          "beside it. Treat the backbone as reliable and individual side chains as " +
          "indicative.",
      },
      {
        subject: "No folding animation",
        text:
          "At about 1,500 residues this is shown folded only. A trajectory for it does not " +
          "fit the frame budget.",
      },
    ],
    citations: ["zhang-2018-cftr"],
  },

  // ── Imatinib ────────────────────────────────────────────────────────────
  {
    id: "abl-imatinib",
    story: "imatinib",
    name: "ABL kinase + imatinib",
    tagline: "The drug that turned a fatal leukaemia into a manageable one",
    role: "wild-type",
    summary: {
      lay: "A stuck-on switch that drives a leukaemia, with the drug that jams it sitting in place.",
      student: "The ABL kinase domain with imatinib bound in the inactive DFG-out conformation. Binding the inactive state is what gives imatinib its selectivity: most kinases look alike when active and differ when off.",
      researcher: "Nagar's structure of the imatinib complex, the template for every subsequent analysis of BCR-ABL resistance.",
    },
    keyFact: "Imatinib binds the kinase switched off, not switched on — which is where its selectivity comes from.",
    annotations: [
      {
        id: "thr315",
        label: "Thr315 — the gatekeeper",
        description:
          "This residue's side-chain hydroxyl donates a hydrogen bond to imatinib, and its " +
          "small size leaves the entrance to the hydrophobic back pocket open. Substituting " +
          "isoleucine removes the hydroxyl and blocks the entrance at the same time.",
        residues: [{ chain: "A", resNum: 315, code: "T" }],
        citation: "gorre-2001-resistance",
      },
      {
        id: "dfg",
        label: "The DFG motif",
        description:
          "Asp381–Phe382–Gly383. Its position defines whether the kinase is active or not, " +
          "and imatinib only fits when the phenylalanine has swung out of the pocket.",
        residues: [
          { chain: "A", resNum: 381, code: "D" },
          { chain: "A", resNum: 382, code: "F" },
          { chain: "A", resNum: 383, code: "G" },
        ],
        citation: "nagar-2002-imatinib",
      },
    ],
    caveats: [],
    citations: ["nagar-2002-imatinib", "gorre-2001-resistance"],
  },
  {
    id: "abl-t315i-ponatinib",
    story: "imatinib",
    name: "ABL T315I + ponatinib",
    tagline: "A drug designed around a known resistance mutation",
    role: "resistance",
    summary: {
      lay: "The same switch, changed just enough that the original drug no longer fits — and a newer drug shaped to get past the obstruction.",
      student: "T315I ABL with ponatinib. There is no structure of imatinib bound to T315I, because it does not bind. Ponatinib carries a carbon–carbon triple bond linker whose narrow profile threads past the enlarged gatekeeper.",
      researcher: "O'Hare's structure, the clearest published example of structure-guided design against a named clinical resistance mechanism.",
    },
    keyFact: "The absence of an imatinib–T315I structure is itself the lesson: you cannot crystallise a complex that does not form.",
    annotations: [
      {
        id: "ile315",
        label: "Ile315 — the substitution",
        description:
          "Threonine replaced by isoleucine. Two effects at once: the hydrogen-bond donor " +
          "is gone, and the bulkier side chain occludes the back pocket. That combination " +
          "defeats imatinib, dasatinib and nilotinib together.",
        residues: [{ chain: "A", resNum: 315, code: "I" }],
        citation: "ohare-2009-ponatinib",
      },
    ],
    caveats: [],
    citations: ["ohare-2009-ponatinib", "gorre-2001-resistance"],
  },

  // ── Nirmatrelvir ────────────────────────────────────────────────────────
  {
    id: "mpro-nirmatrelvir",
    story: "nirmatrelvir",
    name: "SARS-CoV-2 Mpro + nirmatrelvir",
    tagline: "A reversible covalent bond to the catalytic cysteine",
    role: "wild-type",
    summary: {
      lay: "The scissors a coronavirus uses to cut its own proteins into working pieces, with the drug that blocks them.",
      student: "The main protease at 1.59 Å with nirmatrelvir bound. The catalytic machinery is a cysteine–histidine dyad, not the serine protease triad you might expect, and the drug's nitrile warhead engages the cysteine directly.",
      researcher: "The nitrile forms a reversible thioimidate with Cys145, giving covalent potency without an irreversible inhibitor's liability profile.",
    },
    keyFact: "Ritonavir in the same tablet has no antiviral effect here at all — it inhibits CYP3A4 to stop nirmatrelvir being cleared too fast, and that is where Paxlovid's long interaction list comes from.",
    annotations: [
      {
        id: "cys145",
        label: "Cys145 — the nucleophile",
        description:
          "The catalytic cysteine. Nirmatrelvir's nitrile forms a reversible covalent bond " +
          "to this sulfur, which is what makes the drug potent enough to work orally.",
        residues: [{ chain: "A", resNum: 145, code: "C" }],
        citation: "owen-2021-nirmatrelvir",
      },
      {
        id: "his41",
        label: "His41 — the base",
        description:
          "The other half of the catalytic dyad. It deprotonates the cysteine, making it " +
          "nucleophilic enough to attack the substrate — and reactive enough to be a drug " +
          "target.",
        residues: [{ chain: "A", resNum: 41, code: "H" }],
        citation: "zhang-2020-mpro",
      },
    ],
    caveats: [
      {
        subject: "One protomer",
        text:
          "This file contains a single protomer. Mpro is an obligate homodimer and the " +
          "active site is only complete once the partner's N-terminal finger is in place — " +
          "see the dimer alongside.",
      },
    ],
    citations: ["owen-2021-nirmatrelvir", "zhang-2020-mpro"],
  },
  {
    id: "mpro-dimer",
    story: "nirmatrelvir",
    name: "Mpro dimer",
    tagline: "Why a single copy of this enzyme cannot work",
    role: "context",
    summary: {
      lay: "The same scissors, but as the pair they have to be. Each half completes the other.",
      student: "The biological dimer with nirmatrelvir in both sites. The N-terminal finger of each protomer reaches across and completes the substrate-binding site of the other, so a monomer is catalytically dead.",
      researcher: "Shown so the N-finger contribution is visible rather than asserted — a point that matters for any attempt at dimerisation-interface inhibition.",
    },
    keyFact: "The monomer is inactive. Each protomer's first few residues complete its partner's substrate site, which makes dimerisation itself a potential drug target.",
    annotations: [
      {
        id: "n-finger",
        label: "The N-terminal finger",
        description:
          "The first residues of one protomer reach into its partner and shape the pocket " +
          "that binds substrate. Cut them off and the enzyme is dead even though both " +
          "catalytic residues are intact.",
        residues: [{ chain: "A", resNum: 1, code: "S" }],
        citation: "zhang-2020-mpro",
      },
    ],
    caveats: [
      {
        subject: "No folding animation",
        text:
          "Shown folded only. The point of this entry is the interface between two chains, " +
          "which a folding trajectory of each separately would not illuminate.",
      },
    ],
    citations: ["zhang-2020-mpro"],
  },
];

const byId = new Map(STRUCTURE_CONTENT.map((entry) => [entry.id, entry]));

export function structureContent(id: string): StructureContent | undefined {
  return byId.get(id);
}
