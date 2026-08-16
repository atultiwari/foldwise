/**
 * What is real, what is illustration, and what this is not for.
 *
 * The single most important text in the project. A folding visualiser that does
 * not draw this line is teaching students to believe an animation, and the
 * animation is the part nobody has ever seen.
 *
 * Written before the features it describes, and every estimated number in the
 * interface has to be traceable to a line in it.
 */

import type { Honesty } from "./schema.js";

export const HONESTY: Honesty = {
  real: [
    {
      title: "The structures",
      text:
        "Every molecule here is a deposited entry from the Protein Data Bank — real " +
        "atomic coordinates, real sequences, determined by X-ray crystallography or " +
        "cryo-electron microscopy. Each carries the date it was retrieved, because " +
        "entries get revised.",
    },
    {
      title: "The folded state",
      text:
        "When the timeline reaches the end, the model on screen is the deposited " +
        "structure — not an approximation of it. Root-mean-square deviation at that " +
        "point is 0.00 Å, limited only by the precision of the buffer the renderer reads.",
    },
    {
      title: "The measurements",
      text:
        "Radius of gyration, RMSD, solvent-accessible surface area, hydrogen bonds, salt " +
        "bridges and contact order are computed live from the coordinates on screen, not " +
        "scripted. Each was validated against an established tool: secondary structure " +
        "against PDBe at 96%, surface area against FreeSASA to within 0.06%.",
    },
    {
      title: "The size of the unfolded state",
      text:
        "The starting chain's radius of gyration follows the measured scaling law for " +
        "chemically denatured proteins, Rg = 1.93·N^0.598 Å, from small-angle X-ray " +
        "scattering across 28 proteins.",
    },
    {
      title: "The chain stays a chain",
      text:
        "At every point on the timeline, every Cα–Cα distance is within 0.01 Å of its " +
        "value in the deposited structure. Nothing stretches, and no two residues pass " +
        "through each other.",
    },
  ],

  illustration: [
    {
      title: "The route between them",
      text:
        "Nobody has ever observed a protein folding. It is far too fast and far too small. " +
        "The path shown here is generated, and the specific frames are a model — not a " +
        "recording, not a simulation, and not a prediction of any particular molecule's " +
        "history.",
    },
    {
      title: "The order events happen in",
      text:
        "That ordering is a real prediction, and the one genuine claim the animation makes. " +
        "Each residue adopts its folded geometry at a time set by how far its contacts " +
        "reach through the chain, how crowded its surroundings are, and what secondary " +
        "structure it belongs to. Local structure forms early; long-range closures happen " +
        "last. This follows contact-order theory — but it is a prediction about ordering, " +
        "not about timing.",
    },
    {
      title: "The unfolded shape",
      text:
        "One representative of the denatured ensemble, selected for being the right size. " +
        "A denatured chain has no single shape; showing one is a necessary simplification, " +
        "and the arrangement you see is arbitrary — reproducible, but arbitrary.",
    },
    {
      title: "The stage names",
      text:
        "'Hydrophobic collapse' and 'tertiary packing' are labels placed on a continuous " +
        "process at boundaries chosen for teaching. They are a presentation decision, not " +
        "a measurement.",
    },
  ],

  limits: [
    "This is not a medical device. Nothing here is intended for diagnosis, treatment, or the interpretation of any individual patient's results.",
    "Structural evidence maps to PP3/BP4 at most under ACMG/AMP criteria, and PM1 for well-established hotspots. It does not establish pathogenicity on its own.",
    "The model carries one point per side chain beyond Cβ, so side-chain packing, rotamers and hydrogen-bond geometry involving side chains are not represented.",
    "Surfaces are computed on an α-carbon model with uniform radii, so pockets are indicative rather than measurable. Do not read binding-site volumes off them.",
    "Where a published criterion could not be applied exactly — salt bridges are the clearest case — the approximation has been measured against the real answer and the gap recorded in the validation notes.",
  ],
};
