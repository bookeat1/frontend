import type { SearchFilters, SearchQuery } from "@bookeat/api";
import { EMPTY_FILTERS } from "@bookeat/api";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useRepository } from "../lib/repository";

const DEBOUNCE_MS = 350;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

export function useSearchScreen() {
  const repository = useRepository();
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const debouncedText = useDebouncedValue(text, DEBOUNCE_MS);

  const query: SearchQuery = useMemo(
    () => ({ text: debouncedText, filters }),
    [debouncedText, filters],
  );

  const hasActiveSearch =
    debouncedText.trim().length > 0 ||
    filters.cuisineIds.length > 0 ||
    filters.openNowOnly ||
    filters.city !== undefined ||
    filters.priceLevel !== undefined;

  const searchQueryResult = useQuery({
    queryKey: ["search", query],
    queryFn: () => repository.searchRestaurants(query),
    enabled: hasActiveSearch,
  });

  const recentQuery = useQuery({
    queryKey: ["recent-searches"],
    queryFn: () => repository.getRecentSearches(),
    enabled: !hasActiveSearch,
  });

  const popularQuery = useQuery({
    queryKey: ["popular-searches"],
    queryFn: () => repository.getPopularSearches(),
    enabled: !hasActiveSearch,
  });

  const cuisinesQuery = useQuery({
    queryKey: ["cuisines"],
    queryFn: () => repository.getCuisines(),
  });

  const citiesQuery = useQuery({
    queryKey: ["cities"],
    queryFn: () => repository.getCities(),
  });

  return {
    text,
    setText,
    filters,
    setFilters,
    hasActiveSearch,
    isTyping: text !== debouncedText,
    searchQueryResult,
    recentQuery,
    popularQuery,
    cuisinesQuery,
    citiesQuery,
  };
}
