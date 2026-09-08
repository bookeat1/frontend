"use client";

import { EMPTY_FILTERS, type RestaurantSummary } from "@bookeat/api/client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { isApiConfigured, repository } from "@web/lib/api";
import { OCEAN_BASKET_SEARCH_TEXT, isOceanBasketVenue } from "./ocean-basket-content";

/**
 * ЖИВЫЕ ТОЧКИ Ocean Basket — `GET /restaurants/search?q=Ocean Basket`, тот же
 * приём и та же причина, что у мобильного `use-ocean-basket-venues.ts`:
 * идентификаторы точек на тесте и на проде разные, зашитый id молча дал бы
 * пустую страницу ровно там, где её будут смотреть гости. Порядок сервера
 * сохраняется — нумерация «01/02/03» идёт по нему.
 */
export function useOceanBasketVenues(): UseQueryResult<RestaurantSummary[]> {
  return useQuery<RestaurantSummary[]>({
    queryKey: ["ocean-basket", "venues"],
    queryFn: async () => {
      const result = await repository.searchRestaurants({
        text: OCEAN_BASKET_SEARCH_TEXT,
        filters: EMPTY_FILTERS,
      });
      return result.items.filter(isOceanBasketVenue);
    },
    enabled: isApiConfigured,
    // Каталог заведений меняется медленно — тот же staleTime, что у подборок
    // гастрогида и статей на сайте.
    staleTime: 5 * 60_000,
  });
}
