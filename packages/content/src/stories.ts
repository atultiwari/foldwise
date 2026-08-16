/**
 * The four clinical stories.
 *
 * Each answers a question a clinician actually asks, and uses folding as the
 * mechanism rather than as the subject. That ordering is the whole point: a
 * reader arrives asking about sickle cell, not about β-grasp topology.
 */

import type { Story } from "./schema.js";

export const STORIES: readonly Story[] = [
  {
    id: "sickle-cell",
    title: "Sickle cell disease",
    question: "How does changing one amino acid out of 574 turn a red cell into a sickle?",
    summary: {
      lay:
        "Haemoglobin is the protein that carries oxygen around your body. In sickle cell " +
        "disease a single building block of it is swapped for a different one. That swap " +
        "puts a greasy patch on the outside of a molecule that used to be smooth, and " +
        "greasy patches stick together. Millions of molecules line up into stiff rods, the " +
        "red cell is forced out of shape, and it jams in small blood vessels.",
      student:
        "HbS carries a single substitution in the β-globin chain: glutamate to valine at " +
        "position 6. Glutamate is charged and faces the solvent happily; valine is " +
        "hydrophobic and does not. On deoxygenation, that valine docks into a hydrophobic " +
        "pocket on the β chain of an adjacent tetramer, and the tetramers polymerise into " +
        "fibres that deform the cell. Crucially the pocket only opens in the deoxy (T) " +
        "state — which is why hypoxia, acidosis and dehydration precipitate crises, and why " +
        "oxygenated HbS behaves almost normally.",
      researcher:
        "The βE6V substitution creates an intermolecular contact between the mutant valine " +
        "and an acceptor pocket on a neighbouring tetramer, present only in the deoxy " +
        "quaternary state. Polymerisation is strongly concentration- and delay-time " +
        "dependent, which is the pharmacological opening exploited by HbF induction and by " +
        "agents that shift the allosteric equilibrium toward R state.",
    },
    structures: ["hba-deoxy", "hbs-deoxy"],
    objectives: [
      "Explain why a surface substitution, not an active-site one, causes disease",
      "Relate the deoxy-specific acceptor pocket to the clinical triggers of a crisis",
      "Predict why fetal haemoglobin interrupts polymerisation",
    ],
    citations: ["ingram-1957-sickle", "harrington-1997-hbs", "fermi-1984-deoxyhb"],
  },

  {
    id: "cystic-fibrosis",
    title: "Cystic fibrosis and ΔF508",
    question: "Why does the commonest CF mutation break a channel that would work perfectly well?",
    summary: {
      lay:
        "CFTR is a gate in the surface of cells that lets salt out, and water follows it. " +
        "In most people with cystic fibrosis, one building block is missing from the gate's " +
        "instructions. The gate itself would still work — but the cell cannot fold it into " +
        "the right shape, decides it is faulty, and destroys it before it ever reaches the " +
        "surface. The problem is manufacturing, not design.",
      student:
        "Phe508del is a class II defect: a folding and trafficking failure rather than a " +
        "loss of channel function. The deleted phenylalanine sits on the surface of the " +
        "first nucleotide-binding domain, and its loss destabilises NBD1's own fold and " +
        "disrupts the interface NBD1 makes with the fourth intracellular loop of the second " +
        "membrane domain. Misfolded CFTR is recognised by ER quality control and degraded, " +
        "so almost none reaches the apical membrane. This is why correctors, which help it " +
        "fold, are the relevant class of drug — and why a potentiator alone does nothing " +
        "for a protein that is not there.",
      researcher:
        "Phe508del produces coupled defects: reduced NBD1 thermodynamic stability, impaired " +
        "NBD1–ICL4 domain assembly, and residual gating and stability abnormalities even " +
        "once trafficking is rescued. That the defects are separable is what makes " +
        "combination correction pharmacologically rational rather than merely additive.",
    },
    structures: ["nbd1-wt", "nbd1-df508", "cftr-full"],
    objectives: [
      "Distinguish a folding defect from a functional defect, and say why the distinction changes the drug",
      "Locate Phe508 on the domain surface and explain what it contacts",
      "Explain why correctors and potentiators address different problems",
    ],
    citations: ["lewis-2005-nbd1", "zhang-2018-cftr", "middleton-2019-trikafta"],
  },

  {
    id: "imatinib",
    title: "Imatinib and the gatekeeper",
    question: "Why does one further substitution make a drug that transformed a leukaemia stop working?",
    summary: {
      lay:
        "Chronic myeloid leukaemia is driven by a broken switch that is stuck on. Imatinib " +
        "was the first drug designed to jam that specific switch, and it turned a fatal " +
        "illness into a manageable one. But the switch can change shape slightly. One such " +
        "change swaps a small part for a bulkier one, the drug no longer fits, and the " +
        "leukaemia returns.",
      student:
        "Imatinib binds BCR-ABL in its inactive, DFG-out conformation, which is what gives " +
        "it selectivity — most kinases are targeted in the active state. Thr315, the " +
        "gatekeeper residue, contributes a hydrogen bond to the drug and its small side " +
        "chain leaves the entrance to the back pocket open. The T315I substitution does two " +
        "things at once: it removes the hydroxyl that made the hydrogen bond, and it " +
        "substitutes a bulkier isoleucine that blocks the entrance. This is why T315I is " +
        "resistant to imatinib, dasatinib and nilotinib together, and why it needed a drug " +
        "designed around it.",
      researcher:
        "T315I is the canonical gatekeeper resistance substitution: simultaneous loss of a " +
        "hydrogen-bond donor and steric occlusion of the hydrophobic back pocket. Ponatinib " +
        "was designed with a carbon–carbon triple bond linker whose narrow profile passes " +
        "the enlarged gatekeeper, the clearest example in oncology of structure-guided " +
        "design against a named resistance mechanism.",
    },
    structures: ["abl-imatinib", "abl-t315i-ponatinib"],
    objectives: [
      "Explain why binding an inactive kinase conformation confers selectivity",
      "Describe the two independent effects of the T315I substitution",
      "Explain how ponatinib's linker was designed around a known resistance mutation",
    ],
    citations: ["nagar-2002-imatinib", "gorre-2001-resistance", "ohare-2009-ponatinib"],
  },

  {
    id: "nirmatrelvir",
    title: "Nirmatrelvir and the viral protease",
    question: "How do you design a drug against an enzyme that must cut itself free to exist?",
    summary: {
      lay:
        "A coronavirus makes its proteins as one long chain that has to be cut into working " +
        "pieces. The scissors that do the cutting are made by the virus itself. " +
        "Nirmatrelvir is a shaped block that sits in the scissors and grips their cutting " +
        "edge, so nothing gets cut and no new virus can be assembled.",
      student:
        "The SARS-CoV-2 main protease cleaves the viral polyprotein at eleven sites and is " +
        "essential for replication. Its catalytic machinery is a cysteine–histidine dyad " +
        "rather than the serine protease triad you may expect. Nirmatrelvir carries a " +
        "nitrile warhead that forms a reversible covalent bond with the catalytic cysteine. " +
        "It is co-formulated with ritonavir, which has no antiviral activity here at all — " +
        "ritonavir inhibits CYP3A4 and is present purely to stop nirmatrelvir being " +
        "metabolised too fast. That is also the source of Paxlovid's long interaction list.",
      researcher:
        "Mpro is an obligate homodimer: the N-terminal finger of one protomer completes the " +
        "substrate-binding site of the other, so the monomer is catalytically inactive. " +
        "Nirmatrelvir's nitrile forms a reversible thioimidate with the catalytic cysteine, " +
        "giving covalent potency without the irreversible-inhibitor liability profile.",
    },
    structures: ["mpro-nirmatrelvir", "mpro-dimer"],
    objectives: [
      "Identify the catalytic dyad and explain how a covalent warhead engages it",
      "Explain why the protease is only active as a dimer",
      "Explain why ritonavir is in the tablet despite having no antiviral effect here",
    ],
    citations: ["owen-2021-nirmatrelvir", "zhang-2020-mpro"],
  },
];

const byId = new Map(STORIES.map((story) => [story.id, story]));

export function story(id: string): Story | undefined {
  return byId.get(id);
}

export function storyForStructure(structureId: string): Story | undefined {
  return STORIES.find((s) => s.structures.includes(structureId));
}
