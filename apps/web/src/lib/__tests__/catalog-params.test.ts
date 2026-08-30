import { describe, expect, it } from "vitest";

import {
  buildSearchQuery,
  hasActiveFilters,
  pageCount,
  paginate,
  parseCatalogParams,
  serializeCatalogParams,
  sortVenues,
  toggleInList,
  EMPTY_CATALOG_STATE,
} from "@web/lib/catalog-params";

/**
 * Здесь проверяется ровно то, за что листинг отвечает головой: во что
 * превращаются фильтры из адресной строки, когда они уходят в
 * `searchRestaurants`. Вёрстка чипов не проверяется — её видно глазами, а вот
 * «поставил галочку, а запрос не изменился» глазами не видно вообще.
 */
describe("параметры каталога", () => {
  it("читает фильтры из адресной строки", () => {
    const state = parseCatalogParams(
      new URLSearchParams("q=паста&cuisine=european,kazakh&features=terrace&price=%E2%82%B8%E2%82%B8&open=1&sort=rating&page=3"),
    );

    expect(state.text).toBe("паста");
    expect(state.cuisines).toEqual(["european", "kazakh"]);
    expect(state.features).toEqual(["terrace"]);
    expect(state.price).toBe("₸₸");
    expect(state.openNow).toBe(true);
    expect(state.sort).toBe("rating");
    expect(state.page).toBe(3);
  });

  it("мусор в параметрах читается как «не задано», а не роняет страницу", () => {
    const state = parseCatalogParams(
      new URLSearchParams("price=доллары&page=-4&guests=абв&date=25.08.2026&sort=магия"),
    );

    expect(state.price).toBeUndefined();
    expect(state.page).toBe(1);
    expect(state.guests).toBeUndefined();
    expect(state.date).toBeUndefined();
    expect(state.sort).toBe("recommended");
  });

  it("значения по умолчанию в адрес не пишутся", () => {
    expect(serializeCatalogParams(EMPTY_CATALOG_STATE)).toBe("");
  });

  it("сериализация и разбор — обратимы", () => {
    const state = {
      ...EMPTY_CATALOG_STATE,
      text: "стейк",
      cuisines: ["european"],
      features: ["terrace", "wifi"],
      price: "₸₸₸" as const,
      date: "2026-09-01",
      guests: 4,
      time: "19:30",
      openNow: true,
      onlineOnly: true,
      sort: "name" as const,
      page: 2,
    };

    expect(parseCatalogParams(new URLSearchParams(serializeCatalogParams(state)))).toEqual(state);
  });
});

describe("запрос к API", () => {
  it("кухни, удобства, цена и город уходят в фильтры как есть", () => {
    const query = buildSearchQuery(
      {
        ...EMPTY_CATALOG_STATE,
        text: "  паста  ",
        cuisines: ["european"],
        features: ["terrace"],
        price: "₸₸",
        openNow: true,
      },
      "Алматы",
    );

    expect(query.text).toBe("паста");
    expect(query.filters.cuisineIds).toEqual(["european"]);
    expect(query.filters.amenityIds).toEqual(["terrace"]);
    expect(query.filters.priceLevel).toBe("₸₸");
    expect(query.filters.city).toBe("Алматы");
    expect(query.filters.openNowOnly).toBe(true);
  });

  it("доступность уходит ТОЛЬКО парой дата+гости", () => {
    const onlyDate = buildSearchQuery({ ...EMPTY_CATALOG_STATE, date: "2026-09-01" }, "Алматы");
    const onlyGuests = buildSearchQuery({ ...EMPTY_CATALOG_STATE, guests: 2 }, "Алматы");
    const both = buildSearchQuery(
      { ...EMPTY_CATALOG_STATE, date: "2026-09-01", guests: 2, time: "19:30" },
      "Алматы",
    );

    // Сервер игнорирует одно без другого — отправить половину значило бы
    // показать «фильтр применён», когда он не применён.
    expect(onlyDate.filters.availability).toBeUndefined();
    expect(onlyGuests.filters.availability).toBeUndefined();
    expect(both.filters.availability).toEqual({
      date: "2026-09-01",
      guests: 2,
      timeFrom: "19:30",
    });
  });

  it("без города фильтр города не подставляется наугад", () => {
    expect(buildSearchQuery(EMPTY_CATALOG_STATE, undefined).filters.city).toBeUndefined();
  });
});

describe("сортировка и страницы", () => {
  const venues = [
    { id: "1", name: "Бахчисарай", rating: 4.1 },
    { id: "2", name: "Aiza", rating: 4.9 },
    { id: "3", name: "Auyl", rating: 4.5 },
  ];

  it("«по рейтингу» ставит лучшее первым, «рекомендуемые» не трогают порядок сервера", () => {
    expect(sortVenues(venues, "rating", "ru").map((v) => v.id)).toEqual(["2", "3", "1"]);
    expect(sortVenues(venues, "recommended", "ru").map((v) => v.id)).toEqual(["1", "2", "3"]);
  });

  it("«по названию» сравнивает по правилам языка, а не по кодам символов", () => {
    // В русской раскладке сравнения кириллица идёт ПЕРЕД латиницей — это и
    // есть «по правилам языка»: посимвольный код дал бы обратный порядок.
    expect(sortVenues(venues, "name", "ru").map((v) => v.name)).toEqual([
      "Бахчисарай",
      "Aiza",
      "Auyl",
    ]);
    expect(sortVenues(venues, "name", "en").map((v) => v.name)).toEqual([
      "Aiza",
      "Auyl",
      "Бахчисарай",
    ]);
  });

  it("страница за пределами выдачи показывает первую, а не пустоту", () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    expect(pageCount(items.length)).toBe(2);
    expect(paginate(items, 2)).toEqual([6, 7]);
    expect(paginate(items, 99)).toEqual([6, 7]);
    expect(paginate(items, 0)).toEqual([1, 2, 3, 4, 5]);
  });

  it("пустая выдача — это одна страница, а не ноль", () => {
    expect(pageCount(0)).toBe(1);
  });
});

describe("вспомогательное", () => {
  it("переключение значения в списке добавляет и убирает", () => {
    expect(toggleInList([], "terrace")).toEqual(["terrace"]);
    expect(toggleInList(["terrace"], "terrace")).toEqual([]);
  });

  it("активные фильтры видны кнопке «Сбросить»", () => {
    expect(hasActiveFilters(EMPTY_CATALOG_STATE)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_CATALOG_STATE, features: ["terrace"] })).toBe(true);
    // Сортировка и номер страницы фильтрами не считаются: сбрасывать нечего.
    expect(hasActiveFilters({ ...EMPTY_CATALOG_STATE, sort: "rating", page: 4 })).toBe(false);
  });
});
