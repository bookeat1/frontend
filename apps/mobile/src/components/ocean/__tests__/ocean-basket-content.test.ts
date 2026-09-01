import type { RestaurantSummary } from "@bookeat/api";
import { describe, expect, it } from "vitest";
import {
  isOceanBasketVenue,
  oceanPointName,
  spacedOut,
} from "../ocean-basket-content";

/**
 * Правила, на которых держится фирменная страница Ocean Basket: чужое
 * заведение на ней не появляется, имя точки режется по бренду и не
 * превращается в пустую строку, а разрядка надписей воспроизводит макет.
 *
 * Проверяются ГРАНИЦЫ, а не середина: заведение, названное ровно именем
 * бренда; имя без бренда; регистр; строка из одного слова.
 */

function venue(name: string): RestaurantSummary {
  return {
    id: name,
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

describe("отбор точек бренда", () => {
  it("берёт заведения бренда и выбрасывает чужие", () => {
    const found = [
      venue("Ocean Basket Panfilova"),
      venue("Social Coffee"),
      venue("Ocean Basket Dostyk Plaza"),
    ].filter(isOceanBasketVenue);

    expect(found.map((item) => item.name)).toEqual([
      "Ocean Basket Panfilova",
      "Ocean Basket Dostyk Plaza",
    ]);
  });

  it("не смотрит на регистр и на лишние пробелы — так их пишет каталог", () => {
    expect(isOceanBasketVenue(venue("  ocean basket Mega Center"))).toBe(true);
  });

  it("заведение, где имя бренда стоит В СЕРЕДИНЕ, точкой бренда не считается", () => {
    // Поиск сервера умеет попадать по меню и по описанию: «Кафе у Ocean Basket»
    // приехало бы в ту же выдачу.
    expect(isOceanBasketVenue(venue("Кафе рядом с Ocean Basket"))).toBe(false);
  });
});

describe("имя точки на карточке", () => {
  it("режет имя бренда — в макете написано «Dostyk Plaza», а не полное имя", () => {
    expect(oceanPointName("Ocean Basket Dostyk Plaza")).toBe("Dostyk Plaza");
  });

  it("заведение, названное РОВНО именем бренда, имя сохраняет", () => {
    // Иначе на карточке была бы пустая строка вместо названия.
    expect(oceanPointName("Ocean Basket")).toBe("Ocean Basket");
  });

  it("имя без бренда не трогает", () => {
    expect(oceanPointName("Панфилова")).toBe("Панфилова");
  });
});

describe("разрядка надписей", () => {
  it("повторяет строку макета «Г О Т О В Ы   К   У Л О В У ?» (node 3443:12584)", () => {
    expect(spacedOut("ГОТОВЫ К УЛОВУ?")).toBe("Г О Т О В Ы   К   У Л О В У ?");
  });

  it("пустая строка остаётся пустой, а не превращается в пробел", () => {
    expect(spacedOut("")).toBe("");
  });
});
