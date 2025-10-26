import { useEffect, useMemo, useState } from "react";
import type { Collection, Concept } from "./domain";

const TAXONOMY_URL = "../../../../Taxonomy/export12.ttl";

type Literal = { value: string; lang?: string };

const literalPattern = /("""[\s\S]*?"""|"[^"]*")(?:@([a-zA-Z-]+))?/g;

const extractLiterals = (body: string, predicate: string): Literal[] => {
  const regex = new RegExp(`${predicate}\\s+([^;]+)`, "gi");
  const literals: Literal[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    const raw = match[1];
    let literalMatch: RegExpExecArray | null;
    while ((literalMatch = literalPattern.exec(raw)) !== null) {
      const token = literalMatch[1];
      const lang = literalMatch[2]?.toLowerCase();
      const value = token.startsWith("\"\"\"")
        ? token.slice(3, -3)
        : token.slice(1, -1);
      literals.push({ value: value.trim(), lang });
    }
  }
  return literals;
};

const pickLiteralValue = (entries: Literal[], preferredLang = "en") => {
  if (!entries.length) return undefined;
  const normalized = preferredLang.toLowerCase();
  const preferred = entries.find((entry) => entry.lang === normalized);
  return (preferred ?? entries[0]).value;
};

const normalizeToken = (token: string) => {
  const cleaned = token.trim().replace(/[.,;]+$/, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("<") && cleaned.endsWith(">")) {
    const uri = cleaned.slice(1, -1);
    const parts = uri.split(/[#/]/);
    return parts[parts.length - 1] || uri;
  }
  if (cleaned.includes(":")) {
    const parts = cleaned.split(":");
    return parts[parts.length - 1] || cleaned;
  }
  return cleaned;
};

const extractIris = (body: string, predicate: string): string[] => {
  const regex = new RegExp(`${predicate}\\s+([^;]+)`, "gi");
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    const raw = match[1];
    for (const fragment of raw.split(",")) {
      const normalized = normalizeToken(fragment);
      if (normalized) values.push(normalized);
    }
  }
  return Array.from(new Set(values));
};

const toConceptId = (subject: string) => normalizeToken(subject) ?? subject;

export const parseTtl = (ttl: string): { concepts: Concept[]; collections: Collection[] } => {
  const conceptPattern = /([^\s]+)\s+a\s+skos:Concept\s*;([\s\S]*?)(?=\.\s*(?:\n|$))/gi;
  const collectionPattern = /([^\s]+)\s+a\s+skos:Collection\s*;([\s\S]*?)(?=\.\s*(?:\n|$))/gi;

  const concepts = new Map<string, Concept>();
  let match: RegExpExecArray | null;

  while ((match = conceptPattern.exec(ttl)) !== null) {
    const subject = match[1];
    const body = match[2];
    const id = toConceptId(subject);
    const prefLabels = extractLiterals(body, "skos:prefLabel");
    const label = pickLiteralValue(prefLabels) ?? id;
    const altLabels = extractLiterals(body, "skos:altLabel").map((entry) => entry.value);
    const definition = pickLiteralValue(extractLiterals(body, "skos:definition"));
    const broader = extractIris(body, "skos:broader");
    const narrower = extractIris(body, "skos:narrower");
    const topConceptOf = extractIris(body, "skos:topConceptOf");
    const inSchemes = extractIris(body, "skos:inScheme");

    concepts.set(id, {
      id,
      label,
      altLabels: altLabels.length ? Array.from(new Set(altLabels)) : undefined,
      definition,
      broader: broader.length ? broader : undefined,
      narrower: narrower.length ? narrower : undefined,
      topConceptOf: topConceptOf.length ? topConceptOf : undefined,
      inSchemes: inSchemes.length ? inSchemes : undefined,
    });
  }

  const collections: Collection[] = [];
  while ((match = collectionPattern.exec(ttl)) !== null) {
    const subject = match[1];
    const body = match[2];
    const id = toConceptId(subject);
    const label = pickLiteralValue(extractLiterals(body, "skos:prefLabel")) ?? id;
    const members = extractIris(body, "skos:member");
    collections.push({ id, label, members });
  }

  return { concepts: Array.from(concepts.values()), collections };
};

export const useTaxonomy = (initialConcepts: Concept[], initialCollections: Collection[]) => {
  const [concepts, setConcepts] = useState<Concept[]>(initialConcepts);
  const [collections, setCollections] = useState<Collection[]>(initialCollections);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const url = new URL(TAXONOMY_URL, import.meta.url);
        const response = await fetch(url);
        if (!response.ok) return;
        const text = await response.text();
        const parsed = parseTtl(text);
        if (parsed.concepts.length && active) {
          setConcepts(parsed.concepts);
          if (parsed.collections.length) {
            setCollections(parsed.collections);
          }
        }
      } catch (error) {
        console.warn("Failed to load taxonomy export.", error);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const conceptLabel = useMemo(
    () => (id: string) => concepts.find((concept) => concept.id === id)?.label ?? id,
    [concepts]
  );

  const orderedConcepts = useMemo(
    () => [...concepts].sort((a, b) => a.label.localeCompare(b.label)),
    [concepts]
  );

  return { concepts, setConcepts, collections, setCollections, conceptLabel, orderedConcepts };
};
