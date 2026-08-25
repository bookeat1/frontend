"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { VenueFeatureDictionaryEntry } from "@bookeat/api/admin";

import { apiClient } from "./api";

/**
 * Справочник удобств для чтения.
 *
 * `GET /venue-features` смонтирован публично (`RegisterPublic` в
 * bootstrap/app.go), поэтому один хук годится и суперадмину, и управляющему
 * заведения: список для выбора у них общий, как и должно быть у справочника.
 *
 * ВАЖНО: ни один экран не имеет права падать, если справочник не ответил. Все
 * читатели берут `data ?? []` — фильтр каталога тогда просто не показывает
 * пункт «Удобство», а выбор честно говорит, что справочник пуст.
 */
export function useVenueFeatureDictionary(): UseQueryResult<VenueFeatureDictionaryEntry[]> {
  return useQuery({
    queryKey: ["venue-features"],
    queryFn: () => apiClient.listVenueFeatures(),
    // Справочник правят руками и очень редко: рефетч на каждый фокус вкладки
    // здесь только моргает списком.
    staleTime: 5 * 60_000,
    retry: false,
  });
}
