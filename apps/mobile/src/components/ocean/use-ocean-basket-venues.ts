import { EMPTY_FILTERS, type RestaurantSummary } from "@bookeat/api";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useRepository } from "../../lib/repository";
import { OCEAN_BASKET_SEARCH_TEXT, isOceanBasketVenue } from "./ocean-basket-content";

/**
 * ЖИВЫЕ ТОЧКИ Ocean Basket для фирменной страницы —
 * `GET /restaurants/search?q=Ocean Basket` через `repository.searchRestaurants`.
 *
 * ПОЧЕМУ ПОИСК, А НЕ ЗАШИТЫЕ ID. Владелец назвал два идентификатора тестовой
 * базы, но на проде у тех же ресторанов другие UUID: зашитый id дал бы пустую
 * страницу ровно в той среде, где её будут смотреть гости. Поиск по имени
 * бренда работает в обеих и сам подхватывает новую точку, когда её заведут
 * (на тесте 2026-09-01 их уже ТРИ, а не два: Panfilova, Dostyk Plaza,
 * Mega Center — столько же, сколько нарисовано в макете).
 *
 * ПОЧЕМУ НЕ ПОДБОРКА ГАСТРОГИДА. Подборки со слагом `ocean-basket` в базе нет
 * (`GET /gastroguide/collections/ocean-basket` → 404 на тесте 2026-09-01), и
 * заводить её ради вёрстки — задача редакции, а не клиента.
 *
 * Выдача сервера ФИЛЬТРУЕТСЯ по имени (см. isOceanBasketVenue): поиск умеет
 * попадать по меню, и чужое заведение на странице бренда было бы враньём.
 * Порядок сервера сохраняется — нумерация точек «01/02/03» идёт по нему.
 */
export function useOceanBasketVenues(): UseQueryResult<RestaurantSummary[]> {
  const repository = useRepository();
  return useQuery<RestaurantSummary[]>({
    queryKey: ["ocean-basket", "venues"],
    queryFn: async () => {
      const result = await repository.searchRestaurants({
        text: OCEAN_BASKET_SEARCH_TEXT,
        filters: EMPTY_FILTERS,
      });
      return result.items.filter(isOceanBasketVenue);
    },
    // Каталог заведений меняется медленно — тот же staleTime, что у подборок
    // гастрогида и статей.
    staleTime: 5 * 60_000,
  });
}
