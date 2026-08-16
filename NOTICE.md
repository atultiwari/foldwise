# Notices

## Licensing

The [MIT licence](LICENSE) covers the **source code**. Two other things in this
repository carry different terms.

### Structural data — CC0 1.0

Everything under `data/` is derived from the [RCSB Protein Data
Bank](https://www.rcsb.org), which releases its holdings into the public domain
under CC0 1.0. It is not ours to license and no claim is made over it.

Secondary-structure cross-validation uses the [PDBe
API](https://www.ebi.ac.uk/pdbe/api/doc/) (EMBL-EBI).

Sources planned for later phases carry stricter terms and must be checked before
use: AlphaFold DB and UniProt are CC-BY-4.0 and require attribution, ChEMBL is
share-alike, and DrugBank is non-commercial only.

### Editorial content — CC BY 4.0

Prose, curated structure notes, and teaching material are licensed under
[Creative Commons Attribution 4.0
International](https://creativecommons.org/licenses/by/4.0/).

---

## This is not a medical device

Foldwise is an educational and research visualisation tool. It is not intended
for clinical decision-making, diagnosis, treatment, or the interpretation of any
individual patient's results, and it must not be used for those purposes.

Specific constraints the project holds itself to:

- **Computed values are never presented as clinical findings.** Estimated
  quantities — stability scores, free-energy estimates, melting temperatures,
  variant deltas — are displayed separately from, and visually distinct from,
  any classification sourced from a curated database.
- **Variant interpretation follows ACMG/AMP.** Structural evidence maps to
  PP3/BP4 at most, and PM1 for well-established hotspots. Where variants are
  shown, that limit is stated in the interface.
- **No patient data.** Public reference variants only. No facility is provided
  for entering identifiable or patient-specific information.
- **Sources are versioned and date-stamped.** PDB entries are revised and
  superseded; every emitted structure records its retrieval date and the
  pipeline version that produced it.
- **Models are labelled as models.** Where a value is not a measurement, the
  interface says so.

The reasoning behind these rules is set out in the project's planning documents,
kept in the parent workspace alongside this repository.
