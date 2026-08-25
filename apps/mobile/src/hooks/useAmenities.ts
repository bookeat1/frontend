import type { Amenity } from "@bookeat/api";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useRepository } from "../lib/repository";

/**
 * Справочник удобств (`GET /venue-features`) — ОДИН запрос на всё приложение,
 * ровно по образцу справочника кухонь (см. useCuisines).
 *
 * Раньше список удобств был константой `AMENITY_IDS` в `FilterSheet.tsx` из
 * семи значений с подписями из словаря. Это ломалось дважды: справочник на
 * сервере содержит девятнадцать записей, а подписи в словаре расходились с
 * теми, что видит владелец в кабинете. Список удобств обязан приходить
 * оттуда же, откуда его понимает фильтр.
 *
 * КЭШ. Те же пять минут «свежести» и полчаса жизни в памяти, что у кухонь:
 * справочник меняют руками и редко, но добавленное сегодня удобство гость
 * должен увидеть без переустановки. На диск не пишется — перезапуск
 * приложения перечитывает его заново.
 *
 * ЯЗЫК в ключ НЕ входит намеренно: подписи выбирает репозиторий по текущему
 * языку, а смена языка в приложении перезагружает JS-бандл целиком (см.
 * `reloadApp` в packages/i18n), то есть и этот кэш вместе с ним.
 */
export const AMENITIES_QUERY_KEY = ["amenities"] as const;

const AMENITIES_STALE_MS = 5 * 60_000;
const AMENITIES_GC_MS = 30 * 60_000;

export function useAmenities(): UseQueryResult<Amenity[]> {
  const repository = useRepository();
  return useQuery<Amenity[]>({
    queryKey: AMENITIES_QUERY_KEY,
    queryFn: () => repository.getAmenities(),
    staleTime: AMENITIES_STALE_MS,
    gcTime: AMENITIES_GC_MS,
  });
}
