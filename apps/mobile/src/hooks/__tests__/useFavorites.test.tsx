import type { FavoriteItems, RestaurantRepository } from "@bookeat/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FAVORITE_ITEMS_QUERY_KEY,
  useEventFavorite,
  usePromoFavorite,
} from "../useFavorites";

/**
 * Два свойства сердечка, которые нельзя проверить глазами и которые ломаются
 * тихо:
 *
 *   1. У ПОВТОРЯЮЩЕГОСЯ события в избранном лежит СЕРИЯ, а сервер возвращает
 *      ближайшую будущую дату — её id отличается от того, на котором гость
 *      нажал сердечко. Сравнение по id рисовало бы пустое сердечко на уже
 *      сохранённой карточке; сравнивать надо по recurrence_id.
 *
 *   2. Оптимистичное «убрать из избранного» правит кеш списка сразу, поэтому
 *      при отказе сервера правку нужно ОТКАТИТЬ — иначе строка исчезает
 *      навсегда, хотя на сервере она осталась.
 */

const repository = {
  getFavoriteItems: vi.fn(),
  addEventFavorite: vi.fn(),
  removeEventFavorite: vi.fn(),
  addPromoFavorite: vi.fn(),
  removePromoFavorite: vi.fn(),
} as unknown as RestaurantRepository & {
  getFavoriteItems: ReturnType<typeof vi.fn>;
  removeEventFavorite: ReturnType<typeof vi.fn>;
  removePromoFavorite: ReturnType<typeof vi.fn>;
};

vi.mock("../../lib/repository", () => ({
  useRepository: () => repository,
}));
vi.mock("../../lib/auth", () => ({
  useAuth: () => ({ status: "signed-in", ensureFreshToken: async () => undefined }),
}));
vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

/** Сохранены: повторяющееся событие (серия rec-1, ближайшая дата occ-2) и
 * одна акция. */
const SAVED: FavoriteItems = {
  items: [
    {
      kind: "event",
      favoritedAt: "2026-08-19T10:00:00Z",
      event: {
        id: "occ-2",
        restaurantId: "r-1",
        restaurantName: "Mongol Bar",
        city: "Алматы",
        title: "Cocktail Wednesday",
        description: "",
        startsAt: "2026-08-26T13:00:00Z",
        endsAt: "2026-08-26T16:00:00Z",
        venue: "",
        coverImageUrl: null,
        tags: [],
        ticketed: false,
        ticketPriceMinor: null,
        isRecurring: true,
        recurrenceId: "rec-1",
      },
    },
    {
      kind: "promo",
      favoritedAt: "2026-08-18T10:00:00Z",
      promo: {
        id: "promo-1",
        restaurantId: "r-2",
        restaurantName: "INZHU",
        city: "Алматы",
        title: "−30% на завтраки",
        description: "",
        terms: "",
        startsAt: "2026-08-01T00:00:00Z",
        endsAt: "2026-09-01T00:00:00Z",
        coverImageUrl: null,
        discountPercent: 30,
      },
    },
  ],
  counts: { all: 2, restaurants: 0, events: 1, promos: 1 },
};

function setup<T>(hook: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(hook, { wrapper }) };
}

beforeEach(() => {
  repository.getFavoriteItems.mockResolvedValue(SAVED);
});

describe("сердечко повторяющегося события", () => {
  it("закрашено на ДРУГОЙ дате той же серии — сравнение по recurrence_id", async () => {
    const { result } = setup(() => useEventFavorite({ id: "occ-1", recurrenceId: "rec-1" }));

    // occ-1 нет в избранном; там лежит occ-2 из той же серии.
    await waitFor(() => expect(result.current.isFavorite).toBe(true));
  });

  it("не закрашено у разового события с чужим id", async () => {
    const { result } = setup(() => useEventFavorite({ id: "occ-2-copy", recurrenceId: null }));

    await waitFor(() => expect(repository.getFavoriteItems).toHaveBeenCalled());
    expect(result.current.isFavorite).toBe(false);
  });

  it("закрашено у разового события, id которого лежит в избранном", async () => {
    // Граница: у разового события ключ — собственный id, и он обязан работать.
    const { result } = setup(() =>
      useEventFavorite({ id: "promo-1", recurrenceId: null }),
    );

    await waitFor(() => expect(repository.getFavoriteItems).toHaveBeenCalled());
    // «promo-1» — id акции, а не события: виды не должны путаться между собой.
    expect(result.current.isFavorite).toBe(false);
  });
});

describe("откат оптимистичного снятия", () => {
  it("возвращает строку и счётчики, когда запрос упал", async () => {
    repository.removeEventFavorite.mockRejectedValue(new Error("network"));

    const { queryClient, result } = setup(() =>
      useEventFavorite({ id: "occ-1", recurrenceId: "rec-1" }),
    );
    await waitFor(() => expect(result.current.isFavorite).toBe(true));

    await act(async () => {
      result.current.toggle();
    });
    await waitFor(() => expect(result.current.failed).toBe(true));

    // Точный откат: тот же payload, что был до правки.
    const restored = queryClient.getQueryData<FavoriteItems>(FAVORITE_ITEMS_QUERY_KEY);
    expect(restored?.items).toHaveLength(2);
    expect(restored?.counts).toEqual({ all: 2, restaurants: 0, events: 1, promos: 1 });
    // Сердечко тоже вернулось: гость видит, что сохранение не отменилось.
    expect(result.current.isFavorite).toBe(true);
  });

  it("убирает строку и уменьшает счётчики, когда запрос прошёл", async () => {
    repository.removePromoFavorite.mockResolvedValue(undefined);
    // После успеха список перечитывается — сервер отвечает уже без акции.
    repository.getFavoriteItems
      .mockResolvedValueOnce(SAVED)
      .mockResolvedValue({
        items: SAVED.items.filter((item) => item.kind !== "promo"),
        counts: { all: 1, restaurants: 0, events: 1, promos: 0 },
      });

    const { queryClient, result } = setup(() => usePromoFavorite("promo-1"));
    await waitFor(() => expect(result.current.isFavorite).toBe(true));

    await act(async () => {
      result.current.toggle();
    });

    await waitFor(() => expect(result.current.isFavorite).toBe(false));
    const after = queryClient.getQueryData<FavoriteItems>(FAVORITE_ITEMS_QUERY_KEY);
    expect(after?.items.some((item) => item.kind === "promo")).toBe(false);
    expect(after?.counts.promos).toBe(0);
    expect(repository.removePromoFavorite).toHaveBeenCalledWith("promo-1");
  });
});
