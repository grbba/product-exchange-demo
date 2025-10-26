import { useEffect, useMemo, useState } from "react";
import type { Concept } from "./domain";

const TAXONOMY_URL = "../../../../Taxonomy/export12.ttl";
const CONCEPT_PATTERN = /(<[^>]+>)\s+a\s+skos:Concept\s*;\s*([\s\S]*?)(?=\.\s*(?:\n|$))/g;

export const parseTtlConcepts = (ttl: string): Concept[] => {
  const concepts = new Map<string, Concept>();
  let match: RegExpExecArray | null;
  while ((match = CONCEPT_PATTERN.exec(ttl)) !== null) {
    const subject = match[1];
    const body = match[2];
    const uri = subject.slice(1, -1);
    const id = uri.split(/[#/]/).pop() ?? uri;
    const labelMatch = body.match(/skos:prefLabel\s+"([^"]+)"/);
    if (!labelMatch) continue;
    const altLabels = [...body.matchAll(/skos:altLabel\s+"([^"]+)"/g)].map((entry) => entry[1]);
    concepts.set(id, {
      id,
      label: labelMatch[1],
      altLabels: altLabels.length ? altLabels : undefined,
    });
  }
  return Array.from(concepts.values());
};

export const useTaxonomy = (initial: Concept[]) => {
  const [concepts, setConcepts] = useState<Concept[]>(initial);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const url = new URL(TAXONOMY_URL, import.meta.url);
        const response = await fetch(url);
        if (!response.ok) return;
        const text = await response.text();
        const parsed = parseTtlConcepts(text);
        if (parsed.length && active) {
          setConcepts(parsed);
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

  return { concepts, setConcepts, conceptLabel, orderedConcepts };
};
