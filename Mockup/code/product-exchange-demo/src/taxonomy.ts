import { useEffect, useMemo, useState } from "react";
import type { Collection, Concept } from "./domain";

const TAXONOMY_URL = "../../../../Taxonomy/export12.ttl";

type Literal = { value: string; lang?: string };

const pickLiteralValue = (entries: Literal[], preferredLang = "en") => {
  if (!entries.length) return undefined;
  const normalized = preferredLang.toLowerCase();
  const preferred = entries.find((entry) => entry.lang === normalized);
  return (preferred ?? entries[0]).value;
};

type QuoteState = null | "single" | "triple";

const startsTripleQuote = (text: string, index: number) => text.startsWith("\"\"\"", index);

const splitOnDelimiter = (input: string, delimiter: string): string[] => {
  const parts: string[] = [];
  let current = "";
  let state: QuoteState = null;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === "\"") {
      const isTriple = startsTripleQuote(input, i);
      if (state === "triple") {
        if (isTriple) {
          current += "\"\"\"";
          i += 2;
          state = null;
        } else {
          current += char;
        }
        continue;
      }
      if (state === "single") {
        current += char;
        if (input[i - 1] !== "\\") {
          state = null;
        }
        continue;
      }
      if (isTriple) {
        current += "\"\"\"";
        i += 2;
        state = "triple";
        continue;
      }
      state = "single";
      current += char;
      continue;
    }

    if (char === delimiter && !state) {
      parts.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  parts.push(current);
  return parts;
};

const splitStatements = (input: string): string[] => {
  const statements: string[] = [];
  let current = "";
  let state: QuoteState = null;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === "\"") {
      const isTriple = startsTripleQuote(input, i);
      if (state === "triple") {
        if (isTriple) {
          current += "\"\"\"";
          i += 2;
          state = null;
        } else {
          current += char;
        }
        continue;
      }
      if (state === "single") {
        current += char;
        if (input[i - 1] !== "\\") {
          state = null;
        }
        continue;
      }
      if (isTriple) {
        current += "\"\"\"";
        i += 2;
        state = "triple";
        continue;
      }
      state = "single";
      current += char;
      continue;
    }

    if (char === "." && !state) {
      current += char;
      const nextChar = input[i + 1];
      if (!nextChar || /\s/.test(nextChar)) {
        const statement = current.trim();
        if (statement) statements.push(statement);
        current = "";
      }
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing) statements.push(trailing);

  return statements;
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

