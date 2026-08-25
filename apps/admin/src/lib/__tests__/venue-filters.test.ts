import { describe, expect, it } from "vitest";
import type { CatalogVenue, CuisineDictionaryEntry } from "@bookeat/api/admin";

import {
  EMPTY_VENUE_FILTERS,
  collectCityOptions,
  collectCuisineOptions,
  cuisineKey,
  filterVenues,
  hasActiveVenueFilters,
  matchesVenueFilters,
  type VenueFilters,
} from "../venue-filters";

/**
 * Каталог у суперадмина — единственный экран, где видно и скрытые заведения,
 * и их 45 штук. Фильтры тут не украшение: без них скрытое заведение ищут
 * глазами по всему списку.
 *
 * Отдельно проверяется кухня: сегодня это свободный текст, и список для
 * выпадающего собирается из данных со всем их разнобоем. Тесты фиксируют
 * ИМЕННО такое поведение (регистр схлопывается, составное название остаётся
 * целым) — чтобы при переходе на справочник кухонь было видно, что меняется.
 */

function venue(over: Partial<CatalogVenue> = {}): CatalogVenue {
  return {
    id: over.id ?? "v-1",
    name: "Юрта",
    description: "",
    cuisine_type: "Казахская",
    address: "",
    city: "Алматы",
    price_category: "₸₸",
    email: "",
    phone: "",
    latitude: null,
    longitude: null,
    is_active: true,
    ...over,
  };
}

const venues: CatalogVenue[] = [
  venue({ id: "1", name: "Юрта", city: "Алматы", cuisine_type: "Казахская", is_active: true }),
  venue({ id: "2", name: "Del Papa", city: "Астана", cuisine_type: "Итальянская", is_active: true }),
  venue({ id: "3", name: "Аул", city: "Алматы", cuisine_type: "казахская", is_active: false }),
  venue({
    id: "4",
    name: "Кофейня на углу",
    city: "Астана",
    cuisine_type: "Кафе, европейская",
    is_active: false,
  }),
];

const withFilters = (over: Partial<VenueFilters>): VenueFilters => ({
  ...EMPTY_VENUE_FILTERS,
  ...over,
});

