import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS } from "../types";
import { HttpRestaurantRepository } from "../http-repository";

/**
 * Чип «Утро» ДОЛЖЕН СУЖАТЬ ВЫДАЧУ, а не быть украшением.
 *
 * Сужает его сервер: «Утро» раскрывается в то же окно `time_from`/`time_to`,
 * которое понимает `availabilityFilter` в бэкенде
 * (internal/transport/rest/restaurants/handler.go). Проверить на клиенте можно
 * ровно одно — что окно действительно уходит и уходит правильное. Если оно
 * перестанет уходить, человек увидит «Утро» выбранным и тот же список, что и
 * без него, — фасет-декорация, ровно то, за что уже приходилось чинить
 * фильтры удобств.
 */

const BASE_URL = "https://api.example.test/api/v1";

function repository() {
  return new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "token" });
}

function captureSearchUrl(): { url: () => string } {
  const seen: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ data: { items: [], total: 0 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return { url: () => seen.find((u) => u.includes("/restaurants/search")) ?? "" };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("время суток в поиске", () => {
  it("«Утро» уходит на сервер окном до 12:00", async () => {
    const captured = captureSearchUrl();
    await repository().searchRestaurants({
      text: "",
      filters: {
        ...EMPTY_FILTERS,
        availability: { date: "2026-08-26", guests: 2, timeOfDay: "morning" },
      },
    });

    const url = new URL(captured.url());
    expect(url.searchParams.get("time_from")).toBe("00:00");
    expect(url.searchParams.get("time_to")).toBe("12:00");
    // Дата и гости обязаны ехать вместе с окном: без них сервер окно
    // игнорирует, и «Утро» ничего бы не сузило.
    expect(url.searchParams.get("date")).toBe("2026-08-26");
    expect(url.searchParams.get("guests")).toBe("2");
  });

  it("«Обед» и «Ужин» — свои окна, не пересекающиеся с утром", async () => {
    const captured = captureSearchUrl();
    await repository().searchRestaurants({
      text: "",
      filters: {
        ...EMPTY_FILTERS,
        availability: { date: "2026-08-26", guests: 2, timeOfDay: "lunch" },
      },
    });
    expect(new URL(captured.url()).searchParams.get("time_from")).toBe("12:00");

    const dinner = captureSearchUrl();
    await repository().searchRestaurants({
      text: "",
      filters: {
        ...EMPTY_FILTERS,
        availability: { date: "2026-08-26", guests: 2, timeOfDay: "dinner" },
      },
    });
    expect(new URL(dinner.url()).searchParams.get("time_from")).toBe("18:00");
  });

  it("выбранное время суток перекрывает явные часы, а не спорит с ними", async () => {
    const captured = captureSearchUrl();
    await repository().searchRestaurants({
      text: "",
      filters: {
        ...EMPTY_FILTERS,
        availability: {
          date: "2026-08-26",
          guests: 2,
          timeFrom: "19:00",
          timeTo: "21:00",
          timeOfDay: "morning",
        },
      },
    });

    const url = new URL(captured.url());
    expect(url.searchParams.get("time_from")).toBe("00:00");
    expect(url.searchParams.get("time_to")).toBe("12:00");
  });

  it("без выбора времени суток окно не появляется само", async () => {
    const captured = captureSearchUrl();
    await repository().searchRestaurants({
      text: "",
      filters: { ...EMPTY_FILTERS, availability: { date: "2026-08-26", guests: 2 } },
    });

    const url = new URL(captured.url());
    expect(url.searchParams.has("time_from")).toBe(false);
    expect(url.searchParams.has("time_to")).toBe(false);
  });
});
