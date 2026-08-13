import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS } from "../types";
import { HttpRestaurantRepository } from "../http-repository";

/**
 * Фильтр «есть стол на N гостей в такой-то день» считает ТОЛЬКО сервер: у
 * телефона нет ни столов заведения, ни чужих броней. Значит единственное, что
 * можно проверить на клиенте, — что запрос действительно уходит и уходит
 * целиком.
 *
 * Что ломается для человека, если пара распадётся: сервер игнорирует дату без
 * гостей и гостей без даты. Экран при этом показывает выбранное «пятница, 2
 * гостя», список остаётся прежним, и человек идёт бронировать туда, где стола
 * нет. Внешне это неотличимо от работающего фильтра — поэтому проверяется, что
 * оба параметра либо есть, либо нет.
 */

const BASE_URL = "https://api.example.test/api/v1";

function repository() {
  return new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "token" });
}

/** Ловит URL запроса к каталогу и отвечает пустой страницей. */
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

describe("поиск с фильтром по свободным столам", () => {
  it("отправляет дату и гостей на сервер", async () => {
    const captured = captureSearchUrl();
    await repository().searchRestaurants({
      text: "",
      filters: { ...EMPTY_FILTERS, availability: { date: "2026-08-21", guests: 4 } },
    });

    const url = new URL(captured.url());
    expect(url.searchParams.get("date")).toBe("2026-08-21");
    expect(url.searchParams.get("guests")).toBe("4");
  });

  it("передаёт окно времени, когда оно выбрано", async () => {
    const captured = captureSearchUrl();
    await repository().searchRestaurants({
      text: "",
      filters: {
        ...EMPTY_FILTERS,
        availability: { date: "2026-08-21", guests: 2, timeFrom: "19:00", timeTo: "21:00" },
      },
    });

    const url = new URL(captured.url());
    expect(url.searchParams.get("time_from")).toBe("19:00");
    expect(url.searchParams.get("time_to")).toBe("21:00");
  });

  it("без фильтра не отправляет ни дату, ни гостей", async () => {
    const captured = captureSearchUrl();
    await repository().searchRestaurants({ text: "", filters: EMPTY_FILTERS });

    const url = new URL(captured.url());
    expect(url.searchParams.has("date")).toBe(false);
    expect(url.searchParams.has("guests")).toBe(false);
  });
});
