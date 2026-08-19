import type { FavoriteItem, FavoriteItems } from "@bookeat/api";
import { describe, expect, it } from "vitest";
import {
  favoriteItemKey,
  favoriteTabCount,
  FAVORITE_TABS,
  filterFavoriteItems,
} from "../favorites-tabs";

/**
 * Чипы «Все / Рестораны / События / Акции» — это ФИЛЬТР по уже загруженному
 * ответу, а не новый запрос: сервер считает `counts` по всем видам сразу.
 *
 * Проверяется ровно то, что видно глазами: на вкладке «События» лежат только
 * события, счётчик на чипе — из ответа сервера, а ключи строк разных видов не
 * сталкиваются (id события и id акции вполне могут совпасть).
 */

const restaurantItem = {
  kind: "restaurant",
  favoritedAt: "2026-08-19T12:00:00Z",
  restaurant: { id: "shared-id", name: "Mongol Bar" },
} as unknown as FavoriteItem;

const eventItem = {
  kind: "event",
  favoritedAt: "2026-08-19T11:00:00Z",
  event: { id: "shared-id", recurrenceId: "rec-1", title: "Cocktail Wednesday" },
} as unknown as FavoriteItem;

const promoItem = {
  kind: "promo",
  favoritedAt: "2026-08-19T10:00:00Z",
  promo: { id: "shared-id", title: "−30%" },
} as unknown as FavoriteItem;

const ITEMS = [restaurantItem, eventItem, promoItem];

const COUNTS: FavoriteItems["counts"] = { all: 7, restaurants: 3, events: 2, promos: 2 };

describe("вкладки избранного", () => {
  it("«Все» — весь список в порядке сервера", () => {
    expect(filterFavoriteItems(ITEMS, "all")).toEqual(ITEMS);
  });

  it("каждая вкладка оставляет только свой вид", () => {
    expect(filterFavoriteItems(ITEMS, "restaurant")).toEqual([restaurantItem]);
    expect(filterFavoriteItems(ITEMS, "event")).toEqual([eventItem]);
    expect(filterFavoriteItems(ITEMS, "promo")).toEqual([promoItem]);
  });

  it("пустая вкладка — это пустой массив, а не весь список", () => {
    expect(filterFavoriteItems([restaurantItem], "event")).toEqual([]);
  });

  it("счётчик чипа берётся из ответа сервера, а не из длины вкладки", () => {
    // counts про ВСЁ избранное; выдача могла быть сужена параметром type=.
    expect(FAVORITE_TABS.map((tab) => favoriteTabCount(COUNTS, tab))).toEqual([7, 3, 2, 2]);
    // Ответа ещё нет — нули, а не падение.
    expect(favoriteTabCount(undefined, "event")).toBe(0);
  });

  it("ключи строк не сталкиваются при одинаковых id разных видов", () => {
    const keys = ITEMS.map(favoriteItemKey);
    expect(new Set(keys).size).toBe(ITEMS.length);
  });
});