describe("filterVenues — по одному полю", () => {
  it("без фильтров отдаёт весь список в том же порядке", () => {
    expect(filterVenues(venues, EMPTY_VENUE_FILTERS).map((v) => v.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
  });

  it("город", () => {
    expect(filterVenues(venues, withFilters({ city: "Астана" })).map((v) => v.id)).toEqual([
      "2",
      "4",
    ]);
  });

  it("кухня — разные написания одного названия считаются одной кухней", () => {
    expect(filterVenues(venues, withFilters({ cuisine: "казахская" })).map((v) => v.id)).toEqual([
      "1",
      "3",
    ]);
  });

  it("составное название кухни не разбирается на части", () => {
    // «Кафе, европейская» НЕ попадает под фильтр «европейская»: в базе это одно
    // значение, и делить его — догадка, а не факт.
    expect(filterVenues(venues, withFilters({ cuisine: "европейская" }))).toEqual([]);
    expect(
      filterVenues(venues, withFilters({ cuisine: "кафе, европейская" })).map((v) => v.id),
    ).toEqual(["4"]);
  });

  it("статус: показывается / скрыто", () => {
    expect(filterVenues(venues, withFilters({ status: "active" })).map((v) => v.id)).toEqual([
      "1",
      "2",
    ]);
    expect(filterVenues(venues, withFilters({ status: "hidden" })).map((v) => v.id)).toEqual([
      "3",
      "4",
    ]);
  });

  it("поиск по названию — регистр не важен, как в серверном ILIKE", () => {
    expect(filterVenues(venues, withFilters({ search: "юрТА" })).map((v) => v.id)).toEqual(["1"]);
    expect(filterVenues(venues, withFilters({ search: "  papa " })).map((v) => v.id)).toEqual(["2"]);
  });
});

describe("filterVenues — фильтры работают вместе", () => {
  it("город и статус сужают выдачу вместе, а не по очереди", () => {
    expect(
      filterVenues(venues, withFilters({ city: "Алматы", status: "hidden" })).map((v) => v.id),
    ).toEqual(["3"]);
  });

  it("город и кухня", () => {
    expect(
      filterVenues(venues, withFilters({ city: "Алматы", cuisine: "казахская" })).map((v) => v.id),
    ).toEqual(["1", "3"]);
  });

  it("несовместимая пара даёт пустую выдачу, а не игнорирует один из фильтров", () => {
    expect(filterVenues(venues, withFilters({ city: "Астана", cuisine: "казахская" }))).toEqual([]);
  });

  it("три фильтра сразу", () => {
    expect(
      filterVenues(
        venues,
        withFilters({ search: "аул", city: "Алматы", status: "hidden" }),
      ).map((v) => v.id),
    ).toEqual(["3"]);
  });
});

describe("сброс", () => {
  it("сброс возвращает весь список", () => {
    const applied = withFilters({ search: "юрта", city: "Алматы", cuisine: "казахская", status: "active" });
    expect(filterVenues(venues, applied).map((v) => v.id)).toEqual(["1"]);
    expect(filterVenues(venues, EMPTY_VENUE_FILTERS)).toHaveLength(venues.length);
  });

  it("hasActiveVenueFilters отличает «есть что сбрасывать» от пустого набора", () => {
    expect(hasActiveVenueFilters(EMPTY_VENUE_FILTERS)).toBe(false);
    expect(hasActiveVenueFilters(withFilters({ search: "   " }))).toBe(false);
    expect(hasActiveVenueFilters(withFilters({ search: "ю" }))).toBe(true);
    expect(hasActiveVenueFilters(withFilters({ city: "Алматы" }))).toBe(true);
    expect(hasActiveVenueFilters(withFilters({ cuisine: "казахская" }))).toBe(true);
    expect(hasActiveVenueFilters(withFilters({ status: "hidden" }))).toBe(true);
  });
});

describe("списки для выпадающих собираются из данных", () => {
  it("города — только те, что реально встречаются", () => {
    expect(collectCityOptions(venues)).toEqual([
      { value: "Алматы", label: "Алматы" },
      { value: "Астана", label: "Астана" },
    ]);
  });

  it("кухни — разнобой регистра схлопывается, мусор из базы показывается как есть", () => {
    expect(collectCuisineOptions(venues)).toEqual([
      { value: "итальянская", label: "Итальянская" },
      { value: "казахская", label: "Казахская" },
      { value: "кафе, европейская", label: "Кафе, европейская" },
    ]);
  });

  it("пустая кухня не превращается в пункт списка", () => {
    expect(collectCuisineOptions([venue({ cuisine_type: "   " })])).toEqual([]);
  });

  it("ключ кухни нормализует пробелы и регистр", () => {
    expect(cuisineKey("  Кафе,   Европейская ")).toBe("кафе, европейская");
  });
});

describe("matchesVenueFilters", () => {
  it("заведение без города не проходит фильтр по городу", () => {
    expect(matchesVenueFilters(venue({ city: "" }), withFilters({ city: "Алматы" }))).toBe(false);
  });
});

/**
 * Переезд на справочник кухонь. Пока сервер не выложен, ручки `GET /cuisines`
 * нет, справочник приезжает пустым — и всё выше продолжает работать по текстам.
 * Здесь проверяется вторая половина: когда справочник ЕСТЬ.
 */
describe("кухни из справочника", () => {
  const dictionary: CuisineDictionaryEntry[] = [
    {
      id: "c-1",
      code: "kazakh",
      name: "Казахская",
      display_order: 2,
      is_active: true,
    },
    {
      id: "c-2",
      code: "italian",
      name: "Итальянская",
      display_order: 1,
      is_active: true,
    },
    {
      id: "c-3",
      code: "vegan",
      name: "Веган",
      display_order: 3,
      is_active: false,
    },
  ];

  const migrated = venue({
    id: "m-1",
    name: "Del Papa",
    cuisine_type: "Итальянская, Казахская",
    cuisines: [
      { id: "c-2", code: "italian", name: "Итальянская" },
      { id: "c-1", code: "kazakh", name: "Казахская" },
    ],
  });

  it("список берётся из справочника в его порядке, скрытые кухни не предлагаются", () => {
    expect(collectCuisineOptions([migrated], dictionary)).toEqual([
      { value: "italian", label: "Итальянская" },
      { value: "kazakh", label: "Казахская" },
    ]);
  });

  it("заведение находится по ЛЮБОЙ своей кухне, не только по главной", () => {
    expect(matchesVenueFilters(migrated, withFilters({ cuisine: "kazakh" }))).toBe(true);
    expect(matchesVenueFilters(migrated, withFilters({ cuisine: "italian" }))).toBe(true);
    expect(matchesVenueFilters(migrated, withFilters({ cuisine: "french" }))).toBe(false);
  });

  it("непереведённое заведение остаётся отбираемым по своему тексту", () => {
    const legacy = venue({ id: "l-1", cuisine_type: "Кафе, европейская" });
    expect(collectCuisineOptions([migrated, legacy], dictionary)).toEqual([
      { value: "italian", label: "Итальянская" },
      { value: "kazakh", label: "Казахская" },
      { value: "кафе, европейская", label: "Кафе, европейская" },
    ]);
    expect(matchesVenueFilters(legacy, withFilters({ cuisine: "кафе, европейская" }))).toBe(true);
  });

  it("текст заведения, у которого есть набор, в список не добавляется — иначе одна кухня двумя пунктами", () => {
    const options = collectCuisineOptions([migrated], dictionary).map((o) => o.value);
    expect(options).not.toContain("итальянская, казахская");
  });

  it("справочник не ответил — фильтр работает как раньше", () => {
    expect(collectCuisineOptions(venues, []).map((o) => o.value)).toEqual([
      "итальянская",
      "казахская",
      "кафе, европейская",
    ]);
  });
});
