"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { CuisineDictionaryEntry } from "@bookeat/api/admin";

import { apiClient } from "./api";

/**
 * Справочник кухонь.
 *
 * `GET /cuisines` — публичный роут (RegisterPublic в bootstrap/app.go), поэтому
 * один и тот же хук годится и суперадмину, и управляющему заведения: список
 * кухонь для выбора у них общий, как и должно быть у справочника.
 *
 * ВАЖНО про «сервер ещё не выложен»: пока ручки нет, запрос вернёт ошибку. Ни
 * один экран не должен от этого падать — все читают `data ?? []` и работают
 * дальше (фильтр каталога откатывается на прежний способ, выбор кухонь честно
 * говорит, что справочник пуст).
 */
export function useCuisineDictionary(): UseQueryResult<CuisineDictionaryEntry[]> {
  return useQuery({
    queryKey: ["cuisines"],
    queryFn: () => apiClient.listCuisines(),
    // Справочник меняется руками и очень редко: рефетч на каждый фокус вкладки
    // здесь только моргает списком.
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Кухни ОДНОГО заведения в его порядке (первая — главная). Отдельная ручка,
 * не часть PATCH заведения. */
export function useVenueCuisines(
  restaurantId: string | null,
): UseQueryResult<CuisineDictionaryEntry[]> {
  return useQuery({
    queryKey: ["venue-cuisines", restaurantId],
    queryFn: () => apiClient.getRestaurantCuisines(restaurantId!),
    enabled: Boolean(restaurantId),
  });
}

/** Запись набора кухонь заведения. PUT замещает набор ЦЕЛИКОМ, поэтому вызывать
 * его можно только с полным списком — и только прочитав текущий. */
export function useSetVenueCuisines() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ restaurantId, ids }: { restaurantId: string; ids: readonly string[] }) =>
      apiClient.setRestaurantCuisines(restaurantId, ids),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["venue-cuisines", variables.restaurantId],
      });
      // Строка cuisine_type в каталоге пересобирается сервером из набора —
      // список заведений после этого устарел.
      void queryClient.invalidateQueries({ queryKey: ["venue-catalog"] });
    },
  });
}
