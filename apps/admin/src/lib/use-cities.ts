"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { CityDictionaryEntry } from "@bookeat/api/admin";

import { apiClient } from "./api";

/**
 * Справочник городов для чтения.
 *
 * `GET /cities` смонтирован публично (`RegisterPublic` в bootstrap/app.go),
 * поэтому один хук годится и суперадмину, и управляющему заведения. Панель
 * ходит с `?format=full`: без параметра тот же адрес отдаёт голый массив
 * названий — замороженный контракт сборки в магазине.
 *
 * ВАЖНО: ни один экран не имеет права падать, если справочник не ответил. Все
 * читатели берут `data ?? []` — фильтр каталога откатывается на прежний способ
 * (города из данных заведений), а форма заведения — на ввод текстом.
 */
export function useCityDictionary(): UseQueryResult<CityDictionaryEntry[]> {
  return useQuery({
    queryKey: ["cities"],
    queryFn: () => apiClient.listCities(),
    // Справочник правят руками и очень редко: рефетч на каждый фокус вкладки
    // здесь только моргает списком.
    staleTime: 5 * 60_000,
    retry: false,
  });
}
