# skos_to_iso25964_facets_indented.py
from rdflib import Graph, Namespace, URIRef, Literal
from jinja2 import Template
import random, string, re

# --- Namespaces (adjust APMWG to your real base URI) ---
SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")
RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#")
APMWG = Namespace("http://example.org/apmwg#")

# --- Load your data (add more g.parse(...) if SSR lives in another TTL) ---
g = Graph()
g.parse("taxonomy.ttl", format="turtle")

# --- Helpers ---
def generate_concept_id():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

def make_anchor(label: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', label.lower()).strip('-')

def get_label(uri: URIRef) -> str:
    # Prefer skos:prefLabel@en, then any prefLabel, then rdfs:label, then fragment
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
    return str(uri).split('#')[-1] if isinstance(uri, URIRef) else str(uri)

def clickable_if_concept(uri: URIRef, concept_uris: set) -> str:
    label = get_label(uri)
    return f"[{label}](#{make_anchor(label)})" if uri in concept_uris else label

def get_ancestors(uri: URIRef) -> list[URIRef]:
    """All broader ancestors (recursively), nearest first."""
    out, seen = [], set()
    def dfs(u):
        for b in g.objects(u, SKOS.broader):
            if b not in seen:
                seen.add(b)
                out.append(b)
                dfs(b)
    dfs(uri)
    return out

def get_children(uri: URIRef) -> list[URIRef]:
    """Immediate children using inverse of skos:broader (handles files without skos:narrower)."""
    kids = list(g.subjects(SKOS.broader, uri))
    kids.sort(key=lambda u: get_label(u).lower())
    return kids

def get_descendants(uri: URIRef) -> list[URIRef]:
    """All descendants (recursive) via inverse broader."""
    out, seen = [], set()
    def dfs(u):
        for c in get_children(u):
            if c not in seen:
                seen.add(c)
                out.append(c)
                dfs(c)
    dfs(uri)
    return out

def linked_ssr_pretty(uri: URIRef | None) -> str:
    if not uri:
        return ""
    label = get_label(uri)
    comment = " ".join([str(c) for c in g.objects(uri, RDFS.comment)])
    link = f"[{label}]({uri})"
    return f"{link} — {comment}" if comment else link

# Collect definitions into one string with <br> for line breaks
def get_definition(uri: URIRef) -> str:
    defs = []
    for df in g.objects(uri, SKOS.definition):
        if isinstance(df, Literal):
            # Replace literal line breaks with <br>
            defs.append(str(df).replace("\n", "<br>"))
    return "<br>".join(defs)

# --- Build index page ---
def build_index_page(top_terms: list[URIRef]) -> str:
    lines = ["# Taxonomy Index\n"]
    for facet in top_terms:
        facet_label = get_label(facet)
        lines.append(f"- [{facet_label}](#{make_anchor(facet_label)})")
        children = get_children(facet)
        for child in children:
            child_label = get_label(child)
            lines.append(f"  - [{child_label}](#{make_anchor(child_label)})")
    lines.append("\n---\n")
    return "\n".join(lines)

# --- Collect concepts & prepare stable ConceptIDs for this run ---
concept_uris = set(g.subjects(predicate=None, object=SKOS.Concept))
concept_id_map = {u: generate_concept_id() for u in concept_uris}

# --- Template: three tables per concept ---
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

def render_concept(uri: URIRef, level: int, facet_root: URIRef, visited: set[URIRef]) -> str:
    """Render one concept + recursively render children (with cycle protection)."""
    out = []
    if uri in visited:
        return ""  # avoid cycles / duplicates within this facet
    visited.add(uri)

    pref_label = get_label(uri)
    heading_prefix = "#" * min(6, 2 + level)  # Facet content starts at '##', then deeper
    # definition = " ".join([str(df) for df in g.objects(uri, SKOS.definition)])
    definition = get_definition(uri)

    # BT = all ancestors (nearest first), clickable when possible
    ancestors = get_ancestors(uri)
    bt = ", ".join([clickable_if_concept(a, concept_uris) for a in ancestors])

    # NT = immediate children, clickable
    children = get_children(uri)
    nt = ", ".join([clickable_if_concept(c, concept_uris) for c in children])

    # UF = altLabels; make them clickable to THIS concept section
    uf_labels = [str(lbl) for lbl in g.objects(uri, SKOS.altLabel) if isinstance(lbl, Literal)]
    uf = ", ".join([f"[{txt}](#{make_anchor(pref_label)})" for txt in uf_labels])

    # RT = related concepts, clickable if present in set
    related_uris = list(g.objects(uri, SKOS.related))
    rt = ", ".join([clickable_if_concept(r, concept_uris) for r in related_uris])

    linked_ssr = linked_ssr_pretty(g.value(uri, APMWG["linkedSSR"]))

    # Languages list (e.g., "en: Vegan; fr: Végétalien")
    langs = [f"{lbl.language}: {lbl}" for lbl in g.objects(uri, SKOS.prefLabel) if isinstance(lbl, Literal)]
    languages_str = "; ".join(langs) if langs else "(none)"

    is_top_term = "Yes" if not list(g.objects(uri, SKOS.broader)) else "No"

    out.append(concept_tmpl.render(
        heading_prefix=heading_prefix,
        pref_label=pref_label,
        definition=definition,
        concept_id=concept_id_map[uri],
        top_term=is_top_term,
        bt=bt, nt=nt, uf=uf, rt=rt,
        linked_ssr=linked_ssr,
        languages=languages_str
    ))

    # Recurse to children (sorted)
    for child in children:
        out.append(render_concept(child, level + 1, facet_root, visited))
    return "".join(out)

# --- Identify facets (Top Terms = no broader) & render grouped output ---
top_terms = sorted([u for u in concept_uris if not list(g.objects(u, SKOS.broader))],
                   key=lambda u: get_label(u).lower())


# Add index page first
md_parts = [build_index_page(top_terms)]

# Then facets
for top in top_terms:
    facet_label = get_label(top)
    md_parts.append(f"# {facet_label} (Facet)\n\n")
    visited_within_facet = set()
    md_parts.append(render_concept(top, level=0, facet_root=top, visited=visited_within_facet))


#md_parts = []
#for top in top_terms:
#    facet_label = get_label(top)
#    md_parts.append(f"# {facet_label} (Facet)\n\n")
#    visited_within_facet = set()
    # Render the facet root and all its subtree (derived via inverse broader)
#    md_parts.append(render_concept(top, level=0, facet_root=top, visited=visited_within_facet))
    # Optionally, list any descendants not reachable due to data quirks:
    # (Usually unnecessary if broader links are consistent)

# --- Save ---
with open("taxonomy_iso25964_facets_indented.md", "w", encoding="utf-8") as f:
    f.write("".join(md_parts))

print("✅ Markdown export with facets + full recursive traversal saved to taxonomy_iso25964_facets_indented.md")
