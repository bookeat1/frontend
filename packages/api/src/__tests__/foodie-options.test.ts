import { describe, expect, it } from "vitest";

import { RepositoryError } from "../repository";
import { AdminApiError } from "../admin/client";
import {
  FOODIE_DIET_EXCLUSIVE_CODE,
  buildFoodieI18nField,
  canHideFoodieOption,
  classifyFoodieOptionFailure,
  isLastActiveOfKind,
  reorderFoodieOptions,
  sortFoodieOptions,
  type FoodieOptionEntry,
} from "../admin/foodie-options";

/**
 * Справочник фуди-профиля (спека foodie-profile-admin-dictionaries-20260916,
 * FE-A1). Правила, закреплённые здесь, приходят из
 * `internal/usecase/foodieoptions/facade.go`: `no_diet` и последний активный
 * вариант своего вида скрыть нельзя (критерий 8), а `name_i18n`/соседние
 * карты переводов сервер ЗАМЕЩАЕТ целиком, когда поле не nil — та же
 * конвенция, что у `/admin/cuisines`.
 */

function entry(over: Partial<FoodieOptionEntry> = {}): FoodieOptionEntry {
  return {
    id: "o-1",
    kind: "cuisine",
    code: "kazakh",
    name: "Казахская",
    cuisine_ids: [],
    cuisine_codes: [],
    display_order: 0,
    is_active: true,
    affects_matching: false,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

describe("порядок справочника", () => {
  it("сортирует по display_order, при равенстве — по названию (переиспользует sortCuisines)", () => {
    const items = [
      entry({ id: "1", name: "Морская", display_order: 2 }),
      entry({ id: "2", name: "Азиатская", display_order: 1 }),
      entry({ id: "3", name: "Веган", display_order: 2 }),
    ];
    expect(sortFoodieOptions(items).map((i) => i.id)).toEqual(["2", "3", "1"]);
  });

  it("перестановка — та же логика, что у кухонь: только реально изменившиеся правки", () => {
    const numbered = [
      entry({ id: "1", name: "Азиатская", display_order: 1 }),
      entry({ id: "2", name: "Веган", display_order: 2 }),
      entry({ id: "3", name: "Морская", display_order: 3 }),
    ];
    expect(reorderFoodieOptions(numbered, "3", "up")).toEqual([
      { id: "3", display_order: 2 },
      { id: "2", display_order: 3 },
    ]);
  });
});

describe("запрет скрыть последний активный вариант своего вида (критерий 8)", () => {
  it("единственный активный своего вида — последний", () => {
    const items = [
      entry({ id: "1", kind: "diet", code: "vegan", is_active: true }),
      entry({ id: "2", kind: "diet", code: "halal", is_active: false }),
      entry({ id: "3", kind: "cuisine", code: "asian", is_active: true }),
    ];
    expect(isLastActiveOfKind(items, items[0]!)).toBe(true);
    // Другого вида (cuisine) активный не одинок — своё правило считается ВНУТРИ вида.
    expect(isLastActiveOfKind(items, items[2]!)).toBe(true);
  });

  it("двое активных своего вида — ни один не последний", () => {
    const items = [
      entry({ id: "1", kind: "allergy", code: "seafood", is_active: true }),
      entry({ id: "2", kind: "allergy", code: "nuts", is_active: true }),
    ];
    expect(isLastActiveOfKind(items, items[0]!)).toBe(false);
    expect(isLastActiveOfKind(items, items[1]!)).toBe(false);
  });

  it("уже скрытый вариант не «последний» — его и так не скрыть повторно", () => {
    const items = [entry({ id: "1", kind: "budget", code: "budget", is_active: false })];
    expect(isLastActiveOfKind(items, items[0]!)).toBe(false);
  });

  it("canHideFoodieOption запрещает последний активный своего вида", () => {
    const items = [entry({ id: "1", kind: "budget", code: "budget", is_active: true })];
    expect(canHideFoodieOption(items, items[0]!)).toBe(false);
  });

  it("canHideFoodieOption разрешает скрыть, если в виде остаётся активный", () => {
    const items = [
      entry({ id: "1", kind: "budget", code: "budget", is_active: true }),
      entry({ id: "2", kind: "budget", code: "mid", is_active: true }),
    ];
    expect(canHideFoodieOption(items, items[0]!)).toBe(true);
  });

  it(`«${FOODIE_DIET_EXCLUSIVE_CODE}» нельзя скрыть НИКОГДА, даже если в виде есть другие активные`, () => {
    const items = [
      entry({ id: "1", kind: "diet", code: FOODIE_DIET_EXCLUSIVE_CODE, is_active: true }),
      entry({ id: "2", kind: "diet", code: "vegan", is_active: true }),
    ];
    expect(canHideFoodieOption(items, items[0]!)).toBe(false);
  });

  it("тот же код в другом виде — правило no_diet не действует", () => {
    // 3.12 спеки: один и тот же код допустим в разных видах.
    const items = [
      entry({ id: "1", kind: "cuisine", code: FOODIE_DIET_EXCLUSIVE_CODE, is_active: true }),
      entry({ id: "2", kind: "cuisine", code: "asian", is_active: true }),
    ];
    expect(canHideFoodieOption(items, items[0]!)).toBe(true);
  });
});

describe("переводы: сервер замещает карту целиком, не патчит", () => {
  it("черновик не менялся — поле в тело не попадает", () => {
    const draft = { kk: "Қазақша", en: "Kazakh" };
    expect(buildFoodieI18nField(draft, { kk: "Қазақша", en: "Kazakh" })).toBeUndefined();
  });

  it("изменился только один язык — уходит ПОЛНЫЙ черновик, а не дельта", () => {
    const draft = { kk: "Қазақша жаңа", en: "Kazakh" };
    // Раньше en был "Kazakh" и остался тем же — но всё равно едет в теле:
    // сервер заменяет map[string]string целиком, дельта потеряла бы его.
    expect(buildFoodieI18nField(draft, { kk: "Қазақша", en: "Kazakh" })).toEqual({
      kk: "Қазақша жаңа",
      en: "Kazakh",
    });
  });

  it("оба языка стёрли — уходит пустой объект (очистка), а не undefined", () => {
    expect(buildFoodieI18nField({ kk: "", en: "" }, { kk: "Қазақша", en: "Kazakh" })).toEqual({});
  });

  it("пустых языков в карте нет — они опускаются, а не шлются пустой строкой", () => {
    expect(buildFoodieI18nField({ kk: "Қазақша", en: "" }, undefined)).toEqual({ kk: "Қазақша" });
  });
});

describe("отказы сервера", () => {
  it("409 — дубликат (kind, code) или (kind, name)", () => {
    expect(classifyFoodieOptionFailure(new AdminApiError("x", 409)).kind).toBe("duplicate");
  });

  it("422 — общий отказ: и «скрыть последний», и «код неизменяем» сервер не различает узким кодом", () => {
    expect(classifyFoodieOptionFailure(new AdminApiError("x", 422)).kind).toBe("refused");
  });

  it("403/401/404 — как везде в кабинете", () => {
    expect(classifyFoodieOptionFailure(new AdminApiError("x", 403)).kind).toBe("forbidden");
    expect(classifyFoodieOptionFailure(new AdminApiError("x", 401)).kind).toBe("unauthorized");
    expect(classifyFoodieOptionFailure(new AdminApiError("x", 404)).kind).toBe("not_found");
  });

  it("сеть/5xx — unknown, применилось неизвестно", () => {
    const failure = classifyFoodieOptionFailure(new RepositoryError("timeout"));
    expect(failure).toEqual({ kind: "unknown", applied: "unknown" });
  });
});
