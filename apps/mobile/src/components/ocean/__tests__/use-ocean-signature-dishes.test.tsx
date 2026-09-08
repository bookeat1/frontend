import type { MenuSection, RestaurantSummary } from "@bookeat/api";
import type { UseQueryResult } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Хук живых блюд «Фирменного улова»: как состояние точек и состояние меню
 * складываются в одно. Меню подменяется результатом запроса — сам матчинг
 * по имени проверяется в `ocean-basket-content.test.ts`.
 */

const menuState = {
  current: {
    data: undefined as MenuSection[] | undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  requestedId: undefined as string | undefined,
};

vi.mock("../../../hooks/useBooking", () => ({
  useMenuSections: (id: string | undefined) => {
    menuState.requestedId = id;
    return menuState.current;
  },
}));

const { useOceanSignatureDishes } = await import("../use-ocean-signature-dishes");

function venue(id: string, name: string): RestaurantSummary {
  return {
    id,
    name,
    cuisines: [],
    priceLevel: "₸₸",
    rating: 0,
    reviewsCount: 0,
    address: "",
    city: "Алматы",
    description: "",
    schedule: null,
    acceptsOnlineBookings: false,
  };
}

function venues(state: Partial<UseQueryResult<RestaurantSummary[]>>): UseQueryResult<RestaurantSummary[]> {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...state,
  } as UseQueryResult<RestaurantSummary[]>;
}

const MENU: MenuSection[] = [
  {
    title: "Платтеры",
    dishes: [
      { id: "p", name: "Full Deck Platter", description: "", priceMinor: 3_799_000, imageUrl: null, isAvailable: true },
    ],
  },
  {
    title: "Креветки",
    dishes: [
      { id: "k10", name: "King Креветки 10 шт", description: "", priceMinor: 2_239_000, imageUrl: null, isAvailable: true },
      { id: "k6", name: "King Креветки 6 шт", description: "", priceMinor: 1_509_000, imageUrl: null, isAvailable: true },
    ],
  },
];

describe("useOceanSignatureDishes", () => {
  it("меню спрашивается у ПЕРВОЙ точки выдачи, и блюда находятся по имени", () => {
    menuState.current = { data: MENU, isLoading: false, isError: false, refetch: vi.fn() };
    const { result } = renderHook(() =>
      useOceanSignatureDishes(venues({ data: [venue("first", "Ocean Basket Panfilova"), venue("second", "Ocean Basket Dostyk")] })),
    );

    expect(menuState.requestedId).toBe("first");
    expect(result.current.state).toEqual({
      status: "ready",
      dishes: [MENU[0].dishes[0], MENU[1].dishes[1]],
    });
  });

  it("точки ещё грузятся — блок грузится, меню никто не спрашивает", () => {
    menuState.current = { data: undefined, isLoading: false, isError: false, refetch: vi.fn() };
    const { result } = renderHook(() => useOceanSignatureDishes(venues({ isLoading: true })));

    expect(menuState.requestedId).toBeUndefined();
    expect(result.current.state).toEqual({ status: "loading" });
  });

  it("точки не загрузились — ошибка, и «Повторить» перечитывает точки", () => {
    const refetch = vi.fn();
    const { result } = renderHook(() => useOceanSignatureDishes(venues({ isError: true, refetch })));

    expect(result.current.state.status).toBe("error");
    if (result.current.state.status === "error") result.current.state.retry();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("точек нет вовсе — блок готов, но каждое блюдо пустое (нейтральные карточки)", () => {
    const { result } = renderHook(() => useOceanSignatureDishes(venues({ data: [] })));

    expect(result.current.state).toEqual({ status: "ready", dishes: [undefined, undefined] });
  });

  it("меню грузится — блок грузится; меню упало — ошибка с повтором меню", () => {
    menuState.current = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    const loading = renderHook(() =>
      useOceanSignatureDishes(venues({ data: [venue("first", "Ocean Basket Panfilova")] })),
    );
    expect(loading.result.current.state).toEqual({ status: "loading" });

    const refetch = vi.fn();
    menuState.current = { data: undefined, isLoading: false, isError: true, refetch };
    const failed = renderHook(() =>
      useOceanSignatureDishes(venues({ data: [venue("first", "Ocean Basket Panfilova")] })),
    );
    expect(failed.result.current.state.status).toBe("error");
    if (failed.result.current.state.status === "error") failed.result.current.state.retry();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("блюдо, которого в меню нет, — undefined на своём месте, остальные на своих", () => {
    menuState.current = { data: [MENU[0]], isLoading: false, isError: false, refetch: vi.fn() };
    const { result } = renderHook(() =>
      useOceanSignatureDishes(venues({ data: [venue("first", "Ocean Basket Panfilova")] })),
    );

    expect(result.current.state).toEqual({
      status: "ready",
      dishes: [MENU[0].dishes[0], undefined],
    });
  });
});
