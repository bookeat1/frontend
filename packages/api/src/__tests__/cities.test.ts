import { describe, expect, it } from "vitest";

import {
  activeCities,
  normalizeCityKey,
  reorderCityIds,
  sortCities,
  validateCityAlias,
  type CityDictionaryEntry,
} from "../admin/cities";

/**
 * Чистая логика справочника городов.
 *
 * Два факта сервера, которые здесь закреплены:
 *   • порядок правится ОДНОЙ ручкой `PUT /admin/cities/order`, принимающей
 *     ПОЛНУЮ последовательность id (а не «сдвинь этот») — поэтому
 *     `reorderCityIds` отдаёт весь список, а не пачку правок, как у кухонь;
 *   • нормализация написания у клиента должна совпадать с `city_key()` в SQL
 *     и `domain.NormalizeCityKey` в Go, иначе клиент решит, что написание
 *     новое, там где сервер видит старое.
 */

function entry(over: Partial<CityDictionaryEntry> = {}): CityDictionaryEntry {
  return {
    id: "c-1",
    code: "almaty",
    name: "Алматы",
    value: "Алматы",
    display_order: 1,
    is_active: true,
    ...over,
  };
}

const ITEMS: CityDictionaryEntry[] = [
  entry({ id: "c-1", code: "astana", name: "Астана", value: "Астана", display_order: 1 }),
  entry({ id: "c-2", display_order: 2 }),
  entry({
    id: "c-3",
    code: "shymkent",
    name: "Шымкент",
    value: "Шымкент",
    display_order: 3,
    is_active: false,
  }),
];

describe("нормализация написания города", () => {
  it("повторяет city_key(): края, внутренние пробелы, регистр", () => {
    expect(normalizeCityKey("  НУР-Султан  ")).toBe("нур-султан");
    expect(normalizeCityKey("Нур   Султан")).toBe("нур султан");
  });
});

describe("порядок справочника", () => {
  it("сортируется по display_order, при равенстве — по названию", () => {
    const same = [
      entry({ id: "b", name: "Балхаш", display_order: 0 }),
      entry({ id: "a", name: "Актау", display_order: 0 }),
      entry({ id: "z", name: "Астана", display_order: -1 }),
    ];
    expect(sortCities(same).map((c) => c.id)).toEqual(["z", "a", "b"]);
  });

  it("активные отбираются отдельно — скрытый город выбрать нельзя", () => {
    expect(activeCities(ITEMS).map((c) => c.id)).toEqual(["c-1", "c-2"]);
  });
});

describe("перестановка города", () => {
  it("отдаёт ПОЛНУЮ последовательность id — её ждёт PUT /admin/cities/order", () => {
    expect(reorderCityIds(ITEMS, "c-2", "up")).toEqual(["c-2", "c-1", "c-3"]);
    expect(reorderCityIds(ITEMS, "c-1", "down")).toEqual(["c-2", "c-1", "c-3"]);
  });

  it("двигает и скрытые записи: справочник у владельца показывает их вместе", () => {
    expect(reorderCityIds(ITEMS, "c-3", "up")).toEqual(["c-1", "c-3", "c-2"]);
  });

  it("край списка и незнакомый id — пустой ответ, запрос слать не за чем", () => {
    expect(reorderCityIds(ITEMS, "c-1", "up")).toEqual([]);
    expect(reorderCityIds(ITEMS, "c-3", "down")).toEqual([]);
    expect(reorderCityIds(ITEMS, "нет-такого", "up")).toEqual([]);
  });
});

describe("написание-синоним", () => {
  const city = { name: "Астана", value: "Астана" };

  it("принимается и схлопывает лишние пробелы", () => {
    expect(validateCityAlias("  Нур   Султан ", city)).toEqual({
      ok: true,
      alias: "Нур Султан",
    });
  });

  it("пустое написание не тратит запрос", () => {
    expect(validateCityAlias("   ", city)).toEqual({ ok: false, error: "empty" });
  });

  it("собственное название синонимом не заводят — справочник делает это сам", () => {
    expect(validateCityAlias("астана", city)).toEqual({ ok: false, error: "same_as_name" });
  });

  it("сверяется и с локализованным названием, и с базовым", () => {
    const kazakh = { name: "Астана қаласы", value: "Астана" };
    expect(validateCityAlias(" АСТАНА ҚАЛАСЫ ", kazakh)).toEqual({
      ok: false,
      error: "same_as_name",
    });
  });
});
