import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS } from "../types";
import { HttpRestaurantRepository } from "../http-repository";

/**
 * Удобства («Удобства» в шторке фильтров) — справочник `GET /venue-features`
 * и серверный фильтр `?features=`.
 *
 * Что здесь защищается — ровно то, чем этот фильтр был сломан до 2026-08-25:
 *   1. список удобств приходит С СЕРВЕРА, а не из зашитой в приложение
 *      семёрки кодов;
 *   2. выбранное УХОДИТ в запрос — иначе гость фильтрует, а выдача та же;
 *   3. два удобства уходят ОДНИМ параметром через запятую, и сервер понимает
 *      это как И (проверено на бою: terrace 4, wifi 3, terrace,wifi 2);
 *   4. пустой выбор не отправляет параметр вовсе — пустой `features=`
 *      означал бы «ни одного заведения», а не «фильтра нет».
 */

const BASE_URL = "https://api.example.test/api/v1";

/** Одна запись справочника в том виде, в каком её отдаёт сервер. */
function entry(over: Record<string, unknown> = {}) {
  return {
    id: "688fc12d-b985-5eff-9197-f6afc2750750",
    code: "terrace",
    name: "Терраса",
    name_i18n: { ru: "Терраса", en: "Terrace", kk: "Терраса" },
    display_order: 10,
    is_active: true,
    venue_count: 4,
    ...over,
  };
}

/** Подменяет fetch: справочник отвечает `items`, каталог — пустой страницей. */
function stubApi(items: unknown[]): { urls: string[] } {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      const body = url.includes("/venue-features")
        ? { data: items }
        : { data: { items: [], total: 0 } };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return { urls };
}

function repository(getLanguage?: () => string | undefined) {
  return new HttpRestaurantRepository({ baseUrl: BASE_URL, getLanguage });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("справочник удобств приходит с сервера", () => {
  it("значение фильтра — код записи, а не её UUID", async () => {
    stubApi([entry(), entry({ id: "b1", code: "wifi", name: "Wi-Fi", display_order: 20 })]);

    const amenities = await repository().getAmenities();

    expect(amenities).toEqual([
      { id: "terrace", name: "Терраса" },
      { id: "wifi", name: "Wi-Fi" },
    ]);
  });

  it("отдаётся в порядке справочника, а не в порядке ответа", async () => {
    stubApi([
      entry({ id: "c", code: "wifi", name: "Wi-Fi", display_order: 20 }),
      entry({ id: "a", code: "terrace", name: "Терраса", display_order: 10 }),
    ]);

    expect((await repository().getAmenities()).map((a) => a.id)).toEqual(["terrace", "wifi"]);
  });

  it("удобство БЕЗ единого заведения показывается наравне с остальными", async () => {
    // Шесть записей из девятнадцати на бою имеют venue_count = 0 — владелец
    // заполняет данные сам. Прятать их нельзя: это его справочник.
    stubApi([
      entry(),
      entry({ id: "h", code: "halal", name: "Халал", display_order: 40, venue_count: 0 }),
    ]);

    expect((await repository().getAmenities()).map((a) => a.id)).toEqual(["terrace", "halal"]);
  });

  it("скрытая запись и запись без кода в список не попадают", async () => {
    // Скрытую сервер фильтром не примет, а запись без кода нечем фильтровать —
    // галочка, которая заведомо ничего не сделает, хуже её отсутствия.
    stubApi([
      entry(),
      entry({ id: "x", code: "hidden", name: "Скрытое", is_active: false, display_order: 20 }),
      entry({ id: "y", code: "", name: "Без кода", display_order: 30 }),
    ]);

    expect((await repository().getAmenities()).map((a) => a.id)).toEqual(["terrace"]);
  });

  it("подпись берётся из name_i18n на языке приложения, тег режется до языка", async () => {
    stubApi([entry()]);
    expect((await repository(() => "en-US").getAmenities())[0].name).toBe("Terrace");
  });

  it("нет перевода на нужный язык — остаётся name, который выбрал сервер", async () => {
    // На бою у шести записей `name_i18n` нет вовсе, а языков вроде ko/tr нет
    // ни у одной. Тогда подпись — то, что сервер уже отдал по Accept-Language.
    stubApi([entry({ code: "child_free", name: "Без детей", name_i18n: undefined })]);
    expect((await repository(() => "en").getAmenities())[0].name).toBe("Без детей");
  });

  it("пустой справочник — это пустой список, а не отказ", async () => {
    stubApi([]);
    await expect(repository().getAmenities()).resolves.toEqual([]);
  });
});

describe("выбранные удобства уходят в поиск", () => {
  it("одно удобство уходит параметром features", async () => {
    const api = stubApi([]);
    await repository().searchRestaurants({
      text: "",
      filters: { ...EMPTY_FILTERS, amenityIds: ["terrace"] },
    });

    const url = new URL(api.urls.find((u) => u.includes("/restaurants/search")) ?? "");
    expect(url.searchParams.get("features")).toBe("terrace");
  });

  it("два удобства — ОДИН параметр через запятую: сервер трактует его как И", async () => {
    const api = stubApi([]);
    await repository().searchRestaurants({
      text: "",
      filters: { ...EMPTY_FILTERS, amenityIds: ["terrace", "wifi"] },
    });

    const url = new URL(api.urls.find((u) => u.includes("/restaurants/search")) ?? "");
    expect(url.searchParams.getAll("features")).toEqual(["terrace,wifi"]);
  });

  it("ничего не выбрано — параметра нет вовсе", async () => {
    const api = stubApi([]);
    await repository().searchRestaurants({ text: "", filters: EMPTY_FILTERS });

    const url = new URL(api.urls.find((u) => u.includes("/restaurants/search")) ?? "");
    expect(url.searchParams.has("features")).toBe(false);
  });

  it("выдача под удобство, которого нет ни у кого, — пустая, но успешная", async () => {
    stubApi([]);
    const result = await repository().searchRestaurants({
      text: "",
      filters: { ...EMPTY_FILTERS, amenityIds: ["halal"] },
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});
