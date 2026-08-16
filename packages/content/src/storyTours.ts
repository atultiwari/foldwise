/**
 * The story tours.
 *
 * Each walks a reader through one clinical mechanism, driving the application
 * as it goes. Every residue named is verified against the structure file, so a
 * tour cannot quietly point at the wrong thing.
 *
 * Written to end where the clinic begins: the last beat of each tour connects
 * the structure to something a doctor actually does.
 */

import type { StoryTour } from "./tour.js";

export const STORY_TOURS: readonly StoryTour[] = [
  {
    id: "sickle-cell",
    title: "How one amino acid sickles a red cell",
    steps: [
      {
        id: "hba-whole",
        title: "Start with normal haemoglobin",
        anchor: { kind: "element", selector: ".stage" },
        view: { structure: "hba-deoxy", progress: 1, color: "chain" },
        placement: "left",
        copy: {
          lay: "Four subunits, working as one. Each carries an iron-containing haem, and each haem carries one oxygen molecule.",
          student: "Deoxyhaemoglobin A: two α and two β chains in the tense state. Coloured by chain so the two matching pairs are visible.",
          researcher: "The T-state tetramer. Note the α1β1 and α1β2 interfaces — the latter is where the allosteric transition happens.",
        },
      },
      {
        id: "beta6-normal",
        title: "This is position β6",
        anchor: { kind: "residue", chain: "B", resNum: 6, code: "E" },
        view: { structure: "hba-deoxy", progress: 1, color: "charge" },
        placement: "right",
        copy: {
          lay: "A single building block near the outside of one subunit. In healthy haemoglobin it is glutamate, which carries a charge and is perfectly happy sitting in water.",
          student: "Glutamate at β6, on the molecular surface. Coloured by charge you can see it is one of the negative residues — exactly what you want facing solvent.",
          researcher: "βGlu6, surface-exposed on the A helix. Clinically written β6; HGVS counts the initiator methionine and writes p.Glu7Val.",
        },
      },
      {
        id: "pocket-empty",
        title: "And here is a pocket that stays empty",
        anchor: { kind: "residue", chain: "B", resNum: 85, code: "F" },
        view: { structure: "hba-deoxy", progress: 1, color: "hydropathy" },
        placement: "right",
        copy: {
          lay: "Phe85 and Leu88 line a greasy dip on the surface. In healthy haemoglobin nothing ever sits in it.",
          student: "A hydrophobic pocket formed by Phe85 and Leu88. Coloured by hydropathy it stands out as an orange patch on an otherwise water-friendly surface.",
          researcher: "The acceptor pocket. It exists in HbA too — what is missing is anything with the right shape to occupy it.",
        },
      },
      {
        id: "hbs-switch",
        title: "Now the sickle version",
        anchor: { kind: "element", selector: ".chip" },
        view: { structure: "hbs-deoxy", progress: 1, color: "chain" },
        placement: "below",
        copy: {
          lay: "The same protein from someone with sickle cell disease. The crystal caught two whole molecules touching each other.",
          student: "Deoxy-HbS. Eight chains: two complete tetramers, and the contact between them is the polymer contact itself.",
          researcher: "Two tetramers in the asymmetric unit, preserving the lateral contact that propagates the fibre.",
        },
      },
      {
        id: "val6",
        title: "One letter has changed",
        anchor: { kind: "residue", chain: "B", resNum: 6, code: "V" },
        view: { structure: "hbs-deoxy", progress: 1, color: "hydropathy" },
        placement: "right",
        copy: {
          lay: "Glutamate has become valine. Charged has become greasy — on a surface that faces water, which is the worst place for it.",
          student: "βGlu6Val. Nothing about the oxygen-binding site has changed; this residue is nowhere near the haem. The protein still carries oxygen perfectly well.",
          researcher: "A single surface substitution. Oxygen affinity and cooperativity are near-normal — the pathology is entirely intermolecular.",
        },
      },
      {
        id: "docking",
        title: "And it finds the pocket on its neighbour",
        anchor: { kind: "residue", chain: "D", resNum: 85, code: "F" },
        view: { structure: "hbs-deoxy", progress: 1, color: "hydropathy" },
        placement: "right",
        copy: {
          lay: "The greasy valine of one molecule tucks into the greasy pocket of the next. Do that a few million times and you have a stiff rod running the length of the cell.",
          student: "Val6 of one tetramer inserts into the Phe85/Leu88 pocket of an adjacent one. Repeated, this builds a fibre that deforms the red cell into a sickle.",
          researcher: "The lateral contact. Fibre growth is strongly concentration-dependent with a long delay time, which is the kinetic window therapy exploits.",
        },
      },
      {
        id: "deoxy-only",
        title: "Why crises come and go",
        anchor: { kind: "element", selector: ".transport" },
        view: { structure: "hbs-deoxy", progress: 1 },
        placement: "above",
        copy: {
          lay: "The pocket only opens when haemoglobin has given up its oxygen. With oxygen on board, sickle haemoglobin behaves almost normally — which is why crises come on when the body is short of oxygen.",
          student: "The acceptor pocket is present only in the deoxy (T) state. Hence the classic precipitants: hypoxia, dehydration, acidosis, cold, infection — anything that increases the deoxygenated fraction.",
          researcher: "Polymerisation is deoxy-specific and delay-time dependent. Agents that raise HbF, or shift the allosteric equilibrium toward R state, interrupt it.",
        },
      },
    ],
  },

  {
    id: "cystic-fibrosis",
    title: "Why ΔF508 breaks a channel that would work",
    steps: [
      {
        id: "nbd1",
        title: "One domain out of five",
        anchor: { kind: "element", selector: ".stage" },
        view: { structure: "nbd1-wt", progress: 1, color: "structure" },
        placement: "left",
        copy: {
          lay: "This is a piece of the CFTR gate — the part that binds the cell's fuel molecule, ATP.",
          student: "The first nucleotide-binding domain of CFTR. A mixed α/β fold, which is what an ABC transporter's nucleotide domain looks like.",
          researcher: "Human NBD1 with ATP and magnesium bound, the domain in which the commonest CF allele exerts its primary effect.",
        },
      },
      {
        id: "phe508",
        title: "Here is Phe508",
        anchor: { kind: "residue", chain: "A", resNum: 508, code: "F" },
        view: { structure: "nbd1-wt", progress: 1, color: "burial" },
        placement: "right",
        copy: {
          lay: "The building block missing in most people with cystic fibrosis. Notice where it is — on the outside, not buried in the middle.",
          student: "Phe508 sits on the domain surface. Coloured by burial you can see it is exposed, not part of the hydrophobic core. It matters because of what it touches.",
          researcher: "Surface-exposed on NBD1, contributing both to NBD1's own folding kinetics and to the interface with ICL4 of the second membrane domain.",
        },
      },
      {
        id: "walker",
        title: "The ATP site is somewhere else entirely",
        anchor: { kind: "residue", chain: "A", resNum: 464, code: "K" },
        view: { structure: "nbd1-wt", progress: 1, color: "structure" },
        placement: "right",
        copy: {
          lay: "This is where ATP binds — a long way from the missing piece. Remember that: the machinery is untouched.",
          student: "Lys464, the catalytic lysine of the Walker A motif. Phe508 is nowhere near it, which is why the channel's chemistry is intact in ΔF508.",
          researcher: "Walker A GSTGAGKT, residues 458–465. Nucleotide binding and hydrolysis are preserved in Phe508del.",
        },
      },
      {
        id: "df508",
        title: "Now the ΔF508 version",
        anchor: { kind: "residue", chain: "A", resNum: 507, code: "I" },
        view: { structure: "nbd1-df508", progress: 1, color: "burial" },
        placement: "right",
        copy: {
          lay: "The same domain with that one piece removed. The numbering jumps straight from 507 to 509.",
          student: "Phe508del. The residue is simply absent and its neighbours have closed the gap. Look at the overall shape compared with the previous structure.",
          researcher: "The fold is broadly preserved in the crystal — the defect is thermodynamic and kinetic rather than a gross structural collapse.",
        },
      },
      {
        id: "same-shape",
        title: "The lesson is what has *not* changed",
        anchor: { kind: "element", selector: ".stats" },
        view: { structure: "nbd1-df508", progress: 1, color: "structure" },
        placement: "left",
        copy: {
          lay: "The shape is almost the same. The ATP site is fine. This channel would work — the cell simply never lets it get to the surface, because it folds too slowly and gets thrown away.",
          student: "A class II defect: folding and trafficking, not function. Misfolded CFTR is caught by ER quality control and degraded, so almost none reaches the apical membrane.",
          researcher: "Reduced NBD1 stability plus disrupted NBD1–ICL4 assembly. Both contribute, and they are separable — which is what makes combination correction rational.",
        },
      },
      {
        id: "context",
        title: "What that surface was holding",
        anchor: { kind: "residue", chain: "A", resNum: 508, code: "F" },
        view: { structure: "cftr-full", progress: 1, color: "chain" },
        placement: "right",
        copy: {
          lay: "In the whole channel you can see what Phe508 was touching: a loop reaching across from the part that sits in the membrane.",
          student: "Full-length CFTR. Phe508 forms part of the interface with ICL4 — a contact an isolated NBD1 structure cannot show you.",
          researcher: "The assembled channel. The NBD1–ICL4 interface is the second half of the Phe508del defect and the target of the corrector class.",
        },
      },
      {
        id: "drugs",
        title: "Which is why correctors exist",
        anchor: { kind: "element", selector: ".story" },
        view: { structure: "cftr-full", progress: 1 },
        placement: "right",
        copy: {
          lay: "Drugs called correctors help the protein fold properly so it reaches the surface. A different drug, a potentiator, opens the gate once it is there — useless on its own if nothing arrived.",
          student: "Correctors (lumacaftor, tezacaftor, elexacaftor) address folding and trafficking; potentiators (ivacaftor) address gating. ΔF508 needs correction first, which is why triple therapy pairs them.",
          researcher: "Elexacaftor and tezacaftor act at distinct sites, giving additive correction; ivacaftor then addresses the residual gating defect of rescued protein.",
        },
      },
    ],
  },

  {
    id: "imatinib",
    title: "How one substitution defeats a drug",
    steps: [
      {
        id: "kinase",
        title: "A kinase, switched off",
        anchor: { kind: "element", selector: ".stage" },
        view: { structure: "abl-imatinib", progress: 1, color: "structure" },
        placement: "left",
        copy: {
          lay: "This is the switch that drives chronic myeloid leukaemia, with the drug that jams it already in place.",
          student: "The ABL kinase domain. Two lobes: a β-rich N-lobe above, an α-rich C-lobe below, with the drug in the cleft between them.",
          researcher: "The imatinib complex in the DFG-out inactive conformation — the source of the drug's selectivity, since active kinases resemble one another far more than inactive ones do.",
        },
      },
      {
        id: "dfg",
        title: "The motif that decides on or off",
        anchor: { kind: "residue", chain: "A", resNum: 382, code: "F" },
        view: { structure: "abl-imatinib", progress: 1, color: "structure" },
        placement: "right",
        copy: {
          lay: "Three building blocks act as the switch itself. Their position decides whether the kinase is working or idle.",
          student: "Asp381–Phe382–Gly383. With the phenylalanine swung out of the pocket, the kinase is inactive — and only then does imatinib fit.",
          researcher: "DFG-out. Imatinib's selectivity derives from occupying the hydrophobic pocket vacated by Phe382, which is inaccessible in the active conformation.",
        },
      },
      {
        id: "thr315",
        title: "The gatekeeper",
        anchor: { kind: "residue", chain: "A", resNum: 315, code: "T" },
        view: { structure: "abl-imatinib", progress: 1, color: "hydropathy" },
        placement: "right",
        copy: {
          lay: "One small building block guards the way into a pocket behind the drug. It is small, so the way is open — and it grips the drug with a chemical handshake.",
          student: "Thr315. Its hydroxyl donates a hydrogen bond to imatinib, and its small side chain leaves the entrance to the back pocket clear. Two contributions from one residue.",
          researcher: "The gatekeeper. Hydrogen bonds to the anilino NH of imatinib and sets the steric aperture of the hydrophobic back pocket.",
        },
      },
      {
        id: "t315i",
        title: "Change it to isoleucine",
        anchor: { kind: "residue", chain: "A", resNum: 315, code: "I" },
        view: { structure: "abl-t315i-ponatinib", progress: 1, color: "hydropathy" },
        placement: "right",
        copy: {
          lay: "Now the guard is bigger, and it has lost the part that gripped the drug. Two problems at once — the drug cannot reach in, and could not hold on if it did.",
          student: "T315I. The hydroxyl is gone, so the hydrogen bond is lost; and isoleucine is bulkier, so the entrance is blocked. This one substitution defeats imatinib, dasatinib and nilotinib together.",
          researcher: "Simultaneous loss of a hydrogen-bond donor and steric occlusion. It accounts for a substantial share of clinical resistance and was for years untreatable.",
        },
      },
      {
        id: "no-structure",
        title: "Notice which drug is bound",
        anchor: { kind: "element", selector: ".chip" },
        view: { structure: "abl-t315i-ponatinib", progress: 1, color: "structure" },
        placement: "below",
        copy: {
          lay: "This is not imatinib. There is no picture anywhere of imatinib stuck to this mutant, because it does not stick — you cannot photograph something that never happens.",
          student: "There is no crystal structure of imatinib bound to T315I. The absence is the finding: the complex does not form.",
          researcher: "No imatinib–T315I complex has been solved, consistent with the loss of measurable binding rather than merely reduced affinity.",
        },
      },
      {
        id: "ponatinib",
        title: "So a drug was designed around it",
        anchor: { kind: "element", selector: ".story" },
        view: { structure: "abl-t315i-ponatinib", progress: 1, color: "structure" },
        placement: "right",
        copy: {
          lay: "Ponatinib was built with a narrow, rigid link in the middle, thin enough to slide past the enlarged guard. The obstacle was known, and the molecule was shaped for it.",
          student: "Ponatinib carries a carbon–carbon triple bond linker whose slim profile passes the bulky isoleucine. It is the clearest example in oncology of designing against a named resistance mutation.",
          researcher: "The alkyne linker accommodates the Ile315 side chain sterically while preserving DFG-out binding — structure-guided design against a defined clinical mechanism.",
        },
      },
    ],
  },

  {
    id: "nirmatrelvir",
    title: "Blocking a virus's own scissors",
    steps: [
      {
        id: "mpro",
        title: "The enzyme a coronavirus cannot do without",
        anchor: { kind: "element", selector: ".stage" },
        view: { structure: "mpro-nirmatrelvir", progress: 1, color: "structure" },
        placement: "left",
        copy: {
          lay: "A coronavirus builds its proteins as one long chain, then cuts them apart. These are the scissors.",
          student: "SARS-CoV-2 main protease. Two β-barrels side by side with a helical third domain behind — it cleaves the viral polyprotein at eleven sites.",
          researcher: "Mpro (3CLpro, nsp5). Essential for replication and with no close human homologue, which is what makes it a clean target.",
        },
      },
      {
        id: "cys145",
        title: "The blade",
        anchor: { kind: "residue", chain: "A", resNum: 145, code: "C" },
        view: { structure: "mpro-nirmatrelvir", progress: 1, color: "hydropathy" },
        placement: "right",
        copy: {
          lay: "One sulphur-containing building block does the actual cutting.",
          student: "Cys145. Almost every protease you have met — trypsin, chymotrypsin, thrombin — uses a serine here. This one is a cysteine, and that difference is what the drug exploits.",
          researcher: "The catalytic nucleophile of a cysteine protease. Its thiolate is far more nucleophilic than a serine hydroxyl, and correspondingly easier to engage covalently.",
        },
      },
      {
        id: "his41",
        title: "And the hand that sharpens it",
        anchor: { kind: "residue", chain: "A", resNum: 41, code: "H" },
        view: { structure: "mpro-nirmatrelvir", progress: 1, color: "charge" },
        placement: "right",
        copy: {
          lay: "A second building block sits next to the first and makes it reactive enough to cut. Two working together, not three as you might expect.",
          student: "His41. A catalytic dyad, not the serine protease triad — there is no third residue orienting the histidine here.",
          researcher: "The Cys145–His41 dyad. His41 deprotonates the cysteine to generate the attacking thiolate.",
        },
      },
      {
        id: "warhead",
        title: "The drug bonds to the blade",
        anchor: { kind: "residue", chain: "A", resNum: 145, code: "C" },
        view: { structure: "mpro-nirmatrelvir", progress: 1, color: "structure" },
        placement: "right",
        copy: {
          lay: "Nirmatrelvir does not just sit in the way — one end of it forms an actual chemical bond with the cutting blade. But the bond can come undone again, which makes it safer than one that cannot.",
          student: "The nitrile warhead forms a reversible covalent bond with Cys145. Reversibility gives covalent potency without an irreversible inhibitor's liabilities.",
          researcher: "A reversible thioimidate adduct. Covalent reversibility improves the therapeutic window relative to irreversible warheads.",
        },
      },
      {
        id: "dimer",
        title: "One copy is useless",
        anchor: { kind: "residue", chain: "A", resNum: 1, code: "S" },
        view: { structure: "mpro-dimer", progress: 1, color: "chain" },
        placement: "right",
        copy: {
          lay: "The scissors only work as a pair. The first few building blocks of each copy reach across and complete the other one's cutting site.",
          student: "Mpro is an obligate homodimer. The N-terminal finger of one protomer shapes the substrate site of the other, so a monomer is catalytically dead despite having both catalytic residues.",
          researcher: "The N-finger inserts into the partner's S1 subsite. Dimerisation is therefore itself a druggable interface.",
        },
      },
      {
        id: "ritonavir",
        title: "And why there are two tablets",
        anchor: { kind: "element", selector: ".story" },
        view: { structure: "mpro-dimer", progress: 1 },
        placement: "right",
        copy: {
          lay: "Paxlovid contains a second drug, ritonavir, which does nothing to the virus at all. It stops the liver clearing the first drug too quickly — which is also why the pack carries such a long list of drug interactions.",
          student: "Ritonavir has no antiviral activity here. It is a CYP3A4 inhibitor used purely as a pharmacokinetic booster, and that inhibition is the source of Paxlovid's extensive interaction profile.",
          researcher: "Ritonavir boosting maintains nirmatrelvir exposure above target. The consequent CYP3A4 inhibition drives the interaction burden, which is often the limiting factor in prescribing.",
        },
      },
    ],
  },
];

const byId = new Map(STORY_TOURS.map((tour) => [tour.id, tour]));

export function storyTour(id: string): StoryTour | undefined {
  return byId.get(id);
}
