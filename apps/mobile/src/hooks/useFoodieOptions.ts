import type { FoodieProfileOptions } from "@bookeat/api";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useRepository } from "../lib/repository";

/**
 * Фуди-профиль: живой справочник плиток визарда (`GET
 * /foodie-profile/options`, спека `foodie-profile-admin-dictionaries-
 * 20260916`). До этой задачи четыре экрана визарда (`app/foodie-profile/
 * {cuisine,diet,allergies,budget}.tsx`) рисовали вшитый список из
 * `foodie-profile-options.ts` — теперь список редактирует платформенный
 * админ, и весь смысл задачи в том, что новая/переименованная/скрытая плитка
 * доходит до гостя без релиза сборки.
 *
 * КЭШ — тот же режим, что `useCuisines`, и по той же причине: справочник
 * правится руками и редко, «через 5 минут» — обещание из спеки (0), а не
 * гарантия сервера (кэша на сервере нет, см. 6.10 спеки). Пять минут свежести
 * и полчаса жизни в памяти совпадают с остальными справочными запросами
 * приложения (кухни, удобства, каталог).
 */
export const FOODIE_OPTIONS_QUERY_KEY = ["foodie-options"] as const;

const FOODIE_OPTIONS_STALE_MS = 5 * 60_000;
const FOODIE_OPTIONS_GC_MS = 30 * 60_000;

export function useFoodieOptions(): UseQueryResult<FoodieProfileOptions> {
  const repository = useRepository();
  return useQuery<FoodieProfileOptions>({
    queryKey: FOODIE_OPTIONS_QUERY_KEY,
    queryFn: () => repository.getFoodieProfileOptions(),
    staleTime: FOODIE_OPTIONS_STALE_MS,
    gcTime: FOODIE_OPTIONS_GC_MS,
  });
}
