# skos_md_and_ttl_update.py
"""
SKOS -> ISO 25964 Markdown + Updated TTL (ConceptIDs) exporter

What this script does in ONE run:
1) Loads a SKOS Turtle taxonomy.
2) Generates an ISO 25964-style Markdown with:
   - Facet grouping (Top Terms = no skos:broader)
   - Recursive index at top (all descendants)
   - Three tables per concept (PT/Definition/ConceptID, Relationships, Language/Metadata)
   - Internal cross-links (BT/NT/RT/UF to anchors)
   - Linked SSR entries with label + link + inline comment
   - Multiline skos:definition preserved in a single cell via <br>
   - Optional ChatGPT fallback for missing definitions

Configuration:
- Set USE_CHATGPT_FALLBACK to True to enable OpenAI lookup for missing definitions
- Provide OPENAI_API_KEY via environment variable when fallback is enabled
- Input/output filenames can be overridden by env vars:
  SKOS_INPUT_TTL, SKOS_OUTPUT_MD, SKOS_OUTPUT_UPDATED_TTL, OPENAI_MODEL

Usage:
  pip install rdflib jinja2 openai
  python skos_md_and_ttl_update.py
"""

import os
import re
import random
import string
from typing import List, Set, Dict, Tuple, Optional

from rdflib import Graph, Namespace, URIRef, Literal
from rdflib.namespace import RDF
from jinja2 import Template

# ---------------- CONFIG ----------------
INPUT_TTL = os.getenv("SKOS_INPUT_TTL", "export11.ttl")
OUTPUT_MD = os.getenv("SKOS_OUTPUT_MD", "taxonomy_iso25964_facets_indented11.md")
OUTPUT_TTL = os.getenv("SKOS_OUTPUT_UPDATED_TTL", "taxonomy_updated.ttl")

USE_CHATGPT_FALLBACK = False  # Set True to enable AI definitions for missing entries
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")  # Required if fallback enabled
# ----------------------------------------

# Optional import only if fallback is enabled
client = None
if USE_CHATGPT_FALLBACK:
    try:
        from openai import OpenAI
        client = OpenAI()  # reads OPENAI_API_KEY from env
        if not OPENAI_API_KEY:
            print("⚠️ OPENAI_API_KEY not set; definition fallback will likely fail.")
    except Exception as e:
        print(f"⚠️ OpenAI client init failed: {e}. Fallback disabled.")
        USE_CHATGPT_FALLBACK = False

# Namespaces (adjust APMWG base to your actual namespace)
SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")
RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#")
APMWG = Namespace("https://taxonomy.apmwg.ovh#")  # change to your real base

# Load graph
g = Graph()
g.parse(INPUT_TTL, format="turtle")

# Bind prefixes (helps keep TTL readable on output)
g.bind("skos", SKOS)
g.bind("rdfs", RDFS)
g.bind("apmwg", APMWG)

