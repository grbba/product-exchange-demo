import rdflib
from rdflib.namespace import SKOS, RDF, RDFS
import jinja2
import uuid
import openai

# -----------------------------
# CONFIG
# -----------------------------
SKOS_INPUT_TTL = "./taxonomy.ttl"
MD_OUTPUT = "taxonomy.md"
UPDATED_TTL_OUTPUT = "taxonomy_updated.ttl"
USE_GPT = True  # set to False to disable GPT definition lookup
openai.api_key = "YOUR_OPENAI_API_KEY"

# -----------------------------
# HELPER FUNCTIONS
# -----------------------------

def generate_concept_id():
    """Random 8-character uppercase alphanumeric concept ID"""
    return uuid.uuid4().hex[:8].upper()

def get_facet_label(graph, concept_uri):
    """
    Walk up the skos:broader chain to find the top-level term (facet)
    Returns its prefLabel as string.
    """
    current = concept_uri
    while True:
        broader_terms = list(graph.objects(current, SKOS.broader))
        if not broader_terms:
            # Top term
            labels = list(graph.objects(current, SKOS.prefLabel))
            return str(labels[0]) if labels else "Unknown Facet"
        current = broader_terms[0]

def fetch_definition_with_context(label, concept_uri, graph, use_gpt=True):
    if not use_gpt:
        return ""
    facet_label = get_facet_label(graph, concept_uri)
    prompt = (
        f"You are helping to maintain a controlled vocabulary (taxonomy) used for refining the description of products.\n"
        f"This taxonomy follows ISO 25964 principles and contains multiple facets (top-level categories).\n\n"
        f"Facet context: {facet_label}\n"
        f"Term: {label}\n\n"
        f"Please provide a clear, concise, and context-relevant definition for this term, "
        f"appropriate for use in product classification. Avoid repeating the term unnecessarily."
    )
    response = openai.ChatCompletion.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
        max_tokens=200
    )
    definition = response.choices[0].message.content.strip()
    return definition

def collect_all_concepts(graph):
    """Collect SKOS concepts and SSR codes"""
    concepts = {}
    for s in graph.subjects(RDF.type, SKOS.Concept):
        concepts[s] = {"prefLabel": list(graph.objects(s, SKOS.prefLabel))[0],
                       "broader": list(graph.objects(s, SKOS.broader)),
                       "definition": list(graph.objects(s, SKOS.definition)),
                       "ssr": list(graph.objects(s, rdflib.URIRef("http://example.org/apmwg#linkedSSR")))}
    # SSR codes can keep local names
    ssr_codes = {}
    for s in graph.subjects(RDF.type, rdflib.URIRef("http://example.org/apmwg#SSR")):
        ssr_codes[s] = {"prefLabel": list(graph.objects(s, SKOS.prefLabel))[0],
                        "comment": list(graph.objects(s, RDFS.comment))}
    return concepts, ssr_codes

def generate_markdown(concepts, ssr_codes, graph):
    """Produce markdown with index, tables and top-term sections"""
    md_lines = ["# Taxonomy Index\n"]
    # Index
    top_terms = [s for s, c in concepts.items() if not c["broader"]]
    def render_index(concept, level=0):
        label = str(concepts[concept]["prefLabel"])
        md_lines.append("  " * level + f"- {label}")
        children = [s for s in concepts if concept in concepts[s]["broader"]]
        for child in sorted(children, key=lambda x: str(concepts[x]["prefLabel"])):
            render_index(child, level + 1)
    for top in sorted(top_terms, key=lambda x: str(concepts[x]["prefLabel"])):
        render_index(top)
    md_lines.append("\n---\n")

    # Tables per facet
    for top in sorted(top_terms, key=lambda x: str(concepts[x]["prefLabel"])):
        top_label = str(concepts[top]["prefLabel"])
        md_lines.append(f"## {top_label}\n")
        # Collect all descendants recursively
        def collect_descendants(uri):
            result = [uri]
            children = [s for s in concepts if uri in concepts[s]["broader"]]
            for c in children:
                result.extend(collect_descendants(c))
            return result
        all_concepts = collect_descendants(top)
        for c in all_concepts:
            data = concepts[c]
            # Ensure single definition cell with line breaks
            definition = " ".join([str(d) for d in data["definition"]]) if data["definition"] else fetch_definition_with_context(str(data["prefLabel"]), c, graph, USE_GPT)
            md_lines.append(f"| PT | Definition | ConceptID |")
            md_lines.append(f"|----|-----------|-----------|")
            md_lines.append(f"| {data['prefLabel']} | {definition.replace('\n','<br>')} | {generate_concept_id()} |")
            # ISO 25964 table
            md_lines.append(f"\n| BT | NT | UF | Top Term |")
            broader_label = [str(concepts[b]["prefLabel"]) for b in data["broader"]] if data["broader"] else []
            narrower_label = [str(concepts[s]["prefLabel"]) for s in concepts if c in concepts[s]["broader"]]
            md_lines.append(f"| {', '.join(broader_label)} | {', '.join(narrower_label)} | | {'Yes' if not broader_label else 'No'} |")
            # Language/Metadata table
            md_lines.append(f"\n| Language | {', '.join([str(l) for l in graph.objects(c, RDFS.label)])} |")
            md_lines.append(f"| Metadata | |")
            md_lines.append("\n---\n")
    return "\n".join(md_lines)

def update_ttl(concepts, graph):
    """Update TTL with new definitions and concept IDs"""
    mapping = {}
    new_graph = rdflib.Graph()
    new_graph.bind("skos", SKOS)
    new_graph.bind("rdfs", RDFS)
    for c, data in concepts.items():
        cid = generate_concept_id()
        mapping[c] = cid
        new_graph.add((rdflib.URIRef(f"http://example.org/apmwg#{cid}"), RDF.type, SKOS.Concept))
        new_graph.add((rdflib.URIRef(f"http://example.org/apmwg#{cid}"), SKOS.prefLabel, data["prefLabel"]))
        if data["definition"]:
            for d in data["definition"]:
                new_graph.add((rdflib.URIRef(f"http://example.org/apmwg#{cid}"), SKOS.definition, d))
        for b in data["broader"]:
            new_graph.add((rdflib.URIRef(f"http://example.org/apmwg#{cid}"), SKOS.broader,
                           rdflib.URIRef(f"http://example.org/apmwg#{mapping.get(b, generate_concept_id())}")))
        # SSR
        for ssr in data["ssr"]:
            new_graph.add((rdflib.URIRef(f"http://example.org/apmwg#{cid}"), rdflib.URIRef("http://example.org/apmwg#linkedSSR"), ssr))
    return new_graph

# -----------------------------
# MAIN SCRIPT
# -----------------------------
graph = rdflib.Graph()
graph.parse(SKOS_INPUT_TTL, format="turtle")

concepts, ssr_codes = collect_all_concepts(graph)

md_content = generate_markdown(concepts, ssr_codes, graph)
with open(MD_OUTPUT, "w", encoding="utf-8") as f:
    f.write(md_content)

updated_graph = update_ttl(concepts, graph)
updated_graph.serialize(UPDATED_TTL_OUTPUT, format="turtle")

print(f"Markdown written to {MD_OUTPUT}")
print(f"Updated TTL written to {UPDATED_TTL_OUTPUT}")