const parseLiteral = (value: string): Literal | undefined => {
  const trimmed = value.trim();
  const match = trimmed.match(/^("""[\s\S]*?"""|"[^"]*")(?:@([a-zA-Z-]+))?$/);
  if (!match) return undefined;
  const token = match[1];
  const lang = match[2]?.toLowerCase();
  const content = token.startsWith("\"\"\"") ? token.slice(3, -3) : token.slice(1, -1);
  return { value: content.trim(), lang };
};

const parsePredicateSegment = (segment: string): { predicate: string; objects: string[] } | null => {
  const trimmed = segment.trim();
  if (!trimmed) return null;
  const firstSpace = trimmed.indexOf(" ");
  if (firstSpace === -1) return null;
  const predicate = trimmed.slice(0, firstSpace);
  const rest = trimmed.slice(firstSpace + 1).trim();
  if (!rest) return null;
  const objects = splitOnDelimiter(rest, ",")
    .map((item) => item.trim())
    .filter((item) => item.length);
  return { predicate, objects };
};

const toConceptId = (subject: string) => normalizeToken(subject) ?? subject;

export const parseTtl = (ttl: string): { concepts: Concept[]; collections: Collection[] } => {
  const concepts = new Map<string, Concept>();
  const collections: Collection[] = [];

  for (const statement of splitStatements(ttl)) {
    if (!statement || statement.startsWith("@")) continue;

    const subjectMatch = statement.match(/^([^\s]+)\s+/);
    if (!subjectMatch) continue;
    const subjectToken = subjectMatch[1];
    const id = toConceptId(subjectToken);

    const remainder = statement.slice(subjectMatch[0].length).trim();
    const withoutDot = remainder.endsWith(".") ? remainder.slice(0, -1).trim() : remainder;

    const segments = splitOnDelimiter(withoutDot, ";")
      .map((part) => part.trim())
      .filter((part) => part.length);

    if (!segments.length) continue;

    const [typeSegment, ...propertySegments] = segments;
    const typeLower = typeSegment.toLowerCase();
    const isConcept = /\ba\s+skos:concept\b/.test(typeLower);
    const isCollection = /\ba\s+skos:collection\b/.test(typeLower);

    if (!isConcept && !isCollection) continue;

    const prefLabels: Literal[] = [];
    const rdfsLabels: Literal[] = [];
    const altLabels: string[] = [];
    const definitions: Literal[] = [];
    const broader: string[] = [];
    const narrower: string[] = [];
    const related: string[] = [];
    const topConceptOf: string[] = [];
    const inSchemes: string[] = [];
    const members: string[] = [];

    for (const segment of propertySegments) {
      const parsed = parsePredicateSegment(segment);
      if (!parsed) continue;
      const { predicate, objects } = parsed;
      if (!objects.length) continue;

      switch (predicate) {
        case "rdfs:label":
          for (const obj of objects) {
            const literal = parseLiteral(obj);
            if (literal) rdfsLabels.push(literal);
          }
          break;
        case "skos:prefLabel":
          for (const obj of objects) {
            const literal = parseLiteral(obj);
            if (literal) prefLabels.push(literal);
          }
          break;
        case "skos:altLabel":
          for (const obj of objects) {
            const literal = parseLiteral(obj);
            if (literal) altLabels.push(literal.value);
          }
          break;
        case "skos:definition":
          for (const obj of objects) {
            const literal = parseLiteral(obj);
            if (literal) definitions.push(literal);
          }
          break;
        case "skos:broader":
          for (const obj of objects) {
            const value = normalizeToken(obj);
            if (value) broader.push(value);
          }
          break;
        case "skos:narrower":
          for (const obj of objects) {
            const value = normalizeToken(obj);
            if (value) narrower.push(value);
          }
          break;
        case "skos:related":
          for (const obj of objects) {
            const value = normalizeToken(obj);
            if (value) related.push(value);
          }
          break;
        case "skos:topConceptOf":
          for (const obj of objects) {
            const value = normalizeToken(obj);
            if (value) topConceptOf.push(value);
          }
          break;
        case "skos:inScheme":
          for (const obj of objects) {
            const value = normalizeToken(obj);
            if (value) inSchemes.push(value);
          }
          break;
        case "skos:member":
          for (const obj of objects) {
            const value = normalizeToken(obj);
            if (value) members.push(value);
          }
          break;
        default:
          break;
      }
    }

    if (isConcept) {
      const label = pickLiteralValue(rdfsLabels) ?? pickLiteralValue(prefLabels) ?? id;
      const definition = pickLiteralValue(definitions);
      concepts.set(id, {
        id,
        label,
        altLabels: altLabels.length ? Array.from(new Set(altLabels)) : undefined,
        definition,
        broader: broader.length ? Array.from(new Set(broader)) : undefined,
        narrower: narrower.length ? Array.from(new Set(narrower)) : undefined,
        related: related.length ? Array.from(new Set(related)) : undefined,
        topConceptOf: topConceptOf.length ? Array.from(new Set(topConceptOf)) : undefined,
        inSchemes: inSchemes.length ? Array.from(new Set(inSchemes)) : undefined,
      });
    } else if (isCollection) {
      const label = pickLiteralValue(rdfsLabels) ?? pickLiteralValue(prefLabels) ?? id;
      collections.push({
        id,
        label,
        members: members.length ? Array.from(new Set(members)) : [],
      });
    }
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
