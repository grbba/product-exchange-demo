#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SKOS to Confluence
------------------
Generate Confluence-ready docs (Storage Format) from a global .ttl and (optionally)
POST them into Confluence under a chosen parent page.

Features
- All-in-one page
- Per-scheme pages
- Post mode: create or update pages under a parent
- Parent control via --parent-id or --parent-url (e.g. https://mysite.net/wiki/spaces/APMWG/pages/922025985/Taxonomy+Sub-group)
- Safe dry-run mode shows what would be posted

Install:
  pip install rdflib requests

Examples:
  # Only generate files
  python skos_to_confluence.py --ttl global.ttl --out outdir --title "Product Taxonomy"

  # Post all-in-one under specific parent (create or update by title)
  python skos_to_confluence.py --ttl global.ttl --title "Product Taxonomy" \
    --base-url https://standards.atlassian.net/wiki --space APMWG --parent-id 922025985 \
    --auth-user grbaues@airfrance.fr --auth-token $CONFLUENCE_TOKEN --post

    $CONFLUENCE_TOKEN = iatagb

  # Using parent URL instead of space/parent-id:
  python skos_to_confluence.py --ttl global.ttl --title "Product Taxonomy" \
    --base-url https://standards.atlassian.net/wiki \
    --parent-url "https://standards.atlassian.net/wiki/spaces/APMWG/pages/922025985/Taxonomy+Sub-group" \
    --auth-user you@example.com --auth-token $CONFLUENCE_TOKEN --post --per-scheme

"""
import os
import sys
import json
import argparse
from collections import defaultdict
from html import escape
from typing import List, Tuple, Dict, Set
from urllib.parse import urlparse

import rdflib
from rdflib import Graph, URIRef, Literal
from rdflib.namespace import RDF, SKOS, DCTERMS

try:
    import requests
except Exception:
    requests = None

# -------------------------- Utilities --------------------------

def lang_sorted(labels: List[Literal]) -> List[Tuple[str, str]]:
    pairs = []
    for l in labels:
        try:
            pairs.append((l.language or "", str(l)))
        except Exception:
            pairs.append(("", str(l)))
    pairs.sort(key=lambda x: (x[0] != "en", x[0] or "zz", x[1].lower()))
    return pairs

def qname(graph: Graph, uri: URIRef) -> str:
    try:
        return graph.namespace_manager.normalizeUri(uri)
    except Exception:
        return str(uri)

def get_text(graph: Graph, subject: URIRef, predicate: URIRef):
    return [o for o in graph.objects(subject, predicate)]

def make_table(headers: List[str], rows: List[Tuple[str, ...]]) -> str:
    th = "".join(f"<th>{escape(h)}</th>" for h in headers)
    trs = []
    for row in rows:
        tds = "".join(f"<td>{cell}</td>" for cell in row)
        trs.append(f"<tr>{tds}</tr>")
    return f"<table><colgroup>{''.join('<col/>' for _ in headers)}</colgroup><tbody><tr>{th}</tr>{''.join(trs)}</tbody></table>"

def make_toc() -> str:
    return '<ac:structured-macro ac:name="toc"><ac:parameter ac:name="minLevel">1</ac:parameter></ac:structured-macro>'

def h(level: int, text: str, anchor_id: str = None) -> str:
    text_e = escape(text)
    if anchor_id:
        return f'<h{level} id="{escape(anchor_id)}">{text_e}</h{level}>'
    return f"<h{level}>{text_e}</h{level}>"

def code_block(text: str, language: str = "none") -> str:
    return f'<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">{escape(language)}</ac:parameter><ac:plain-text-body><![CDATA[{text}]]></ac:plain-text-body></ac:structured-macro>'

def literal_lang_table(literals: List[Literal]) -> str:
    rows = []
    for lang, txt in lang_sorted(literals):
        rows.append((escape(lang or "-"), escape(txt)))
    return make_table(["Lang", "Text"], rows)

def build_hierarchy(graph: Graph, concepts: List[URIRef]):
    broader = defaultdict(set)
    narrower = defaultdict(set)
    for c in concepts:
        for b in graph.objects(c, SKOS.broader):
            broader[c].add(b)
            narrower[b].add(c)
    tops = [c for c in concepts if len(broader[c]) == 0]
    return broader, narrower, tops

def render_concept_block(graph: Graph, c: URIRef) -> str:
    parts = []
    pref = get_text(graph, c, SKOS.prefLabel)
    alt = get_text(graph, c, SKOS.altLabel)
    defs = get_text(graph, c, SKOS.definition)
    notations = get_text(graph, c, SKOS.notation)

    title = f"{qname(graph, c)} — {', '.join([f'{str(l)}' for l in pref if str(l)]) or ''}"
    parts.append(h(3, title, anchor_id=qname(graph, c)))

    if pref:
        parts.append(h(4, "Preferred labels"))
        parts.append(literal_lang_table(pref))

    if alt:
        parts.append(h(4, "Alternative labels"))
        parts.append(literal_lang_table(alt))

    if defs:
        parts.append(h(4, "Definitions"))
        parts.append(literal_lang_table(defs))

    if notations:
        rows = [(escape(str(n)),) for n in notations]
        parts.append(h(4, "Notations"))
        parts.append(make_table(["Notation"], rows))

    # Broader/Narrower links
    b_list = [f'<a href="#{escape(qname(graph, b))}">{escape(qname(graph, b))}</a>' for b in get_text(graph, c, SKOS.broader)]
    n_list = [f'<a href="#{escape(qname(graph, n))}">{escape(qname(graph, n))}</a>' for n in get_text(graph, c, SKOS.narrower)]
    if b_list or n_list:
        parts.append(h(4, "Hierarchy"))
        rows = []
        if b_list:
            rows.append(("Broader", "<br/>".join(b_list)))
        if n_list:
            rows.append(("Narrower", "<br/>".join(n_list)))
        parts.append(make_table(["Relation", "Concepts"], rows))

    # In-scheme
    in_schemes = get_text(graph, c, SKOS.inScheme)
    if in_schemes:
        rows = [(escape(qname(graph, s)),) for s in in_schemes]
        parts.append(h(4, "In Scheme"))
        parts.append(make_table(["Scheme"], rows))

    # Compact RDF preview for this subject only
    subj_triples = []
    for p, o in graph.predicate_objects(c):
        if isinstance(o, Literal):
            if o.language:
                o_disp = f"\"{str(o)}\"@{o.language}"
            elif o.datatype:
                o_disp = f"\"{str(o)}\"^^{qname(graph, o.datatype)}"
            else:
                o_disp = f"\"{str(o)}\""
        else:
            o_disp = qname(graph, o)
        subj_triples.append(f"{qname(graph, c)} {qname(graph, p)} {o_disp} .")
    parts.append(h(4, "RDF (compact preview)"))
    parts.append(code_block("\n".join(subj_triples), language="turtle"))

    return "\n".join(parts)

def render_scheme_page_storage(graph: Graph, scheme_uri: URIRef, narrower: Dict[URIRef, Set[URIRef]], tops: List[URIRef]) -> str:
    content = []
    scheme_title = qname(graph, scheme_uri)
    content.append(h(1, f"SKOS Concept Scheme: {scheme_title}"))
    content.append(make_toc())

    # Scheme metadata
    labels = get_text(graph, scheme_uri, SKOS.prefLabel)
    defs = get_text(graph, scheme_uri, DCTERMS.description) + get_text(graph, scheme_uri, SKOS.definition)
    if labels:
        content.append(h(2, "Labels"))
        content.append(literal_lang_table(labels))
    if defs:
        content.append(h(2, "Description"))
        content.append(literal_lang_table(defs))

    # Hierarchy tree
    def render_tree(node: URIRef) -> str:
        pref = get_text(graph, node, SKOS.prefLabel)
        title = (pref and str(lang_sorted(pref)[0][1])) or qname(graph, node)
        item = f"{escape(title)} <span style='color:#888'>({escape(qname(graph, node))})</span>"
        children = sorted(list(narrower.get(node, [])), key=lambda u: (str(get_text(graph, u, SKOS.prefLabel)[0]) if get_text(graph, u, SKOS.prefLabel) else qname(graph,u)).lower())
        if not children:
            return f"<li>{item}</li>"
        inner = "".join(render_tree(ch) for ch in children)
        return f"<li>{item}<ul>{inner}</ul></li>"

    content.append(h(2, "Hierarchy"))
    content.append(f"<ul>{''.join(render_tree(t) for t in tops)}</ul>")

    # All concepts table
    concepts_in_scheme = [c for c in graph.subjects(RDF.type, SKOS.Concept) if (scheme_uri in list(graph.objects(c, SKOS.inScheme)))]
    rows = []
    for c in concepts_in_scheme:
        pref = get_text(graph, c, SKOS.prefLabel)
        label_disp = ", ".join([f"{escape(txt)} [{escape(lang or '-')}]"
                                for (lang, txt) in lang_sorted(pref)]) if pref else "-"
        rows.append([f'<a href="#{escape(qname(graph, c))}">{escape(qname(graph, c))}</a>', label_disp])
    rows.sort(key=lambda r: r[1].lower())
    content.append(h(2, "Concept Index"))
    content.append(make_table(["Concept (qname)", "Labels"], rows))

    # Details
    content.append(h(2, "Concept Details"))
    for c in concepts_in_scheme:
        content.append(render_concept_block(graph, c))

    storage = f'<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" ' \
              f'xmlns:ac="http://atlassian.com/content" xmlns:ri="http://atlassian.com/resource">' \
              f'<body>{"".join(content)}</body></html>'
    return storage

def render_all_in_one_storage(graph: Graph) -> str:
    schemes = set(graph.subjects(RDF.type, SKOS.ConceptScheme))
    if not schemes:
        for s in graph.objects(None, SKOS.inScheme):
            schemes.add(s)

    concepts = list(set(graph.subjects(RDF.type, SKOS.Concept)))
    broader, narrower, tops_all = build_hierarchy(graph, concepts)

    content = [h(1, "SKOS Vocabulary — Documentation"), make_toc()]

    content.append(h(2, "Overview"))
    rows = []
    for sch in sorted(schemes, key=lambda u: qname(graph, u)):
        c_in = [c for c in concepts if sch in list(graph.objects(c, SKOS.inScheme))]
        rows.append([escape(qname(graph, sch)), str(len(c_in))])
    if rows:
        content.append(make_table(["Concept Scheme", "Concept count"], rows))

    for sch in sorted(schemes, key=lambda u: qname(graph, u)):
        c_in = [c for c in concepts if sch in list(graph.objects(c, SKOS.inScheme))]
        # tops for this scheme based on broader edges within scheme
        tops = []
        for c in c_in:
            bs = [b for b in graph.objects(c, SKOS.broader)]
            if all((b not in c_in) for b in bs):
                tops.append(c)
        storage = render_scheme_page_storage(graph, sch, narrower, tops)
        inner = storage.split("<body>", 1)[1].rsplit("</body>", 1)[0]
        content.append(inner)

    storage_root = f'<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" ' \
                   f'xmlns:ac="http://atlassian.com/content" xmlns:ri="http://atlassian.com/resource">' \
                   f'<body>{"".join(content)}</body></html>'
    return storage_root

# -------------------------- Confluence API helpers --------------------------

def parse_parent_from_url(parent_url: str):
    # Expected: https://mysite.net/wiki/spaces/APMWG/pages/922025985/Title
    try:
        parts = urlparse(parent_url)
        segs = [s for s in parts.path.split("/") if s]
        # ... wiki / spaces / <space> / pages / <id> / ...
        space = None
        parent_id = None
        for i, s in enumerate(segs):
            if s == "spaces" and i + 1 < len(segs):
                space = segs[i+1]
            if s == "pages" and i + 1 < len(segs):
                parent_id = segs[i+1]
        return space, parent_id
    except Exception:
        return None, None

def cf_headers(user: str, token: str):
    return {
        "Content-Type": "application/json",
    }, (user, token)

def cf_find_page(base_url: str, space: str, title: str, auth):
    url = f"{base_url}/rest/api/content"
    params = {"spaceKey": space, "title": title, "expand": "version,ancestors"}
    r = requests.get(url, params=params, auth=auth)
    r.raise_for_status()
    data = r.json()
    results = data.get("results", [])
    return results[0] if results else None

def cf_create_page(base_url: str, space: str, parent_id: str, title: str, body_storage: str, auth):
    url = f"{base_url}/rest/api/content"
    payload = {
        "type": "page",
        "title": title,
        "ancestors": [{"id": str(parent_id)}] if parent_id else [],
        "space": {"key": space},
        "body": {"storage": {"value": body_storage, "representation": "storage"}}
    }
    r = requests.post(url, data=json.dumps(payload), headers={"Content-Type":"application/json"}, auth=auth)
    r.raise_for_status()
    return r.json()

def cf_update_page(base_url: str, page_id: str, current_version: int, title: str, body_storage: str, auth):
    url = f"{base_url}/rest/api/content/{page_id}"
    payload = {
        "id": page_id,
        "type": "page",
        "title": title,
        "version": {"number": current_version + 1},
        "body": {"storage": {"value": body_storage, "representation": "storage"}}
    }
    r = requests.put(url, data=json.dumps(payload), headers={"Content-Type":"application/json"}, auth=auth)
    r.raise_for_status()
    return r.json()

# -------------------------- Main flow --------------------------

def main():
    ap = argparse.ArgumentParser(description="Generate and (optionally) post Confluence pages from SKOS TTL")
    ap.add_argument("--ttl", required=True, help="Path to global TTL file")
    ap.add_argument("--out", default="skos_confluence_out", help="Output directory for generated files")
    ap.add_argument("--title", default="SKOS Vocabulary", help="Title for the all-in-one entry page")
    ap.add_argument("--base-url", help="Base Confluence URL, e.g. https://mysite.net/wiki")
    ap.add_argument("--space", help="Confluence space key, e.g. APMWG")
    ap.add_argument("--parent-id", help="Parent page ID where the entry page will be created")
    ap.add_argument("--parent-url", help="Parent page URL (extracts space key and parent id)")
    ap.add_argument("--auth-user", help="Confluence username/email for basic auth")
    ap.add_argument("--auth-token", help="Confluence API token/password for basic auth")
    ap.add_argument("--post", action="store_true", help="Post to Confluence")
    ap.add_argument("--per-scheme", action="store_true", help="Also create one child page per ConceptScheme under the new/updated entry page")
    ap.add_argument("--update-if-exists", action="store_true", help="If a page with the same title exists, update it instead of creating")
    ap.add_argument("--dry-run", action="store_true", help="Print what would be posted but do not call Confluence")
    args = ap.parse_args()

    # Parse parent URL if provided
    if args.parent_url and (not args.space or not args.parent_id):
        sp, pid = parse_parent_from_url(args.parent_url)
        if sp and not args.space:
            args.space = sp
        if pid and not args.parent_id:
            args.parent_id = pid

    # Basic validation for post mode
    if args.post:
        if not requests:
            print("ERROR: 'requests' package is required for --post. pip install requests")
            sys.exit(2)
        for p in ("base_url", "space", "parent_id", "auth_user", "auth_token"):
            if not getattr(args, p):
                print(f"ERROR: --{p.replace('_','-')} is required in --post mode (or use --parent-url).")
                sys.exit(2)

    os.makedirs(args.out, exist_ok=True)

    # Load TTL
    g = Graph()
    g.parse(args.ttl, format="turtle")

    # Generate storage outputs
    all_in_one = render_all_in_one_storage(g)
    all_path = os.path.join(args.out, "storage_all_in_one.xhtml")
    with open(all_path, "w", encoding="utf-8") as f:
        f.write(all_in_one)

    # Per-scheme pages
    schemes = set(g.subjects(RDF.type, SKOS.ConceptScheme))
    if not schemes:
        for s in g.objects(None, SKOS.inScheme):
            schemes.add(s)

    concepts = list(set(g.subjects(RDF.type, SKOS.Concept)))
    broader = defaultdict(set)
    narrower = defaultdict(set)
    for c in concepts:
        for b in g.objects(c, SKOS.broader):
            broader[c].add(b)
            narrower[b].add(c)

    pages_dir = os.path.join(args.out, "pages")
    os.makedirs(pages_dir, exist_ok=True)
    per_scheme_files = []
    for sch in sorted(schemes, key=lambda u: qname(g, u)):
        c_in = [c for c in concepts if sch in list(g.objects(c, SKOS.inScheme))]
        tops = [c for c in c_in if all((b not in c_in) for b in broader[c])]
        storage = render_scheme_page_storage(g, sch, narrower, tops)
        fname = qname(g, sch).replace(":", "_").replace("/", "_")
        page_path = os.path.join(pages_dir, f"{fname}.xhtml")
        with open(page_path, "w", encoding="utf-8") as f:
            f.write(storage)
        per_scheme_files.append((str(sch), page_path))

    # Write an example payload for the entry page
    example_payload = {
        "type": "page",
        "title": args.title,
        "space": {"key": args.space or "SPACE"},
        "ancestors": [{"id": str(args.parent_id or "123456")}],
        "body": {"storage": {"value": all_in_one, "representation": "storage"}}
    }
    with open(os.path.join(args.out, "example_payload.json"), "w", encoding="utf-8") as f:
        json.dump(example_payload, f, ensure_ascii=False, indent=2)

    print(f"[OK] Generated all-in-one: {all_path}")
    print(f"[OK] Per-scheme pages dir: {pages_dir}")
    print(f"[OK] Example payload: {os.path.join(args.out, 'example_payload.json')}")

    if not args.post:
        print("\n(dry) Generation done. Use --post to publish to Confluence.")
        return

    # ---------- Post mode ----------
    auth = (args.auth_user, args.auth_token)

    # Create or update entry page under parent
    entry_title = args.title
    entry_body = all_in_one

    if args.dry_run:
        print("\n[DRY-RUN] Would create/update entry page:")
        print(f"  Base URL: {args.base_url}")
        print(f"  Space:    {args.space}")
        print(f"  ParentID: {args.parent_id}")
        print(f"  Title:    {entry_title}")
    else:
        existing = cf_find_page(args.base_url, args.space, entry_title, auth) if args.update_if_exists else None
        if existing:
            page_id = existing["id"]
            ver = existing.get("version", {}).get("number", 1)
            print(f"[INFO] Updating existing page '{entry_title}' (id={page_id}, v={ver})")
            updated = cf_update_page(args.base_url, page_id, ver, entry_title, entry_body, auth)
            entry_page_id = updated["id"]
        else:
            print(f"[INFO] Creating entry page '{entry_title}' under parent {args.parent_id}")
            created = cf_create_page(args.base_url, args.space, args.parent_id, entry_title, entry_body, auth)
            entry_page_id = created["id"]
        print(f"[OK] Entry page ID: {entry_page_id}")

    # Create per-scheme children under the entry page
    if args.per_scheme:
        if args.dry_run:
            for sch_uri, fpath in per_scheme_files:
                with open(fpath, "r", encoding="utf-8") as fh:
                    body = fh.read()
                print(f"[DRY-RUN] Would create child for scheme {sch_uri} (title from qname) under entry page.")
        else:
            # Use qname(scheme) as page title
            for sch_uri, fpath in per_scheme_files:
                with open(fpath, "r", encoding="utf-8") as fh:
                    body = fh.read()
                sch_title = qname(g, URIRef(sch_uri))
                update_children = args.update_if_exists
                if update_children:
                    existing = cf_find_page(args.base_url, args.space, sch_title, auth)
                else:
                    existing = None
                if existing:
                    page_id = existing["id"]
                    ver = existing.get("version", {}).get("number", 1)
                    print(f"[INFO] Updating child page '{sch_title}' (id={page_id})")
                    cf_update_page(args.base_url, page_id, ver, sch_title, body, auth)
                else:
                    print(f"[INFO] Creating child page '{sch_title}' under entry page {entry_page_id}")
                    cf_create_page(args.base_url, args.space, entry_page_id, sch_title, body, auth)

    print("[DONE] Post mode complete.")

if __name__ == "__main__":
    main()