def generate_concept_id() -> str:
    """Random 8-char uppercase alphanumeric ID."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

def make_anchor(label: str) -> str:
    """Make a GitHub/MkDocs-style anchor from a label."""
    return re.sub(r'[^a-z0-9]+', '-', label.lower()).strip('-')

def get_label(uri: URIRef) -> str:
    """Preferred label: skos:prefLabel@en, any prefLabel, rdfs:label, then fragment."""
    best = None
    for lbl in g.objects(uri, SKOS.prefLabel):
        if isinstance(lbl, Literal):
            if lbl.language == "en":
                return str(lbl)
            if best is None:
                best = str(lbl)
    for lbl in g.objects(uri, RDFS.label):
        if isinstance(lbl, Literal):
            if lbl.language == "en":
                return str(lbl)
            if best is None:
                best = str(lbl)
    if best:
        return best
    return str(uri).split("#")[-1]

def clickable_if_concept(uri: URIRef, concept_uris: Set[URIRef]) -> str:
    """Return Markdown link to local concept anchor if available, else plain label."""
    label = get_label(uri)
    return f"[{label}](#{make_anchor(label)})" if uri in concept_uris else label

def get_ancestors(uri: URIRef) -> List[URIRef]:
    """All broader ancestors (recursive), nearest first."""
    out, seen = [], set()
    def dfs(u):
        for b in g.objects(u, SKOS.broader):
            if b not in seen:
                seen.add(b)
                out.append(b)
                dfs(b)
    dfs(uri)
    return out

def get_children(uri: URIRef) -> List[URIRef]:
    """Immediate children via inverse of skos:broader (handles graphs without skos:narrower)."""
    kids = list(g.subjects(SKOS.broader, uri))
    kids.sort(key=lambda u: get_label(u).lower())
    return kids

def get_all_descendants(uri: URIRef) -> List[URIRef]:
    """All descendants (recursive) using inverse broader; sorted per level by label."""
    result = []
    for child in get_children(uri):
        result.append(child)
        result.extend(get_all_descendants(child))
    return result

def linked_ssr_pretty(uri: Optional[URIRef]) -> str:
    """Return '[Label](URI) — comment' or empty string."""
    if not uri:
        return ""
    label = get_label(uri)
    comment = " ".join([str(c) for c in g.objects(uri, RDFS.comment)])
    link = f"[{label}]({uri})"
    return f"{link} — {comment}" if comment else link

# --- Helper to find the top-level facet (no broader term) ---
def get_facet_label(uri: URIRef):
    """
    Walks up the skos:broader chain to find the top-level term (facet)
    Returns its prefLabel as string.
    """
    current = uri
    while True:
        broader_terms = list(g.objects(current, SKOS.broader))
        if not broader_terms:
            # No broader term → top term
            labels = list(g.objects(current, SKOS.prefLabel))
            return str(labels[0]) if labels else "Unknown Facet"
        current = broader_terms[0]

def get_definition(uri: URIRef) -> str:
    """Collects all skos:definition literals; preserves line breaks as <br>. Optional API fallback."""
    defs = []
    for df in g.objects(uri, SKOS.definition):
        if isinstance(df, Literal):
            defs.append(str(df).replace("\n", "<br>"))
    if defs:
        return "<br>".join(defs)

    if USE_CHATGPT_FALLBACK and client is not None:
        try:
            # facet_label = get_facet_label(uri)
            prompt = (
                f"You are helping to maintain a controlled vocabulary (taxonomy) used for refining the description of products.\n"
                f"This taxonomy follows ISO 25964 principles and contains multiple facets (top-level categories).\n\n"
                f"Facet context: {get_facet_label(uri)}\n"
                f"Provide a clear, concise, and context relevant definition for the following concept: "
                f"'{get_label(uri)}' in plain English " 
                f"appropriate for use in product classification. Avoid repeating the term unnecessarily. " 
                f"Do not exceed 40 words."
            )
            resp = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=80,
                temperature=0.2,
            )
            # New SDK returns choices list with .message.content
            return resp.choices[0].message.content.strip()
        except Exception as e:
            print(f"⚠️ ChatGPT lookup failed for {get_label(uri)}: {e}")
    return ""

# Three-table template for each concept
concept_tmpl = Template("""{{ heading_prefix }} {{ pref_label }}

| PT | Definition | Concept ID |
|----|------------|------------|
| {{ pref_label }} | {{ definition or "(none)" }} | {{ concept_id }} |

| Top Term | BT | NT | UF | RT | Linked SSR |
|----------|----|----|----|----|------------|
| {{ top_term }} | {{ bt or "(none)" }} | {{ nt or "(none)" }} | {{ uf or "(none)" }} | {{ rt or "(none)" }} | {{ linked_ssr or "(none)" }} |

| Language | Metadata |
|----------|----------|
| {{ languages }} | (empty) |

