# Taxonomy Mapping Policy (Template)

> **Purpose**  
> Define how we align concepts between two taxonomies (source ↔ target) in a consistent, auditable, and repeatable way.

---

## 1. Scope
- **Taxonomies in scope:** `SOURCE_TAX` ↔ `TARGET_TAX` (versions & namespace IRIs below).
- **Concept types covered:** Top concepts, internal nodes, leaves; terms in all supported languages.
- **Out of scope:** Governance metadata, workflow roles (covered in the Taxonomy Governance Policy).

## 2. References
- ISO 25964-1/2 (Thesauri and interoperability).
- SKOS mapping predicates and best practices.
- Internal conventions (naming, IDs, languages).

## 3. Versions & Namespaces
- **Source taxonomy:**  
  - `title:` …  
  - `version_label:` …  
  - `namespace_uri:` …  
- **Target taxonomy:**  
  - `title:` …  
  - `version_label:` …  
  - `namespace_uri:` …  

> Rule: Mappings must always reference **fixed versions** (frozen tag/IRI) to ensure reproducibility.

## 4. Mapping Types (allowed)
- `exactMatch`: Concepts are equivalent in meaning and usage.
- `closeMatch`: Nearly equivalent; minor scope or context difference acceptable.
- `broadMatch`: Source is broader than target.
- `narrowMatch`: Source is narrower than target.
- `relatedMatch`: Associated but not hierarchical equivalence.

> Cardinality rule: Prefer **1:1** for `exactMatch` and `closeMatch`. Allow **1:n** for `broadMatch` / `narrowMatch`. Avoid many:many unless justified in notes.

## 5. Evidence & Decision Rules
We assign an **evidence score** (0–100). Mappings must meet the threshold below:

| Evidence dimension | Weight | Examples |
|---|---:|---|
| **Label match** (pref + alt) | 0.25 | identical/normalized label |
| **Definition/Scope** | 0.30 | matching scope notes, T&Cs |
| **Hierarchy context** | 0.20 | same parent/sibling pattern |
| **Usage context** | 0.15 | same business/rules usage |
| **External codes** | 0.10 | same SSR/ATA/IATA code |

**Thresholds**
- `exactMatch` ≥ **90** and no known scope conflicts.
- `closeMatch` ≥ **75** and differences documented.
- `broadMatch`/`narrowMatch` ≥ **60** with hierarchy evidence.
- `relatedMatch` ≥ **50** with clear associative rationale.

> **Mandatory evidence fields:** `evidence_notes`, `source_snippet`, `target_snippet`, `reviewer`.

## 6. Language Policy
- Preferred terms compared **per language**; fall back to alt terms if needed.
- If different languages disagree on match strength, take the **lowest** score and document.

## 7. Special Cases
- **Polyhierarchy:** derive hierarchy evidence from **all** parents.
- **Compound/Pre-coordinated concepts (if present):** decompose to atomic concepts; map only if composite meaning aligns.
- **Top concepts:** never map a top concept to a non-top unless a governance waiver is recorded.
- **Deprecated concepts:** may map to replacement using `exactMatch`/`closeMatch` plus `replaces` note.

## 8. Prohibited Mappings
- Do **not** assert `exactMatch` if either side requires additional constraints (e.g., “Meal” vs “Vegetarian Meal”).
- Do **not** use mapping to replicate in-scheme relations (broader/related within the same taxonomy).

## 9. Review & Workflow
- **Authoring:** Analyst proposes mappings with evidence.
- **Peer review:** Second analyst sign-off required for `exactMatch`/`closeMatch`.
- **Approver:** Domain steward approves release.
- **Change log:** Every change must record `who/when/why`.

## 10. Release Packaging
- Group mappings in a **MappingSet** (title, version_label, scope, license).
- Deliver formats: CSV + JSON-LD (SKOS) + human-readable report (PDF).
- Include coverage stats and quality metrics.

## 11. Quality Metrics (per release)
- % concepts covered (source-side).
- Distribution by mapping type.
- % mappings with full evidence attached.
- # disputed mappings and resolution time.

## 12. Risk & Conflict Resolution
- If conflict between `exactMatch` and `broadMatch` candidates, prefer **lower strength** unless further evidence is added.
- If two targets qualify equally, use `closeMatch` and add disambiguation notes or escalate.

## 13. Example: Airline Cases
- **“Meal” ↔ “Meal”**: `exactMatch` (same scope & service rules).  
- **“Ski equipment baggage” ↔ “Sports equipment (ski)”**: `closeMatch` (same rules; target name more specific).  
- **“Priority boarding” ↔ “Boarding”**: `narrowMatch` (source narrower).  
- **“Cabin baggage” ↔ “Carry-on”**: `exactMatch` or `closeMatch` depending on airline definition; document size/weight scope.

## 14. Minimal Data Fields (per Mapping)
```
mapping_id: "map-2025-00123"
source_concept_iri: "https://source.tax/…"
target_concept_iri: "https://target.tax/…"
type: exactMatch | closeMatch | broadMatch | narrowMatch | relatedMatch
evidence_score: 92
evidence_notes: "Same definition; identical parents; SSR code matches."
source_snippet: "…"
target_snippet: "…"
author: "A. Analyst"
reviewer: "B. Reviewer"
approved_by: "C. Steward"
created: "2025-10-20"
modified: "2025-10-20"
```

## 15. YAML Profile (optional, machine-use)
```yaml
policy:
  version: 1.0
  thresholds:
    exactMatch: 90
    closeMatch: 75
    broadMatch: 60
    narrowMatch: 60
    relatedMatch: 50
  weights:
    label: 0.25
    definition: 0.30
    hierarchy: 0.20
    usage: 0.15
    codes: 0.10
  cardinality:
    exactMatch: "1:1"
    closeMatch: "1:1"
    broadMatch: "1:n"
    narrowMatch: "1:n"
    relatedMatch: "n:n"
  constraints:
    forbid_in_scheme_mapping: true
    forbid_top_to_non_top: true
  review:
    require_peer_for: ["exactMatch","closeMatch"]
    require_steward_signoff: true
  deliverables:
    - csv
    - jsonld
    - pdf_report
```

## 16. Checklist (before release)
- [ ] Versions & namespaces recorded for both taxonomies.
- [ ] All mappings meet thresholds; evidence attached.
- [ ] Peer review completed where required.
- [ ] Coverage and quality metrics generated.
- [ ] MappingSet packaged with license and notes.

---

**Owner:** Taxonomy Stewardship Team  
**Contact:** taxonomy@example.org
