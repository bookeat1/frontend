import { describe, expect, it, vi } from "vitest";

import {
  MAX_VENUE_FEATURES,
  activeVenueFeatures,
  mergeVenueFeatureOptions,
  reorderVenueFeatures,
  sameVenueFeatureSelection,
  sortVenueFeatures,
  splitIntoColumns,
  toggleVenueFeature,
  venueFeatureCodes,
  venueFeatureIdsOf,
  type VenueFeatureDictionaryEntry,
} from "../admin/venue-features";
import { saveVenueWithDictionaries } from "../admin/venue-save";

/**
 * Удобства заведения. Правила приходят из
 * internal/usecase/venuefeatures/facade.go: до пятнадцати штук у заведения,
 * набор пишется ОТДЕЛЬНОЙ ручкой (и потому может не лечь отдельно от самого
 * заведения), скрытую запись назначить нельзя, а взаимоисключающих пар сервер
 * не проверяет намеренно.
 */

function entry(over: Partial<VenueFeatureDictionaryEntry> = {}): VenueFeatureDictionaryEntry {
  return {
    id: "f-1",
    code: "wifi",
    name: "Wi-Fi",
    display_order: 10,
    is_active: true,
    venue_count: 0,
    ...over,
  };
}

describe("выбор удобств", () => {
  it("галочка ставится и снимается одной и той же функцией", () => {
    const first = toggleVenueFeature([], "f-1");
    expect(first).toEqual({ ok: true, ids: ["f-1"] });

    const second = toggleVenueFeature(["f-1", "f-2"], "f-1");
    expect(second).toEqual({ ok: true, ids: ["f-2"] });
  });

  it("снятие галочки не упирается в потолок — иначе лишнее не убрать", () => {
    const full = Array.from({ length: MAX_VENUE_FEATURES }, (_, i) => `f-${i}`);
    const result = toggleVenueFeature(full, "f-0");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ids).toHaveLength(MAX_VENUE_FEATURES - 1);
  });

  it("шестнадцатая галочка не ставится: сервер считает потолок после dedupe", () => {
    const full = Array.from({ length: MAX_VENUE_FEATURES }, (_, i) => `f-${i}`);
    expect(toggleVenueFeature(full, "f-new")).toEqual({ ok: false, error: "limit_reached" });
  });

  it("порядок для удобств не значим: тот же набор в другом порядке — не изменение", () => {
    expect(sameVenueFeatureSelection(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameVenueFeatureSelection(["a", "b"], ["a"])).toBe(false);
    expect(sameVenueFeatureSelection(["a", "b"], ["a", "c"])).toBe(false);
  });

  it("выбирать можно только активные, но уже выбранное скрытое из набора не пропадает", () => {
    const dictionary = [entry({ id: "f-1" }), entry({ id: "f-2", is_active: false })];
    const current = [entry({ id: "f-2", code: "hookah", name: "Кальян", is_active: false })];

    const options = mergeVenueFeatureOptions(activeVenueFeatures(dictionary), current);
    expect(options.map((item) => item.id)).toEqual(["f-1", "f-2"]);
  });

  it("id набора берутся в том порядке, в котором пришли", () => {
    expect(venueFeatureIdsOf([entry({ id: "b" }), entry({ id: "a" })])).toEqual(["b", "a"]);
  });
});

describe("порядок справочника", () => {
  it("сортирует по display_order, при равенстве — по названию", () => {
    const items = [
      entry({ id: "f-1", name: "Терраса", display_order: 20 }),
      entry({ id: "f-2", name: "Кальян", display_order: 20 }),
      entry({ id: "f-3", name: "Wi-Fi", display_order: 10 }),
    ];
    expect(sortVenueFeatures(items).map((i) => i.id)).toEqual(["f-3", "f-2", "f-1"]);
  });

  it("первая перестановка нумерует список целиком: шаг display_order на бою равен 10", () => {
    const items = [
      entry({ id: "f-1", name: "Терраса", display_order: 10 }),
      entry({ id: "f-2", name: "Wi-Fi", display_order: 20 }),
      entry({ id: "f-3", name: "Парковка", display_order: 30 }),
    ];
    expect(reorderVenueFeatures(items, "f-2", "up")).toEqual([
      { id: "f-2", display_order: 1 },
      { id: "f-1", display_order: 2 },
      { id: "f-3", display_order: 3 },
    ]);
  });

  it("двигать за край нечего — правок нет вовсе", () => {
    const items = [entry({ id: "f-1", display_order: 1 }), entry({ id: "f-2", display_order: 2 })];
    expect(reorderVenueFeatures(items, "f-1", "up")).toEqual([]);
    expect(reorderVenueFeatures(items, "f-2", "down")).toEqual([]);
  });
});