""")

def render_concept(uri: URIRef, level: int, concept_uris: Set[URIRef], concept_ids: Dict[URIRef, str],
                   collected_defs: Dict[URIRef, str], visited: Set[URIRef]) -> str:
    """Render one concept and recursively render its children with increasing heading level."""
    if uri in visited:
        return ""  # Avoid cycles/duplicates within the facet
    visited.add(uri)

    pref_label = get_label(uri)
    heading_prefix = "#" * min(6, 2 + level)  # Facet content starts at '##', then deeper
    definition = get_definition(uri)
    collected_defs[uri] = definition  # store for TTL patching

    # BT = ancestors (nearest first), clickable
    ancestors = get_ancestors(uri)
    bt = ", ".join([clickable_if_concept(a, concept_uris) for a in ancestors])

    # NT = immediate children, clickable
    children = get_children(uri)
    nt = ", ".join([clickable_if_concept(c, concept_uris) for c in children])

    # UF = altLabels; link to this concept
    uf_labels = [str(lbl) for lbl in g.objects(uri, SKOS.altLabel) if isinstance(lbl, Literal)]
    uf = ", ".join([f"[{txt}](#{make_anchor(pref_label)})" for txt in uf_labels]) if uf_labels else ""

    # RT = related concepts, clickable if present
    related_uris = list(g.objects(uri, SKOS.related))
    rt = ", ".join([clickable_if_concept(r, concept_uris) for r in related_uris])

    linked_ssr = linked_ssr_pretty(g.value(uri, APMWG["linkedSSR"]))
    print(linked_ssr)
    print("\n")

    # Languages list (e.g., "en: Vegan; fr: Végétalien")
    langs = [f"{lbl.language}: {lbl}" for lbl in g.objects(uri, SKOS.prefLabel) if isinstance(lbl, Literal)]
    languages_str = "; ".join(langs) if langs else "(none)"

    is_top_term = "Yes" if not list(g.objects(uri, SKOS.broader)) else "No"

    section = concept_tmpl.render(
        heading_prefix=heading_prefix,
        pref_label=pref_label,
        definition=definition,
        concept_id=concept_ids[uri],
        top_term=is_top_term,
        bt=bt, nt=nt, uf=uf, rt=rt,
        linked_ssr=linked_ssr,
        languages=languages_str
    )

    # Recurse for children
    for child in children:
        section += render_concept(child, level + 1, concept_uris, concept_ids, collected_defs, visited)
    return section

def build_index_page(top_terms: List[URIRef]) -> str:
    """Build a recursive, sorted index with all descendants under each facet."""
    lines = ["# Taxonomy Index\n"]

    def traverse(node: URIRef, level: int):
        label = get_label(node)
        lines.append(f'{"  " * level}- [{label}](#{make_anchor(label)})')
        for child in get_children(node):
            traverse(child, level + 1)

    for facet in top_terms:
        traverse(facet, 0)
    lines.append("\n---\n")
    return "\n".join(lines)

# Collect all SKOS concepts & concept IDs (stable per run)
concept_uris: Set[URIRef] = set(g.subjects(RDF.type, SKOS.Concept))
concept_ids: Dict[URIRef, str] = {u: generate_concept_id() for u in concept_uris}

# Identify facets (Top Terms = no broader)
top_terms = sorted([u for u in concept_uris if not list(g.objects(u, SKOS.broader))],
                   key=lambda u: get_label(u).lower())

# Assemble Markdown
md_parts: List[str] = [build_index_page(top_terms)]
collected_defs: Dict[URIRef, str] = {}
for top in top_terms:
    facet_label = get_label(top)
    md_parts.append(f"# {facet_label} (Facet)\n\n")
    visited_within_facet: Set[URIRef] = set()
    md_parts.append(render_concept(top, level=0,
                                   concept_uris=concept_uris,
                                   concept_ids=concept_ids,
                                   collected_defs=collected_defs,
                                   visited=visited_within_facet))

# Save Markdown
with open(OUTPUT_MD, "w", encoding="utf-8") as f:
    f.write("".join(md_parts))
print(f"✅ Markdown export saved to {OUTPUT_MD}")