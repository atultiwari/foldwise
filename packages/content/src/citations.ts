/**
 * Sources.
 *
 * Every mechanistic claim in the editorial content points at one of these. A
 * teaching tool that asserts mechanism without a source is asking to be
 * believed rather than checked, which is the opposite of what it should teach.
 */

import type { Citation } from "./schema.js";

export const CITATIONS: readonly Citation[] = [
  {
    id: "fermi-1984-deoxyhb",
    authors: "Fermi G, Perutz MF, Shaanan B, Fourme R",
    title: "The crystal structure of human deoxyhaemoglobin at 1.74 Å resolution",
    journal: "Journal of Molecular Biology",
    year: 1984,
    doi: "10.1016/S0022-2836(84)80096-6",
  },
  {
    id: "harrington-1997-hbs",
    authors: "Harrington DJ, Adachi K, Royer WE",
    title: "The high resolution crystal structure of deoxyhemoglobin S",
    journal: "Journal of Molecular Biology",
    year: 1997,
    doi: "10.1006/jmbi.1997.1345",
  },
  {
    id: "ingram-1957-sickle",
    authors: "Ingram VM",
    title: "Gene mutations in human haemoglobin: the chemical difference between normal and sickle cell haemoglobin",
    journal: "Nature",
    year: 1957,
    doi: "10.1038/180326a0",
  },
  {
    id: "lewis-2005-nbd1",
    authors: "Lewis HA, Zhao X, Wang C, et al.",
    title: "Impact of the ΔF508 mutation in first nucleotide-binding domain of human cystic fibrosis transmembrane conductance regulator on domain folding and structure",
    journal: "Journal of Biological Chemistry",
    year: 2005,
    doi: "10.1074/jbc.M413947200",
  },
  {
    id: "zhang-2018-cftr",
    authors: "Zhang Z, Liu F, Chen J",
    title: "Molecular structure of the ATP-bound, phosphorylated human CFTR",
    journal: "Proceedings of the National Academy of Sciences",
    year: 2018,
    doi: "10.1073/pnas.1815287115",
  },
  {
    id: "middleton-2019-trikafta",
    authors: "Middleton PG, Mall MA, Dřevínek P, et al.",
    title: "Elexacaftor–tezacaftor–ivacaftor for cystic fibrosis with a single Phe508del allele",
    journal: "New England Journal of Medicine",
    year: 2019,
    doi: "10.1056/NEJMoa1908639",
  },
  {
    id: "nagar-2002-imatinib",
    authors: "Nagar B, Bornmann WG, Pellicena P, et al.",
    title: "Crystal structures of the kinase domain of c-Abl in complex with the small molecule inhibitors PD173955 and imatinib (STI-571)",
    journal: "Cancer Research",
    year: 2002,
    url: "https://aacrjournals.org/cancerres/article/62/15/4236/509693",
  },
  {
    id: "gorre-2001-resistance",
    authors: "Gorre ME, Mohammed M, Ellwood K, et al.",
    title: "Clinical resistance to STI-571 cancer therapy caused by BCR-ABL gene mutation or amplification",
    journal: "Science",
    year: 2001,
    doi: "10.1126/science.1062538",
  },
  {
    id: "ohare-2009-ponatinib",
    authors: "O'Hare T, Shakespeare WC, Zhu X, et al.",
    title: "AP24534, a pan-BCR-ABL inhibitor for chronic myeloid leukemia, potently inhibits the T315I mutant and overcomes mutation-based resistance",
    journal: "Cancer Cell",
    year: 2009,
    doi: "10.1016/j.ccr.2009.09.028",
  },
  {
    id: "owen-2021-nirmatrelvir",
    authors: "Owen DR, Allerton CMN, Anderson AS, et al.",
    title: "An oral SARS-CoV-2 Mpro inhibitor clinical candidate for the treatment of COVID-19",
    journal: "Science",
    year: 2021,
    doi: "10.1126/science.abl4784",
  },
  {
    id: "zhang-2020-mpro",
    authors: "Zhang L, Lin D, Sun X, et al.",
    title: "Crystal structure of SARS-CoV-2 main protease provides a basis for design of improved α-ketoamide inhibitors",
    journal: "Science",
    year: 2020,
    doi: "10.1126/science.abb3405",
  },
  {
    id: "kohn-2004-denatured",
    authors: "Kohn JE, Millett IS, Jacob J, et al.",
    title: "Random-coil behavior and the dimensions of chemically unfolded proteins",
    journal: "Proceedings of the National Academy of Sciences",
    year: 2004,
    doi: "10.1073/pnas.0403643101",
  },
  {
    id: "plaxco-1998-contact-order",
    authors: "Plaxco KW, Simons KT, Baker D",
    title: "Contact order, transition state placement and the refolding rates of single domain proteins",
    journal: "Journal of Molecular Biology",
    year: 1998,
    doi: "10.1006/jmbi.1998.1645",
  },
  {
    id: "kabsch-1983-dssp",
    authors: "Kabsch W, Sander C",
    title: "Dictionary of protein secondary structure: pattern recognition of hydrogen-bonded and geometrical features",
    journal: "Biopolymers",
    year: 1983,
    doi: "10.1002/bip.360221211",
  },
];

const byId = new Map(CITATIONS.map((citation) => [citation.id, citation]));

export function citation(id: string): Citation | undefined {
  return byId.get(id);
}

/** Vancouver-ish, which is what a medical reader expects. */
export function formatCitation(source: Citation): string {
  return `${source.authors}. ${source.title}. ${source.journal}. ${source.year}.`;
}

export function citationHref(source: Citation): string {
  return source.doi !== undefined ? `https://doi.org/${source.doi}` : (source.url ?? "");
}
