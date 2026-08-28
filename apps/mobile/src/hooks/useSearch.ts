import type { SearchFilters, SearchQuery } from "@bookeat/api";
import { EMPTY_FILTERS } from "@bookeat/api";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { trackEvent } from "../lib/analytics";
import { useRepository } from "../lib/repository";
import { useAmenities } from "./useAmenities";
import { useCuisines } from "./useCuisines";

const DEBOUNCE_MS = 350;

/*
 * ЗДЕСЬ БОЛЬШЕ НЕТ ТИПА `UiOnlyFacets` (удалён 2026-08-25).
 *
 * Это была отдельная сумка «выбор, который в запрос не уходит»: повод,
 * удобства, гости. Она честно называлась, но именно из-за неё фильтры годами
 * ВЫГЛЯДЕЛИ работающими — экран давал выбрать, чип рисовался, выдача не
 * менялась. Удобства уехали в `SearchFilters.amenityIds` (сервер понимает
 * `?features=`), повод убран из шторки целиком до появления справочника
 * поводов, поле `guests` не читал никто — гости живут в
 * `SearchFilters.availability`.
 *
 * Заводить эту сумку заново НЕ НАДО. Появился новый фасет — либо его понимает
 * сервер и место ему в `SearchFilters`, либо показывать его в шторке рано.
 */

/** Сколько фильтров сейчас активно — это число и рисует бейдж на кнопке
 * фильтров, и решает, показывать ли ряд чипов. Считаются ВСЕ поля
 * `SearchFilters`, потому что все они уходят на сервер: показать чип над
 * нефильтрованным списком — то же выдуманное состояние, от которого экран уже
 * избавляли (invented-open-now). */
export function countActiveFilters(filters: SearchFilters): number {
  return (
    filters.cuisineIds.length +
    filters.amenityIds.length +
    (filters.openNowOnly ? 1 : 0) +
    (filters.onlineBookableOnly ? 1 : 0) +
    (filters.city !== undefined ? 1 : 0) +
    (filters.priceLevel !== undefined ? 1 : 0) +
    // Дата и гости — ОДИН фильтр, хотя рисуются двумя чипами: сервер
    // принимает их только парой. Без этой строки счётчик показывал 0 при
    // выбранном подборе, то есть кнопка фильтров утверждала, что ничего не
    // выбрано, пока рядом висели два чипа.
    (filters.availability !== undefined ? 1 : 0)
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

export function useSearchScreen(options?: {
  /** Коды кухонь, пришедшие ссылкой (`/search?cuisine=european,kazakh`).
   * Список, а не одно значение: фильтр по кухне мультивыбор, и с главной
   * теперь может прийти больше одной. */
  initialCuisineIds?: readonly string[];
  /** Дата и гости, пришедшие с главной (капсула над лентой). */
  initialAvailability?: SearchFilters["availability"];
}) {
  const repository = useRepository();
  const [text, setText] = useState("");
  // A `cuisine` seed from the Home «Выберите кухню» chip pre-selects that
  // filter. Read once (useState initializer): the guest is free to clear it,
  // and re-reading the param would fight that. Значение — код справочника
  // (`european`), ровно то, что понимает серверный фильтр `?cuisine=`.
  const [filters, setFilters] = useState<SearchFilters>(() => {
    let initial = EMPTY_FILTERS;
    if (options?.initialCuisineIds && options.initialCuisineIds.length > 0) {
      initial = { ...initial, cuisineIds: [...options.initialCuisineIds] };
    }
    if (options?.initialAvailability) {
      initial = { ...initial, availability: options.initialAvailability };
    }
    return initial;
  });
  const debouncedText = useDebouncedValue(text, DEBOUNCE_MS);

  // One `search` event per SETTLED, non-empty query — keyed on the debounced
  // text so it fires once the guest stops typing, not on every keystroke. An
  // empty query (the whole-catalog browse) is not a search and is not tracked.
  useEffect(() => {
    const q = debouncedText.trim();
    if (q.length === 0) return;
    // НЕ отправляем сам текст запроса: 298 из 349 событий за первые десять
    // дней оказались набранными вручную номерами телефонов (гости ищут
    // телефоном), то есть мы складывали чужие персональные данные в сторонний
    // сервис. Для продуктовых вопросов достаточно длины и того, цифровой ли
    // запрос: «ищут телефоном» видно, самого номера нет.
    trackEvent("search", {
      query_length: q.length,
      query_is_numeric: /^[\d\s()+-]+$/.test(q),
    });
  }, [debouncedText]);

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
    filters.amenityIds.length > 0 ||
    filters.openNowOnly ||
    filters.onlineBookableOnly ||
    filters.city !== undefined ||
    filters.priceLevel !== undefined ||
    filters.availability !== undefined;

  const searchQueryResult = useQuery({
    queryKey: ["search", query],
    queryFn: () => repository.searchRestaurants(query),
  });

  // Тот же справочник и тот же кэш, что у ряда кухонь на главной: гость
  // приходит сюда именно с него, и второй запрос за тем же списком — лишняя
  // сеть на телефоне (см. useCuisines).
  const cuisinesQuery = useCuisines();

  // Справочник удобств — тот же приём и тот же кэш, что у кухонь. Шторка
  // строит галочки «Удобства» ИЗ НЕГО, а ряд чипов над выдачей берёт отсюда
  // же названия: два источника подписей разошлись бы на первой же
  // переименованной записи.
  const amenitiesQuery = useAmenities();

  const citiesQuery = useQuery({
    queryKey: ["cities"],
    queryFn: () => repository.getCities(),
  });

  return {
    text,
    setText,
    filters,
    setFilters,
    activeFilterCount: countActiveFilters(filters),
    hasActiveSearch,
    isTyping: text !== debouncedText,
    searchQueryResult,
    cuisinesQuery,
    amenitiesQuery,
    citiesQuery,
  };
}
