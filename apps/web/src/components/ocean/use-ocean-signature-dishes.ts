"use client";

import type { MenuDish, RestaurantSummary } from "@bookeat/api/client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

import { isApiConfigured, repository } from "@web/lib/api";
import { OCEAN_SIGNATURE_DISHES, findMenuDish } from "./ocean-basket-content";

/** Состояние блока «Фирменный улов» — `ready.dishes` идёт по индексу
 * `OCEAN_SIGNATURE_DISHES`; `undefined` на месте значит «блюда с таким именем
 * в меню нет», а не ошибку сети. */
export type OceanSignatureDishesState =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "ready"; dishes: readonly (MenuDish | undefined)[] };

/**
 * ЖИВЫЕ БЛЮДА «Фирменного улова»: меню ПЕРВОЙ точки бренда из выдачи поиска
 * (`GET /restaurants/:id/menu`). Пока точки грузятся — грузится и блок; точки
 * не загрузились — блок в ошибке (без точки нечего спрашивать); точек нет —
 * блок готов, но каждое блюдо `undefined`.
 */
export function useOceanSignatureDishes(venues: UseQueryResult<RestaurantSummary[]>): {
  state: OceanSignatureDishesState;
  refetch: () => Promise<unknown>;
} {
  const firstVenueId = venues.data?.[0]?.id;
  const menu = useQuery({
    queryKey: ["ocean-basket", "menu", firstVenueId],
    queryFn: () => repository.getMenuSections(firstVenueId as string),
    enabled: isApiConfigured && Boolean(firstVenueId),
  });

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
