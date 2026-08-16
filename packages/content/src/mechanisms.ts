/**
 * The four mechanisms.
 *
 * Each is a causal chain the reader can interrogate by changing its variables.
 * The outcomes encode established biology; nothing is computed from physics,
 * and the interface says so.
 */

import type { LeveledText, Mechanism } from "./mechanism.js";

/** Shared because the same fact holds whichever haemoglobin is on screen. */
const POCKET_CLOSED: LeveledText = {
  lay: "With oxygen on board the molecule holds a different shape, and the greasy dip that valine would stick into is not open.",
  student: "In the R (oxygenated) state the Phe85/Leu88 acceptor pocket is not presented. Even HbS behaves near-normally when saturated.",
  researcher: "The acceptor site is a feature of the T-state quaternary arrangement; R-state HbS does not polymerise appreciably.",
};

export const MECHANISMS: readonly Mechanism[] = [
  // ── Sickle cell ─────────────────────────────────────────────────────────
  {
    id: "sickle-cell",
    title: "How one amino acid sickles a red cell",
    question: "Set the genotype and the oxygen tension. Watch what follows.",
    controls: [
      {
        id: "genotype",
        label: "Haemoglobin",
        initial: "hbs",
        options: [
          { value: "hba", label: "HbA", note: "Normal adult haemoglobin" },
          { value: "hbs", label: "HbS", note: "Homozygous sickle, βGlu6Val" },
          { value: "hbs-hbf", label: "HbS + high HbF", note: "As induced by hydroxyurea" },
        ],
      },
      {
        id: "oxygen",
        label: "Oxygen tension",
        initial: "low",
        options: [
          { value: "normal", label: "Normal", note: "Arterial, well oxygenated" },
          { value: "low", label: "Low", note: "Hypoxia, dehydration, acidosis, cold" },
        ],
      },
    ],
    stages: [
      {
        id: "gene",
        scale: "gene",
        title: "A single base in the β-globin gene",
        panel: { kind: "schematic", schematic: "codon" },
        outcomes: [
          {
            when: { genotype: "hba" },
            tone: "safe",
            state: "gag",
            headline: "Codon 6 reads GAG — glutamate",
            detail: {
              lay: "The instruction for building block number six spells out glutamate. Everything downstream follows from this one three-letter word.",
              student: "HBB codon 6 is GAG, encoding glutamate. This is the reference allele.",
              researcher: "HBB c.20A, codon 6 GAG. Reference allele; no substitution.",
            },
          },
          {
            when: {},
            tone: "harm",
            state: "gtg",
            headline: "Codon 6 reads GTG — valine",
            detail: {
              lay: "One letter of the instruction has changed, A to T. The sixth building block will now be valine instead of glutamate. That is the entire genetic difference.",
              student: "A single base substitution, GAG→GTG at codon 6 of HBB. Clinically written β6 Glu→Val; HGVS counts the initiator methionine and writes p.Glu7Val.",
              researcher: "HBB c.20A>T, p.Glu7Val (legacy βE6V). A missense substitution with no effect on transcript stability or splicing.",
            },
          },
        ],
      },
      {
        id: "protein",
        scale: "protein",
        title: "Which changes one residue on the surface",
        panel: {
          kind: "structure",
          structure: "hba-deoxy",
          focus: { chain: "B", resNum: 6, code: "E" },
          radius: 15,
          color: "hydropathy",
          emphasise: [
            { chain: "B", resNum: 6, code: "E" },
            { chain: "B", resNum: 85, code: "F" },
            { chain: "B", resNum: 88, code: "L" },
          ],
        },
        outcomes: [
          {
            when: { genotype: "hba" },
            tone: "safe",
            state: "glu",
            headline: "Glutamate sits happily in water",
            shows: {
              structure: "hba-deoxy",
              focus: { chain: "B", resNum: 6, code: "E" },
              emphasise: [{ chain: "B", resNum: 6, code: "E" }],
            },
            detail: {
              lay: "Glutamate carries a charge, and charged things are comfortable on a wet surface. Nothing sticks to it.",
              student: "βGlu6 is charged and solvent-exposed on the A helix. Note how far it is from the haem — oxygen binding is untouched either way.",
              researcher: "Surface-exposed on the A helix, remote from the haem pocket and from both subunit interfaces.",
            },
          },
          {
            when: {},
            tone: "harm",
            state: "val",
            headline: "Valine is greasy, and it is on the outside",
            shows: {
              structure: "hbs-deoxy",
              focus: { chain: "B", resNum: 6, code: "V" },
              emphasise: [{ chain: "B", resNum: 6, code: "V" }],
            },
            detail: {
              lay: "Valine hates water, and here it is sitting on a wet surface. It is a sticky patch in the wrong place.",
              student: "Charged becomes hydrophobic, on a solvent-exposed surface. Nothing about oxygen binding changes — the defect is entirely in what the molecule will now stick to.",
              researcher: "A hydrophobic residue at a solvent-exposed position, creating a donor site for an intermolecular contact.",
            },
          },
        ],
      },
      {
        id: "trigger",
        scale: "protein",
        title: "Deoxygenation opens the acceptor pocket",
        panel: {
          kind: "structure",
          structure: "hba-deoxy",
          focus: { chain: "B", resNum: 85, code: "F" },
          radius: 16,
          color: "hydropathy",
          emphasise: [
            { chain: "B", resNum: 85, code: "F" },
            { chain: "B", resNum: 88, code: "L" },
          ],
        },
        // Four outcomes rather than two, because the reader must keep looking
        // at the molecule they chose. The pocket itself is identical in HbA
        // and HbS — the substitution is on the other side of the chain — but
        // switching molecules under them would break the thread.
        outcomes: [
          {
            when: { genotype: "hba", oxygen: "normal" },
            tone: "safe", state: "closed",
            headline: "Oxygenated — the pocket is not available",
            shows: { structure: "hba-deoxy" },
            detail: POCKET_CLOSED,
          },
          {
            when: { oxygen: "normal" },
            tone: "safe", state: "closed",
            headline: "Oxygenated — the pocket is not available",
            shows: { structure: "hbs-deoxy" },
            detail: POCKET_CLOSED,
          },
          {
            when: { genotype: "hba" },
            tone: "safe", state: "open",
            headline: "The pocket opens — but nothing can dock in it",
            shows: { structure: "hba-deoxy" },
            detail: {
              lay: "The greasy dip opens in normal haemoglobin too. It stays empty, because normal haemoglobin has no sticky patch to put in it.",
              student: "The acceptor pocket is a feature of the T state and forms in HbA as well. Without βVal6 there is no donor, so nothing binds — the pocket alone is not the disease.",
              researcher: "The β85/β88 site is present in deoxy HbA; polymerisation requires the donor as well as the acceptor.",
            },
          },
          {
            when: {},
            tone: "harm", state: "open",
            headline: "Deoxygenated — the pocket is open",
            shows: { structure: "hbs-deoxy" },
            detail: {
              lay: "Once oxygen is released the molecule shifts shape, and a greasy dip lined by two residues opens on the surface. It is exactly the right shape to receive a valine.",
              student: "The T state presents a hydrophobic pocket formed by Phe85 and Leu88. This is why the disease is episodic: the trigger is deoxygenation, not the mutation alone.",
              researcher: "T-state quaternary structure exposes the β85/β88 acceptor site. Polymerisation is deoxy-specific and strongly delay-time dependent.",
            },
          },
        ],
      },
      {
        id: "assembly",
        scale: "assembly",
        title: "Tetramers lock together into a fibre",
        panel: { kind: "schematic", schematic: "fibre" },
        outcomes: [
          {
            when: { genotype: "hba" },
            tone: "safe",
            state: "dispersed",
            headline: "Nothing to stick with — molecules stay separate",
            detail: {
              lay: "Normal haemoglobin has no sticky patch, so the molecules drift past each other however little oxygen there is.",
              student: "Without βVal6 there is no donor for the acceptor pocket, and haemoglobin remains soluble at any saturation.",
              researcher: "No intermolecular contact forms; solubility is unaffected by deoxygenation.",
            },
          },
          {
            when: { oxygen: "normal" },
            tone: "safe",
            state: "dispersed",
            headline: "Sticky patch present, but nowhere to dock",
            detail: {
              lay: "The valine is there, but with oxygen on board there is no open pocket for it to sit in. The molecules stay apart.",
              student: "HbS remains soluble while oxygenated. This is why a patient with sickle cell disease is not sickling all the time.",
              researcher: "Donor present, acceptor absent. Polymerisation requires the T state.",
            },
          },
          {
            when: { genotype: "hbs-hbf", oxygen: "low" },
            tone: "safe",
            state: "interrupted",
            headline: "Fetal haemoglobin interrupts the chain",
            detail: {
              lay: "Fetal haemoglobin has no sticky patch and cannot join the rod. Mixed in among the sickle molecules it keeps breaking the chain before it can grow.",
              student: "HbF (α2γ2) lacks βVal6 and cannot participate in the contact. It acts as a chain terminator, raising the polymerisation delay time — the basis of hydroxyurea therapy.",
              researcher: "HbF and HbS/HbF hybrids are excluded from the polymer, reducing effective HbS concentration and lengthening delay time superlinearly.",
            },
          },
          {
            when: {},
            tone: "harm",
            state: "polymerised",
            headline: "A fibre grows, one molecule at a time",
            detail: {
              lay: "The valine of one molecule tucks into the pocket of the next, and that one into the next. Millions of them line up into a long stiff rod.",
              student: "Val6 of one tetramer inserts into the Phe85/Leu88 pocket of an adjacent one, propagating into a fourteen-strand helical fibre.",
              researcher: "Nucleation-limited polymerisation into a 14-strand double helical fibre, with a delay time steeply dependent on HbS concentration.",
            },
          },
        ],
      },
      {
        id: "cell",
        scale: "cell",
        title: "The red cell loses its shape",
        panel: { kind: "schematic", schematic: "redcell" },
        outcomes: [
          {
            when: { genotype: "hba" },
            tone: "safe", state: "disc",
            headline: "A flexible disc, as it should be",
            detail: {
              lay: "A healthy red cell is a soft disc that folds up to squeeze through the smallest vessels and springs back afterwards.",
              student: "A biconcave disc, highly deformable, able to traverse capillaries narrower than itself.",
              researcher: "Normal deformability and membrane integrity.",
            },
          },
          {
            when: { oxygen: "normal" },
            tone: "safe", state: "disc",
            headline: "Still a normal disc",
            detail: {
              lay: "No rods have formed, so the cell keeps its usual soft shape.",
              student: "Without polymer the cell retains normal morphology and deformability.",
              researcher: "Morphology preserved in the absence of intracellular polymer.",
            },
          },
          {
            when: { genotype: "hbs-hbf", oxygen: "low" },
            tone: "safe", state: "disc",
            headline: "Mostly holding its shape",
            detail: {
              lay: "With enough fetal haemoglobin the rods rarely get long enough to distort the cell before it reaches the lungs again.",
              student: "Raised HbF lengthens the delay time beyond capillary transit, so most cells re-oxygenate before polymer distorts them.",
              researcher: "Delay time exceeds transit time; sickling is largely averted.",
            },
          },
          {
            when: {},
            tone: "harm", state: "sickle",
            headline: "Stiff rods force it out of shape",
            detail: {
              lay: "The growing rods push against the inside of the cell until it is dragged into a crescent. The cell also becomes stiff, and damaged cells do not last their usual four months.",
              student: "Intracellular polymer distorts the cell into the classic sickle form and, more importantly, makes it rigid. Repeated cycles damage the membrane, causing haemolysis and a shortened red cell lifespan.",
              researcher: "Polymer-driven distortion with loss of deformability, membrane damage, cation leak and irreversibly sickled cells.",
            },
          },
        ],
      },
      {
        id: "patient",
        scale: "patient",
        title: "And that is the illness",
        panel: { kind: "schematic", schematic: "vessel" },
        outcomes: [
          {
            when: { genotype: "hba" },
            tone: "safe", state: "flowing",
            headline: "Blood flows",
            detail: {
              lay: "Cells fold up, slip through the smallest vessels and spring back. Nothing obstructs.",
              student: "Deformable cells traverse the microvasculature unimpeded; no occlusion, no ischaemic pain.",
              researcher: "Normal microvascular transit; no vaso-occlusion and no haemolytic burden.",
            },
          },
          {
            when: { oxygen: "normal" },
            tone: "safe", state: "flowing",
            headline: "No crisis while oxygenated",
            detail: {
              lay: "This is why someone with sickle cell disease is well most of the time, and becomes unwell in particular circumstances.",
              student: "The episodic nature of the disease follows directly from the oxygen dependence of the polymer.",
              researcher: "Clinical episodes track the deoxygenated fraction rather than the genotype alone.",
            },
          },
          {
            when: { genotype: "hbs-hbf", oxygen: "low" },
            tone: "safe", state: "flowing",
            headline: "Why hydroxyurea works",
            detail: {
              lay: "Raising fetal haemoglobin does not fix the gene. It simply buys the cell enough time to get back to the lungs before the rods form — and that is enough to reduce crises.",
              student: "Hydroxyurea induces HbF, lengthening the polymerisation delay time. Fewer painful crises, fewer chest crises, reduced transfusion need and improved survival.",
              researcher: "HbF induction raises delay time above capillary transit time; the clinical benefit is well established.",
            },
          },
          {
            when: {},
            tone: "harm", state: "occluded",
            headline: "Stiff cells jam the small vessels",
            detail: {
              lay: "Rigid crescent cells block the smallest blood vessels. The tissue downstream is starved of oxygen, which hurts — severely. That is a vaso-occlusive crisis. Over years the same process damages spleen, bone, kidney, lung and brain.",
              student: "Rigid sickled cells, with activated endothelium and adhesion, occlude the microvasculature. Acute: vaso-occlusive pain crisis, acute chest syndrome, stroke, priapism. Chronic: functional asplenia, avascular necrosis, nephropathy, pulmonary hypertension. Haemolysis adds anaemia and gallstones.",
              researcher: "Vaso-occlusion is multifactorial — polymer-driven rigidity, adhesion, endothelial activation and inflammation — with the polymer as the initiating requirement.",
            },
          },
        ],
      },
    ],
  },

  // ── Cystic fibrosis ─────────────────────────────────────────────────────
  {
    id: "cystic-fibrosis",
    title: "Why ΔF508 breaks a channel that would work",
    question: "Choose the genotype and whether a corrector is on board.",
    controls: [
      {
        id: "genotype",
        label: "CFTR allele",
        initial: "df508",
        options: [
          { value: "wt", label: "Wild type", note: "Phe508 present" },
          { value: "df508", label: "ΔF508", note: "Around 70% of CF alleles" },
        ],
      },
      {
        id: "drug",
        label: "Treatment",
        initial: "none",
        options: [
          { value: "none", label: "None", note: "" },
          { value: "potentiator", label: "Potentiator only", note: "Ivacaftor" },
          { value: "corrector", label: "Corrector + potentiator", note: "Elexacaftor / tezacaftor / ivacaftor" },
        ],
      },
    ],
    stages: [
      {
        id: "protein",
        scale: "protein",
        title: "One residue on the surface of one domain",
        panel: {
          kind: "structure",
          structure: "nbd1-wt",
          focus: { chain: "A", resNum: 508, code: "F" },
          radius: 15,
          color: "burial",
          emphasise: [{ chain: "A", resNum: 508, code: "F" }],
        },
        outcomes: [
          {
            when: { genotype: "wt" },
            tone: "safe", state: "present",
            headline: "Phe508 helps the domain fold, and holds its neighbour",
            shows: {
              structure: "nbd1-wt",
              focus: { chain: "A", resNum: 508, code: "F" },
              emphasise: [{ chain: "A", resNum: 508, code: "F" }],
            },
            detail: {
              lay: "This building block sits on the outside of one part of the channel, where it helps the piece settle into shape and grip the next piece along.",
              student: "Phe508 is solvent-exposed on NBD1, contributing to that domain's folding and to the interface with ICL4 of the second membrane domain.",
              researcher: "Contributes to NBD1 thermodynamic stability and to NBD1–ICL4 assembly.",
            },
          },
          {
            when: {},
            tone: "harm", state: "deleted",
            headline: "Deleted — and the domain folds too slowly",
            // The residue is genuinely absent from this file, so the camera
            // flies to the one before it. A reader looking for Phe508 and
            // finding Ile507 next to Gly509 has seen the deletion itself.
            shows: {
              structure: "nbd1-df508",
              focus: { chain: "A", resNum: 507, code: "I" },
              emphasise: [
                { chain: "A", resNum: 507, code: "I" },
                { chain: "A", resNum: 509, code: "G" },
              ],
            },
            detail: {
              lay: "The building block is simply missing — the chain runs straight from 507 to 509. The piece can still reach the right shape, but it does so slowly and unreliably, and its grip on the neighbouring piece is weakened.",
              student: "Phe508del reduces NBD1 stability and disrupts NBD1–ICL4 assembly. Note the ATP site is untouched — the chemistry is fine.",
              researcher: "Coupled folding and assembly defects; the channel is competent if it reaches the membrane.",
            },
          },
        ],
      },
      {
        id: "trafficking",
        scale: "cell",
        title: "The cell inspects it on the way out",
        panel: { kind: "schematic", schematic: "trafficking" },
        outcomes: [
          {
            when: { genotype: "wt" },
            tone: "safe", state: "delivered",
            headline: "Folds, passes inspection, reaches the surface",
            detail: {
              lay: "The finished channel is checked, approved, and delivered to the cell surface where it does its job.",
              student: "Correctly folded CFTR passes ER quality control, transits the Golgi and is delivered to the apical membrane.",
              researcher: "Normal biosynthetic processing to the mature, complex-glycosylated form.",
            },
          },
          {
            when: { genotype: "df508", drug: "corrector" },
            tone: "safe", state: "rescued",
            headline: "A corrector helps it fold, so some gets through",
            detail: {
              lay: "The corrector drugs act like a splint, helping the piece settle into shape fast enough to pass inspection. Not all of it gets through, but enough does.",
              student: "Correctors stabilise the folding intermediate and the domain interface, allowing a substantial fraction to escape ER degradation. A potentiator is then needed because rescued protein still gates poorly.",
              researcher: "Elexacaftor and tezacaftor act at distinct sites, giving additive rescue; ivacaftor addresses residual gating.",
            },
          },
          {
            when: {},
            tone: "harm", state: "degraded",
            headline: "Fails inspection and is destroyed",
            detail: {
              lay: "The cell decides the piece is faulty and destroys it before it ever reaches the surface. The channel would have worked — it simply never arrives.",
              student: "A class II defect. ER quality control recognises the misfolded protein and routes it to proteasomal degradation, so almost none reaches the apical membrane.",
              researcher: "ERAD of the immature form; negligible mature protein at the surface.",
            },
          },
        ],
      },
      {
        id: "channel",
        scale: "cell",
        title: "Salt and water at the airway surface",
        panel: { kind: "schematic", schematic: "gate" },
        outcomes: [
          {
            when: { genotype: "wt" },
            tone: "safe", state: "open",
            headline: "Chloride out, water follows",
            detail: {
              lay: "Salt moves out of the cell and water follows it, keeping a thin watery layer on the airway surface.",
              student: "Apical chloride secretion maintains airway surface liquid depth, keeping mucus hydrated and cilia able to move it.",
              researcher: "Normal ASL height and mucociliary transport.",
            },
          },
          {
            when: { genotype: "df508", drug: "corrector" },
            tone: "safe", state: "partial",
            headline: "Partly restored",
            detail: {
              lay: "Enough channels reach the surface, and work well enough, to restore much of the salt and water movement.",
              student: "Restored to a substantial fraction of normal chloride transport — enough for large improvements in lung function and sweat chloride.",
              researcher: "Partial restoration of CFTR-mediated conductance; clinically substantial though not complete.",
            },
          },
          {
            when: { genotype: "df508", drug: "potentiator" },
            tone: "harm", state: "closed",
            headline: "A potentiator alone does nothing here",
            detail: {
              lay: "This drug opens channels that are already at the surface. If none arrived, there is nothing for it to open.",
              student: "Ivacaftor is a gating potentiator. It is effective in gating mutations such as G551D, where protein reaches the membrane but opens poorly — and ineffective as monotherapy in ΔF508, where the protein is not there.",
              researcher: "Potentiator monotherapy has no meaningful effect on a trafficking-defective allele. The distinction is the basis of mutation-specific prescribing.",
            },
          },
          {
            when: {},
            tone: "harm", state: "closed",
            headline: "No channel, no chloride, no water",
            detail: {
              lay: "Without the channel, salt stays inside and the surface layer dries out. The mucus becomes thick and sticky.",
              student: "Absent apical chloride secretion depletes airway surface liquid; mucus becomes dehydrated and adherent, and mucociliary clearance fails.",
              researcher: "ASL depletion with impaired clearance.",
            },
          },
        ],
      },
      {
        id: "patient",
        scale: "patient",
        title: "And that is the illness",
        panel: { kind: "schematic", schematic: "airway" },
        outcomes: [
          {
            when: { genotype: "wt" },
            tone: "safe", state: "clear",
            headline: "Airways clear themselves",
            detail: {
              lay: "Mucus stays thin and is swept out continuously.",
              student: "Effective mucociliary clearance; no chronic infection.",
              researcher: "Normal airway host defence; no chronic colonisation.",
            },
          },
          {
            when: { genotype: "df508", drug: "corrector" },
            tone: "safe", state: "improving",
            headline: "Fewer exacerbations, better lung function",
            detail: {
              lay: "Treatment does not cure it, but clearance improves, infections become less frequent and lung function rises substantially.",
              student: "Triple therapy improves FEV1, reduces exacerbation rate, lowers sweat chloride and improves nutrition and quality of life.",
              researcher: "Substantial and durable clinical benefit across most Phe508del genotypes.",
            },
          },
          {
            when: {},
            tone: "harm", state: "obstructed",
            headline: "Thick mucus, chronic infection, progressive damage",
            detail: {
              lay: "Sticky mucus cannot be cleared, so bacteria settle in and stay. Repeated infection and inflammation scar the lungs over years. The same problem affects the pancreas, the gut and the sweat glands.",
              student: "Impaired clearance leads to chronic Pseudomonas and Staphylococcus infection, neutrophilic inflammation and bronchiectasis. Also pancreatic insufficiency, meconium ileus, CF-related diabetes, male infertility and raised sweat chloride.",
              researcher: "Progressive suppurative lung disease with multisystem exocrine involvement.",
            },
          },
        ],
      },
    ],
  },

  // ── Imatinib ────────────────────────────────────────────────────────────
  {
    id: "imatinib",
    title: "How one substitution defeats a drug",
    question: "Choose the kinase and the drug, and see whether the switch is jammed.",
    controls: [
      {
        id: "kinase",
        label: "BCR-ABL",
        initial: "t315i",
        options: [
          { value: "wt", label: "Wild type", note: "Thr315 gatekeeper" },
          { value: "t315i", label: "T315I", note: "Gatekeeper substitution" },
        ],
      },
      {
        id: "drug",
        label: "Inhibitor",
        initial: "imatinib",
        options: [
          { value: "none", label: "None", note: "" },
          { value: "imatinib", label: "Imatinib", note: "First-generation" },
          { value: "ponatinib", label: "Ponatinib", note: "Designed against T315I" },
        ],
      },
    ],
    stages: [
      {
        id: "gatekeeper",
        scale: "protein",
        title: "The gatekeeper residue",
        panel: {
          kind: "structure",
          structure: "abl-imatinib",
          focus: { chain: "A", resNum: 315, code: "T" },
          radius: 15,
          color: "hydropathy",
          emphasise: [{ chain: "A", resNum: 315, code: "T" }],
        },
        outcomes: [
          {
            when: { kinase: "wt" },
            tone: "safe", state: "threonine",
            headline: "Threonine — small, and it offers a handshake",
            shows: {
              structure: "abl-imatinib",
              focus: { chain: "A", resNum: 315, code: "T" },
              emphasise: [{ chain: "A", resNum: 315, code: "T" }],
            },
            detail: {
              lay: "A small guard at the entrance to a pocket, with a chemical hook that grips the drug.",
              student: "Thr315 donates a hydrogen bond to imatinib and its small side chain leaves the back pocket accessible.",
              researcher: "Hydrogen bonds to the anilino NH; side-chain volume sets the aperture of the hydrophobic back pocket.",
            },
          },
          {
            when: {},
            tone: "harm", state: "isoleucine",
            headline: "Isoleucine — bigger, and no hook",
            shows: {
              structure: "abl-t315i-ponatinib",
              focus: { chain: "A", resNum: 315, code: "I" },
              emphasise: [{ chain: "A", resNum: 315, code: "I" }],
            },
            detail: {
              lay: "The guard is now larger and has lost the hook. The way in is narrower and there is nothing to hold on to.",
              student: "T315I removes the hydroxyl and adds bulk. Two independent effects from one substitution.",
              researcher: "Simultaneous loss of a hydrogen-bond donor and steric occlusion.",
            },
          },
        ],
      },
      {
        id: "binding",
        scale: "protein",
        title: "Does the drug fit?",
        panel: { kind: "schematic", schematic: "lock" },
        outcomes: [
          { when: { kinase: "wt", drug: "none" }, tone: "harm", state: "empty-thr",
            headline: "Nothing bound",
            detail: {
              lay: "No drug present. The switch is free to work.",
              student: "Unliganded kinase, free to phosphorylate its substrates.",
              researcher: "Apo kinase; no inhibitor occupancy.",
            } },
          { when: { drug: "none" }, tone: "harm", state: "empty-ile",
            headline: "Nothing bound",
            detail: {
              lay: "No drug present, and the guard is the larger one. The switch is free to work.",
              student: "Unliganded T315I kinase; constitutively active and unopposed.",
              researcher: "Apo T315I; no inhibitor occupancy.",
            } },
          { when: { kinase: "wt", drug: "imatinib" }, tone: "safe", state: "fits-thr",
            headline: "Imatinib fits and holds",
            detail: {
              lay: "The drug slots into the pocket and the guard's hook grips it.",
              student: "Imatinib binds the DFG-out inactive conformation, hydrogen-bonded to Thr315.",
              researcher: "Type II binding to the DFG-out conformation of ABL1.",
            } },
          { when: { kinase: "wt", drug: "ponatinib" }, tone: "safe", state: "fits-thr",
            headline: "Ponatinib also fits",
            detail: {
              lay: "The newer drug binds here too — it was not built only for the resistant version.",
              student: "Ponatinib binds wild-type ABL as well as the gatekeeper mutant.",
              researcher: "Pan-BCR-ABL activity including the native kinase.",
            } },
          { when: { kinase: "t315i", drug: "imatinib" }, tone: "harm", state: "blocked-ile",
            headline: "Blocked — imatinib cannot get in",
            detail: {
              lay: "The larger guard is in the way, and the hook that held the drug is gone. It does not bind at all.",
              student: "There is no crystal structure of imatinib bound to T315I, because the complex does not form. The same substitution defeats dasatinib and nilotinib.",
              researcher: "Loss of measurable binding rather than reduced affinity.",
            } },
          { when: {}, tone: "safe", state: "fits-ile",
            headline: "Ponatinib threads past the larger gatekeeper",
            detail: {
              lay: "This drug was built with a narrow rigid link in the middle, thin enough to slip past the bigger guard.",
              student: "Ponatinib's carbon–carbon triple bond linker accommodates the isoleucine sterically — designed against this specific mutation.",
              researcher: "The alkyne linker preserves DFG-out binding while clearing the enlarged gatekeeper.",
            } },
        ],
      },
      {
        id: "signalling",
        scale: "cell",
        title: "Is the switch still on?",
        panel: { kind: "schematic", schematic: "signal" },
        outcomes: [
          { when: { kinase: "wt", drug: "imatinib" }, tone: "safe", state: "off",
            headline: "Signalling shut down",
            detail: {
              lay: "With the switch jammed, the growth signal stops.",
              student: "Inhibited BCR-ABL no longer phosphorylates its substrates; proliferative signalling ceases and the leukaemic clone contracts.",
              researcher: "Loss of constitutive kinase activity and downstream signalling.",
            } },
          { when: { drug: "ponatinib" }, tone: "safe", state: "off",
            headline: "Signalling shut down",
            detail: {
              lay: "The switch is jammed, even in the resistant version.",
              student: "Ponatinib inhibits both wild type and T315I.",
              researcher: "Activity retained against the gatekeeper mutant.",
            } },
          { when: {}, tone: "harm", state: "on",
            headline: "The switch stays on",
            detail: {
              lay: "Nothing is stopping it, so the growth signal runs continuously.",
              student: "Constitutively active BCR-ABL drives unregulated proliferation.",
              researcher: "Sustained oncogenic signalling through the fusion kinase.",
            } },
        ],
      },
      {
        id: "patient",
        scale: "patient",
        title: "And that is the clinical course",
        panel: { kind: "schematic", schematic: "course" },
        outcomes: [
          { when: { kinase: "wt", drug: "imatinib" }, tone: "safe", state: "remission",
            headline: "A fatal leukaemia becomes a manageable one",
            detail: {
              lay: "Before this drug, chronic myeloid leukaemia was usually fatal within a few years. With it, most people live a normal lifespan.",
              student: "Imatinib transformed CML: durable cytogenetic and molecular responses, near-normal life expectancy, monitored by BCR-ABL transcript levels.",
              researcher: "Sustained deep molecular response in the majority, with treatment-free remission achievable in a subset.",
            } },
          { when: { drug: "ponatinib" }, tone: "safe", state: "remission",
            headline: "Effective, including against T315I",
            detail: {
              lay: "The newer drug works where the first one fails — though it carries a greater risk of vascular side effects.",
              student: "Ponatinib is the option for T315I disease, balanced against a significant arterial occlusive event risk.",
              researcher: "Efficacy against T315I offset by a notable cardiovascular toxicity profile.",
            } },
          { when: {}, tone: "harm", state: "relapse",
            headline: "Resistance, and the disease returns",
            detail: {
              lay: "The counts rise again and the leukaemia comes back. Testing for this specific change is what tells the doctor which drug to switch to.",
              student: "Loss of response prompts BCR-ABL kinase domain mutation analysis; T315I specifically directs therapy to ponatinib or asciminib rather than another conventional inhibitor.",
              researcher: "Mutation-directed therapy selection following loss of molecular response.",
            } },
        ],
      },
    ],
  },

  // ── Nirmatrelvir ────────────────────────────────────────────────────────
  {
    id: "nirmatrelvir",
    title: "Blocking a virus's own scissors",
    question: "Choose whether the drug and its booster are present.",
    controls: [
      {
        id: "drug",
        label: "Nirmatrelvir",
        initial: "yes",
        options: [
          { value: "no", label: "Absent", note: "" },
          { value: "yes", label: "Present", note: "Binds the catalytic cysteine" },
        ],
      },
      {
        id: "booster",
        label: "Ritonavir",
        initial: "yes",
        options: [
          { value: "no", label: "Absent", note: "Nirmatrelvir cleared rapidly" },
          { value: "yes", label: "Present", note: "CYP3A4 inhibition maintains levels" },
        ],
      },
    ],
    stages: [
      {
        id: "dyad",
        scale: "protein",
        title: "The catalytic cysteine",
        panel: {
          kind: "structure",
          structure: "mpro-nirmatrelvir",
          focus: { chain: "A", resNum: 145, code: "C" },
          radius: 14,
          color: "charge",
          emphasise: [
            { chain: "A", resNum: 145, code: "C" },
            { chain: "A", resNum: 41, code: "H" },
          ],
        },
        outcomes: [
          { when: {}, tone: "neutral", state: "dyad",
            headline: "Cys145 and His41, working as a pair",
            detail: {
              lay: "One building block does the cutting; the one beside it makes it reactive enough to do so.",
              student: "A cysteine–histidine dyad, not the serine protease triad you might expect. That cysteine is what the drug targets.",
              researcher: "His41 generates the Cys145 thiolate; the dyad is the covalent handle.",
            } },
        ],
      },
      {
        id: "binding",
        scale: "protein",
        title: "Is the blade blocked?",
        panel: { kind: "schematic", schematic: "lock" },
        outcomes: [
          { when: { drug: "no" }, tone: "harm", state: "empty-cys",
            headline: "Free to cut",
            detail: {
              lay: "Nothing is in the way, so the scissors cut freely.",
              student: "Uninhibited protease; the catalytic cysteine is available to substrate.",
              researcher: "Apo enzyme with an unmodified catalytic cysteine.",
            } },
          { when: {}, tone: "safe", state: "fits-cys",
            headline: "A reversible covalent bond to Cys145",
            detail: {
              lay: "The drug sits in the groove and forms a real chemical bond with the blade — one that can come undone again, which makes it safer than a permanent one.",
              student: "The nitrile warhead forms a reversible thioimidate with Cys145.",
              researcher: "Reversible covalent inhibition, giving potency without irreversible-inhibitor liabilities.",
            } },
        ],
      },
      {
        id: "replication",
        scale: "cell",
        title: "Can the virus finish building itself?",
        panel: { kind: "schematic", schematic: "polyprotein" },
        outcomes: [
          { when: { drug: "no" }, tone: "harm", state: "cut",
            headline: "The polyprotein is cut into working parts",
            detail: {
              lay: "The long chain is chopped into the individual machines the virus needs, and replication proceeds.",
              student: "Mpro cleaves the polyprotein at eleven sites, releasing the non-structural proteins required for replication.",
              researcher: "Polyprotein processing proceeds; the replication–transcription complex assembles.",
            } },
          { when: {}, tone: "safe", state: "uncut",
            headline: "Nothing gets cut, so nothing gets built",
            detail: {
              lay: "The chain stays in one piece. None of the machines the virus needs are released, so it cannot copy itself.",
              student: "Inhibiting Mpro prevents polyprotein maturation and halts replication.",
              researcher: "Blocked processing prevents assembly of the replication machinery.",
            } },
        ],
      },
      {
        id: "patient",
        scale: "patient",
        title: "And why the tablet contains two drugs",
        panel: { kind: "schematic", schematic: "course" },
        outcomes: [
          { when: { drug: "no" }, tone: "harm", state: "relapse",
            headline: "Untreated infection takes its course",
            detail: {
              lay: "Without treatment the virus replicates freely in the first days of illness.",
              student: "Viral replication peaks early, which is why antiviral treatment must start within a few days of symptom onset.",
              researcher: "Early replication kinetics define a narrow treatment window.",
            } },
          { when: { drug: "yes", booster: "no" }, tone: "harm", state: "relapse",
            headline: "Cleared too fast to work",
            detail: {
              lay: "The drug works, but the liver removes it so quickly that useful levels are never maintained.",
              student: "Nirmatrelvir is a CYP3A4 substrate with rapid clearance. Without boosting, exposure falls below the target concentration.",
              researcher: "Insufficient exposure without pharmacokinetic enhancement.",
            } },
          { when: {}, tone: "safe", state: "remission",
            headline: "Ritonavir is there for the liver, not the virus",
            detail: {
              lay: "The second tablet has no effect on the virus at all. It blocks the liver enzyme that would otherwise clear the first drug. That is also why the pack carries such a long list of drug interactions.",
              student: "Ritonavir is a CYP3A4 inhibitor used purely as a pharmacokinetic booster. The same inhibition causes Paxlovid's extensive interaction profile — statins, calcineurin inhibitors, anticoagulants, antiarrhythmics — which is often the limiting factor in prescribing.",
              researcher: "Boosting maintains nirmatrelvir above target; the resulting CYP3A4 inhibition drives the interaction burden and dominates prescribing decisions.",
            } },
        ],
      },
    ],
  },
];

const byId = new Map(MECHANISMS.map((mechanism) => [mechanism.id, mechanism]));

export function mechanism(id: string): Mechanism | undefined {
  return byId.get(id);
}
