import type { Cuisine } from "@bookeat/api";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useRepository } from "../lib/repository";

/**
 * Справочник кухонь (`GET /cuisines`) — ОДИН запрос на всё приложение.
 *
 * Ключ общий у главной и у поиска нарочно: это один и тот же справочник, и
 * два разных ключа означали бы два запроса и два разных списка кухонь на
 * соседних экранах. Раньше так и было — поиск читал кухни без всякого
 * `staleTime`, то есть перезапрашивал их при каждом монтировании экрана.
 *
 * КЭШ. Справочник меняется руками и очень редко, но «редко» — не «никогда»:
 * запись, добавленную сегодня, гость обязан увидеть без переустановки. Отсюда
 * пять минут «свежести» (тот же срок, что у остальных справочных запросов —
 * каталога, города, кабинета заведения) и полчаса жизни в памяти: в пределах
 * сеанса ряд кухонь не моргает и не тратит сеть, а после — перечитывается сам.
 * Вечного кэша здесь нет: на диск справочник не пишется вовсе, поэтому
 * перезапуск приложения всегда читает его заново.
 */
export const CUISINES_QUERY_KEY = ["cuisines"] as const;

const CUISINES_STALE_MS = 5 * 60_000;
const CUISINES_GC_MS = 30 * 60_000;

export function useCuisines(): UseQueryResult<Cuisine[]> {
  const repository = useRepository();
  return useQuery<Cuisine[]>({
    queryKey: CUISINES_QUERY_KEY,
    queryFn: () => repository.getCuisines(),
    staleTime: CUISINES_STALE_MS,
    gcTime: CUISINES_GC_MS,
  });
}
