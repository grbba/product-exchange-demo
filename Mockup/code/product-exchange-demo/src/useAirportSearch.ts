import { useEffect, useMemo, useRef, useState } from "react";

export type AirportSuggestion = {
  id: string;
  iataCode?: string;
  name?: string;
  subType?: string;
  cityName?: string;
  countryCode?: string;
};

type UseAirportSearchState = {
  results: AirportSuggestion[];
  loading: boolean;
};

const DEBOUNCE_MS = 200;

export const useAirportSearch = (query: string, limit = 10): UseAirportSearchState => {
  const [results, setResults] = useState<AirportSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const lastController = useRef<AbortController | null>(null);
  const trimmedQuery = query.trim();

  const params = useMemo(() => {
    const search = new URLSearchParams();
    search.set("q", trimmedQuery);
    search.set("limit", String(limit));
    return search.toString();
  }, [trimmedQuery, limit]);

  useEffect(() => {
    if (!trimmedQuery) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const controller = new AbortController();
    lastController.current?.abort();
    lastController.current = controller;

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/airports/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed airport search: ${response.status}`);
        }
        const payload = await response.json();
        const suggestions: AirportSuggestion[] =
          payload?.data?.map((item: any) => ({
            id: item.id ?? item.iataCode ?? crypto.randomUUID(),
            iataCode: item.iataCode,
            name: item.name,
            subType: item.subType,
            cityName: item.address?.cityName,
            countryCode: item.address?.countryCode,
          })) ?? [];
        setResults(suggestions);
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") {
          console.error("Airport search error", error);
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [params, trimmedQuery]);

  return { results, loading };
};

