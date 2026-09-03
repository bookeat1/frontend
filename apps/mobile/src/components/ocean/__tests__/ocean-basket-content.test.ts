import type { MenuSection, RestaurantSummary } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { describe, expect, it } from "vitest";
import {
  OCEAN_BASKET_INSTAGRAM,
  OCEAN_SIGNATURE_DISHES,
  findMenuDish,
  isOceanBasketVenue,
  normalizeDishName,
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

describe("инстаграм бренда", () => {
  it("ведёт на настоящий аккаунт — oceanbasket.kz, с точкой", () => {
    // До 2026-09-03 стояло «oceanbasketkz» — такой страницы в инстаграме нет.
    expect(OCEAN_BASKET_INSTAGRAM).toBe("oceanbasket.kz");
  });

  it("подпись в словаре совпадает со ссылкой — во всех трёх языках", () => {
    for (const locale of ["ru", "kk", "en"] as const) {
      expect(getDictionary(locale).oceanBasket.instagramHandle, locale).toBe(
        `@${OCEAN_BASKET_INSTAGRAM}`,
      );
    }
  });
});

describe("блюда «Фирменного улова» в меню", () => {
  const menu: MenuSection[] = [
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
        { id: "k6", name: "King  креветки 6 шт ", description: "", priceMinor: 1_509_000, imageUrl: null, isAvailable: true },
      ],
    },
  ];

  it("имена из привязки — ровно те, что в меню всех трёх точек (2026-09-03)", () => {
    expect(OCEAN_SIGNATURE_DISHES.map((dish) => dish.menuName)).toEqual([
      "Full Deck Platter",
      "King Креветки 6 шт",
    ]);
  });

  it("находит блюдо в любом разделе, не путая «6 шт» и «10 шт»", () => {
    expect(findMenuDish(menu, "Full Deck Platter")?.id).toBe("p");
    expect(findMenuDish(menu, "King Креветки 6 шт")?.id).toBe("k6");
  });

  it("сравнивает без регистра, лишних пробелов и разницы ё/е — так меню правят руками", () => {
    expect(normalizeDishName("  King  КРЕВЕТКИ 6 шт ")).toBe("king креветки 6 шт");
    expect(normalizeDishName("Ёрш")).toBe("ерш");
    expect(findMenuDish(menu, "full deck platter")?.id).toBe("p");
  });

  it("блюда нет — undefined, а не ближайшее похожее", () => {
    expect(findMenuDish(menu, "King Креветки 8 шт")).toBeUndefined();
    expect(findMenuDish([], "Full Deck Platter")).toBeUndefined();
  });
});
