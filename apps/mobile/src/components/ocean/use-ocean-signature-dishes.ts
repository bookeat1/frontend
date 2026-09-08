import type { MenuDish, RestaurantSummary } from "@bookeat/api";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { useMenuSections } from "../../hooks/useBooking";
import { OCEAN_SIGNATURE_DISHES, findMenuDish } from "./ocean-basket-content";

/**
 * Состояние блока «Фирменный улов».
 *
 * `ready.dishes` идёт ПО ИНДЕКСУ `OCEAN_SIGNATURE_DISHES`: `undefined` на
 * месте — блюда с таким именем в меню нет, и карточка рисуется нейтральной.
 * Это не ошибка сети, а факт о меню, поэтому у него своё место, а не
 * `status: "error"`.
 */
export type OceanSignatureDishesState =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "ready"; dishes: readonly (MenuDish | undefined)[] };

/**
 * ЖИВЫЕ БЛЮДА «Фирменного улова»: меню ПЕРВОЙ точки бренда из выдачи поиска
 * (`GET /restaurants/:id/menu` через `useMenuSections` — тот же запрос и тот
 * же кэш, что у шага предзаказа).
 *
 * Зависит от запроса точек: пока точки грузятся — грузится и блок; точки не
 * загрузились — и блок в ошибке, потому что без точки нечего спрашивать;
 * точек нет вовсе — блок готов, но каждое блюдо `undefined` (нейтральные
 * карточки, а не ошибка: каталог просто пуст).
 */
export function useOceanSignatureDishes(venues: UseQueryResult<RestaurantSummary[]>): {
  state: OceanSignatureDishesState;
  /** Перечитать меню — для жеста обновления страницы. */
  refetch: () => Promise<unknown>;
} {
  const firstVenueId = venues.data?.[0]?.id;
  const menu = useMenuSections(firstVenueId);

  const state = useMemo<OceanSignatureDishesState>(() => {
    if (venues.isLoading) return { status: "loading" };
    if (venues.isError) return { status: "error", retry: () => void venues.refetch() };
    if (!firstVenueId) {
      return { status: "ready", dishes: OCEAN_SIGNATURE_DISHES.map(() => undefined) };
    }
    if (menu.isLoading) return { status: "loading" };
    if (menu.isError || !menu.data) return { status: "error", retry: () => void menu.refetch() };
    const sections = menu.data;
    return {
      status: "ready",
      dishes: OCEAN_SIGNATURE_DISHES.map((dish) => findMenuDish(sections, dish.menuName)),
    };
  }, [venues, firstVenueId, menu]);

  return { state, refetch: menu.refetch };
}
