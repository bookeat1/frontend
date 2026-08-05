import type { SearchFilters, SearchQuery } from "@bookeat/api";
import { EMPTY_FILTERS } from "@bookeat/api";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useRepository } from "../lib/repository";

const DEBOUNCE_MS = 350;

/**
 * Фасеты фильтра, которых В ПОИСКОВОМ ЗАПРОСЕ БЭКЕНДА ПОКА НЕТ: повод,
 * удобства и число гостей. Шторка «Фильтры» даёт их выбрать и запоминает
 * выбор между открытиями, но в `SearchQuery` они не уходят и результат не
 * сужают — см. комментарии track-C в FilterSheet.tsx. Держим их отдельным
 * типом, а не в `SearchFilters` из @bookeat/api, ровно чтобы нельзя было
 * случайно отправить их на сервер.
 */
export interface UiOnlyFacets {
  /** id поводов (см. i18n `search.filters.occasion`). */
  occasionIds: string[];
  /** id удобств (см. i18n `search.filters.amenities`). */
  amenityIds: string[];
  /** Число гостей из верхней пилюли. Не фильтр — это намерение брони, поэтому
   * дефолт 2 сохраняется даже при сбросе фильтров. */
  guests: number;
}

export const EMPTY_UI_FACETS: UiOnlyFacets = {
  occasionIds: [],
  amenityIds: [],
  guests: 2,
};

/** Сколько ПОДДЕРЖИВАЕМЫХ бэкендом фильтров сейчас активно — это число и
 * рисует бейдж на кнопке фильтров, и решает, показывать ли ряд чипов. Повод и
 * удобства сюда НЕ входят намеренно: они не сужают выдачу, а показать чип
 * «Свидание» над нефильтрованным списком — то же выдуманное состояние, от
 * которого экран уже избавляли (invented-open-now). */
export function countActiveFilters(filters: SearchFilters): number {
  return (
    filters.cuisineIds.length +
    (filters.openNowOnly ? 1 : 0) +
    (filters.onlineBookableOnly ? 1 : 0) +
    (filters.city !== undefined ? 1 : 0) +
    (filters.priceLevel !== undefined ? 1 : 0)
  );
}

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
  // Повод/удобства/гости: живут рядом с фильтрами, но отдельным состоянием,
  // потому что в поиск не уходят (track-C). Шторка читает их как черновик и
  // возвращает применённые обратно сюда — так выбор переживает закрытие.
  const [uiFacets, setUiFacets] = useState<UiOnlyFacets>(EMPTY_UI_FACETS);
  const debouncedText = useDebouncedValue(text, DEBOUNCE_MS);

  const query: SearchQuery = useMemo(
    () => ({ text: debouncedText, filters }),
    [debouncedText, filters],
  );

  /**
   * Есть ли у гостя активный запрос — нужно только для копирайта пустого
   * результата («ничего не нашлось» против «каталог пуст»). Сам запрос
   * выполняется ВСЕГДА: пустой `q` — это законный вызов
   * `GET /restaurants/search`, который отдаёт весь каталог (проверено
   * 2026-07-26: 24 заведения). Раньше при пустой строке запрос был выключен, и
   * экран поиска (он же вкладка «Поиск» и переход «Смотреть все») открывался
   * пустым — с тремя выдуманными «популярными запросами», каждый из которых
   * давал ноль результатов.
   */
  const hasActiveSearch =
    debouncedText.trim().length > 0 ||
    filters.cuisineIds.length > 0 ||
    filters.openNowOnly ||
    filters.onlineBookableOnly ||
    filters.city !== undefined ||
    filters.priceLevel !== undefined;

  const searchQueryResult = useQuery({
    queryKey: ["search", query],
    queryFn: () => repository.searchRestaurants(query),
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
    uiFacets,
    setUiFacets,
    activeFilterCount: countActiveFilters(filters),
    hasActiveSearch,
    isTyping: text !== debouncedText,
    searchQueryResult,
    cuisinesQuery,
    citiesQuery,
  };
}
