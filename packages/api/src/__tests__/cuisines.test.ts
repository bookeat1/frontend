import { describe, expect, it, vi } from "vitest";

import {
  MAX_VENUE_CUISINES,
  cuisineIdsOf,
  deselectCuisine,
  makeMainCuisine,
  reorderCuisines,
  sameCuisineSelection,
  saveVenueWithCuisines,
  selectCuisine,
  sortCuisines,
  type CuisineDictionaryEntry,
} from "../admin/cuisines";

/**
 * Справочник кухонь. Правила, которые тут закреплены, приходят из
 * internal/usecase/cuisines/facade.go: до пяти кухонь у заведения, порядок
 * значим (нулевая позиция — главная), набор пишется отдельной ручкой и потому
 * может лечь отдельно от самого заведения.
 */

function entry(over: Partial<CuisineDictionaryEntry> = {}): CuisineDictionaryEntry {
  return {
    id: "c-1",
    code: "kazakh",
    name: "Казахская",
    display_order: 0,
    is_active: true,
    ...over,
  };
}

describe("выбор кухонь заведения", () => {
  it("добавляет кухню в конец — главную выбором шестой не подменяют", () => {
    const result = selectCuisine(["a", "b"], "c");
    expect(result).toEqual({ ok: true, ids: ["a", "b", "c"] });
  });

  it("пятая кухня проходит, шестая — нет", () => {
    const five = ["a", "b", "c", "d", "e"];
    expect(five).toHaveLength(MAX_VENUE_CUISINES);
    expect(selectCuisine(["a", "b", "c", "d"], "e")).toEqual({ ok: true, ids: five });
    expect(selectCuisine(five, "f")).toEqual({ ok: false, error: "limit_reached" });
  });

  it("повтор не добавляется вторым — на сервере он всё равно схлопнется", () => {
    expect(selectCuisine(["a", "b"], "a")).toEqual({ ok: false, error: "already_selected" });
  });

  it("удаление не трогает порядок остальных", () => {
    expect(deselectCuisine(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("«сделать главной» переносит кухню в начало, остальные сохраняют свой порядок", () => {
    expect(makeMainCuisine(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
    expect(makeMainCuisine(["a", "b"], "a")).toEqual(["a", "b"]);
  });

  it("«сделать главной» для чужой кухни ничего не меняет", () => {
    expect(makeMainCuisine(["a", "b"], "z")).toEqual(["a", "b"]);
  });

  it("сравнение наборов позиционное: та же пятёрка в другом порядке — ДРУГОЙ набор", () => {
    expect(sameCuisineSelection(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameCuisineSelection(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameCuisineSelection(["a"], ["a", "b"])).toBe(false);
  });

  it("id-шники набора берутся в порядке ответа сервера", () => {
    expect(cuisineIdsOf([entry({ id: "x" }), entry({ id: "y" })])).toEqual(["x", "y"]);
  });
});

describe("порядок справочника", () => {
  const items = [
    entry({ id: "1", name: "Морская", display_order: 2 }),
    entry({ id: "2", name: "Азиатская", display_order: 1 }),
    entry({ id: "3", name: "Веган", display_order: 2 }),
  ];

  it("сортирует по display_order, при равенстве — по названию", () => {
    expect(sortCuisines(items).map((i) => i.id)).toEqual(["2", "3", "1"]);
  });

  it("первая перестановка нумерует список целиком: у всех записей порядок нулевой", () => {
    const fresh = [
      entry({ id: "1", name: "Азиатская", display_order: 0 }),
      entry({ id: "2", name: "Морская", display_order: 0 }),
      entry({ id: "3", name: "Веган", display_order: 0 }),
    ];
    // Порядок до перестановки — по алфавиту: Азиатская, Веган, Морская.
    expect(reorderCuisines(fresh, "3", "up")).toEqual([
      { id: "3", display_order: 1 },
      { id: "1", display_order: 2 },
      { id: "2", display_order: 3 },
    ]);
  });

  it("у пронумерованного списка перестановка — ровно две правки", () => {
    const numbered = [
      entry({ id: "1", name: "Азиатская", display_order: 1 }),
      entry({ id: "2", name: "Веган", display_order: 2 }),
      entry({ id: "3", name: "Морская", display_order: 3 }),
    ];
    expect(reorderCuisines(numbered, "3", "up")).toEqual([
      { id: "3", display_order: 2 },
      { id: "2", display_order: 3 },
    ]);
  });

  it("за край списка не переставляет и чужую запись не ищет", () => {
    const numbered = [
      entry({ id: "1", name: "Азиатская", display_order: 1 }),
      entry({ id: "2", name: "Веган", display_order: 2 }),
    ];
    expect(reorderCuisines(numbered, "1", "up")).toEqual([]);
    expect(reorderCuisines(numbered, "2", "down")).toEqual([]);
    expect(reorderCuisines(numbered, "нет такой", "up")).toEqual([]);
  });
});

describe("сохранение заведения, у которого кухни пишутся отдельной ручкой", () => {
  const venue = { id: "v-1" };

  it("сначала заведение, потом кухни — у нового заведения id берётся из ответа", async () => {
    const order: string[] = [];
    const saveCuisines = vi.fn(async (id: string) => {
      order.push(`cuisines:${id}`);
    });
    const outcome = await saveVenueWithCuisines({
      saveVenue: async () => {
        order.push("venue");
        return venue;
      },
      cuisineIds: ["c-1"],
      saveCuisines,
    });

    expect(order).toEqual(["venue", "cuisines:v-1"]);
    expect(saveCuisines).toHaveBeenCalledWith("v-1", ["c-1"]);
    expect(outcome).toEqual({ status: "saved", venue });
  });

  it("набор не менялся — PUT не уходит вовсе: он замещает набор целиком", async () => {
    const saveCuisines = vi.fn();
    const outcome = await saveVenueWithCuisines({
      saveVenue: async () => venue,
      cuisineIds: null,
      saveCuisines,
    });

    expect(saveCuisines).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: "saved", venue });
  });

  it("не легло заведение — кухни даже не пробуем: писать их некуда", async () => {
    const saveCuisines = vi.fn();
    const error = new Error("422");
    const outcome = await saveVenueWithCuisines({
      saveVenue: async () => {
        throw error;
      },
      cuisineIds: ["c-1"],
      saveCuisines,
    });

    expect(saveCuisines).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: "venue_failed", error });
  });

  it("легло заведение, не легли кухни — исход НЕ «не сохранилось»: заведение возвращается", async () => {
    const error = new Error("сеть");
    const outcome = await saveVenueWithCuisines({
      saveVenue: async () => venue,
      cuisineIds: ["c-1"],
      saveCuisines: async () => {
        throw error;
      },
    });

    expect(outcome).toEqual({ status: "cuisines_failed", venue, error });
  });

  it("пустой набор — это тоже набор: «кухонь нет» отправляется, а не пропускается", async () => {
    const saveCuisines = vi.fn(async () => undefined);
    await saveVenueWithCuisines({
      saveVenue: async () => venue,
      cuisineIds: [],
      saveCuisines,
    });
    expect(saveCuisines).toHaveBeenCalledWith("v-1", []);
  });
});