describe("раскладка галочек", () => {
  it("девятнадцать удобств режутся на две колонки СВЕРХУ ВНИЗ, а не построчно", () => {
    const items = Array.from({ length: 19 }, (_, i) => i + 1);
    const [left, right] = splitIntoColumns(items, 2);
    expect(left).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(right).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it("одна колонка — это исходный список, а пустой список не даёт пустых колонок", () => {
    expect(splitIntoColumns([1, 2, 3], 1)).toEqual([[1, 2, 3]]);
    expect(splitIntoColumns([], 2)).toEqual([]);
  });
});

describe("значения фильтра", () => {
  it("матч идёт по коду; запись без кода в фильтр не попадает", () => {
    expect(
      venueFeatureCodes({
        features: [
          { id: "f-1", code: "wifi", name: "Wi-Fi" },
          { id: "f-2", name: "Старое удобство" },
        ],
      }),
    ).toEqual(["wifi"]);
    expect(venueFeatureCodes({})).toEqual([]);
  });
});

describe("сохранение заведения тремя записями", () => {
  const venue = { id: "r-1" };

  it("пишет по порядку: заведение → кухни → удобства", async () => {
    const calls: string[] = [];
    const outcome = await saveVenueWithDictionaries({
      saveVenue: async () => {
        calls.push("venue");
        return venue;
      },
      cuisineIds: ["c-1"],
      saveCuisines: async () => {
        calls.push("cuisines");
      },
      featureIds: ["f-1"],
      saveFeatures: async () => {
        calls.push("features");
      },
    });

    expect(calls).toEqual(["venue", "cuisines", "features"]);
    expect(outcome).toEqual({ status: "saved", venue });
  });

  it("не легло заведение — наборы даже не пробуем: писать их некуда", async () => {
    const saveCuisines = vi.fn();
    const saveFeatures = vi.fn();
    const error = new Error("422");

    const outcome = await saveVenueWithDictionaries({
      saveVenue: () => Promise.reject(error),
      cuisineIds: ["c-1"],
      saveCuisines,
      featureIds: ["f-1"],
      saveFeatures,
    });

    expect(outcome).toEqual({ status: "venue_failed", error });
    expect(saveCuisines).not.toHaveBeenCalled();
    expect(saveFeatures).not.toHaveBeenCalled();
  });

  it("не легли удобства — заведение УЖЕ сохранено, и это отдельный исход", async () => {
    const error = new Error("500");
    const outcome = await saveVenueWithDictionaries({
      saveVenue: async () => venue,
      cuisineIds: ["c-1"],
      saveCuisines: vi.fn().mockResolvedValue(undefined),
      featureIds: ["f-1"],
      saveFeatures: () => Promise.reject(error),
    });

    expect(outcome).toEqual({ status: "features_failed", venue, error });
  });

  it("не легли кухни — удобства не пробуем: два «частично» в одном сообщении не разобрать", async () => {
    const saveFeatures = vi.fn();
    const error = new Error("500");

    const outcome = await saveVenueWithDictionaries({
      saveVenue: async () => venue,
      cuisineIds: ["c-1"],
      saveCuisines: () => Promise.reject(error),
      featureIds: ["f-1"],
      saveFeatures,
    });

    expect(outcome).toEqual({ status: "cuisines_failed", venue, error });
    expect(saveFeatures).not.toHaveBeenCalled();
  });

  it("null значит «набор не трогаем»: вслепую PUT стёр бы то, чего форма не показывала", async () => {
    const saveCuisines = vi.fn();
    const saveFeatures = vi.fn();

    const outcome = await saveVenueWithDictionaries({
      saveVenue: async () => venue,
      cuisineIds: null,
      saveCuisines,
      featureIds: null,
      saveFeatures,
    });

    expect(outcome).toEqual({ status: "saved", venue });
    expect(saveCuisines).not.toHaveBeenCalled();
    expect(saveFeatures).not.toHaveBeenCalled();
  });

  it("пустой набор — это НЕ «не трогаем»: он уходит и очищает удобства", async () => {
    const saveFeatures = vi.fn().mockResolvedValue(undefined);

    await saveVenueWithDictionaries({
      saveVenue: async () => venue,
      featureIds: [],
      saveFeatures,
    });

    expect(saveFeatures).toHaveBeenCalledWith("r-1", []);
  });
});
