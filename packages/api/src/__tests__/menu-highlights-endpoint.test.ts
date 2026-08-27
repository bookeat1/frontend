import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpRestaurantRepository } from "../http-repository";

/**
 * Лента «Лучшие позиции» приезжает С СЕРВЕРА и в его порядке.
 *
 * До 2026-08-27 её собирал клиент: качал `GET /restaurants/:id/menu` (у живого
 * заведения ~300 блюд), фильтровал по `is_available`, сортировал по
 * `display_order` и брал первые восемь. Заведение могло влиять на свою витрину
 * только порядком всего меню, а сказать «вот это — наше фирменное» ему было
 * негде. Теперь правило одно и живёт в `usecase/menu.resolveHighlights`, а
 * приложение обязано СЛУШАТЬСЯ: если оно снова начнёт пересортировывать ответ,
 * отметки заведения перестанут работать молча.
 *
 * Форма ответа — `menuItemResponse` (internal/transport/rest/menu/response.go),
 * проверена curl'ом на бою 2026-08-27: `price_minor: 550000`, `is_top_pick`.
 */

const BASE_URL = "https://api.example.test/api/v1";

interface Recorded {
  urls: string[];
}

function stubBackend(highlights: unknown[]): Recorded {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      const body = url.includes("/menu-highlights")
        ? highlights
        : url.includes("/reviews/summary")
          ? { restaurant_id: "r-1", average: 4.5, count: 10 }
          : url.includes("/promos")
            ? { items: [], total: 0 }
            : {
                id: "r-1",
                name: "Social Coffee",
                address: "пр. Достык 1",
                price_category: "₸₸",
                accepts_online_bookings: true,
              };
      return new Response(JSON.stringify({ data: body }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return { urls };
}

function apiDish(overrides: Record<string, unknown> = {}) {
  return {
    id: "d-1",
    restaurant_id: "r-1",
    name: "Английский завтрак",
    description: "",
    price: "5500.00",
    price_minor: 550_000,
    is_available: true,
    is_top_pick: false,
    image_url: null,
    category: "Завтраки",
    display_order: 0,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("лента «Лучшие позиции» — с сервера", () => {
  it("экран заведения запрашивает /menu-highlights, а не всё меню", async () => {
    const recorded = stubBackend([apiDish()]);
    const repo = new HttpRestaurantRepository({ baseUrl: BASE_URL });

    await repo.getRestaurant("r-1");

    const rail = recorded.urls.find((u) => u.includes("/menu-highlights"));
    expect(rail).toBeTruthy();
    // Лимит уходит серверу параметром: резать ответ на клиенте — это и была
    // старая самодельная лента.
    expect(new URL(rail!).searchParams.get("limit")).toBe("8");
    // И всё меню больше не качается ради восьми карточек.
    expect(recorded.urls.some((u) => /\/restaurants\/r-1\/menu(\?|$)/.test(u))).toBe(false);
  });

  it("порядок и отметка заведения доезжают до экрана нетронутыми", async () => {
    stubBackend([
      apiDish({ id: "d-9", name: "Фирменный плов", display_order: 99, is_top_pick: true }),
      apiDish({ id: "d-1", name: "Добивка", display_order: 1 }),
    ]);

    const restaurant = await new HttpRestaurantRepository({ baseUrl: BASE_URL }).getRestaurant("r-1");

    expect(restaurant.menuHighlights.map((d) => d.name)).toEqual(["Фирменный плов", "Добивка"]);
    expect(restaurant.menuHighlights.map((d) => d.isTopPick)).toEqual([true, false]);
  });

  it("цена приезжает числом — из неё карточка считает «Добавить · итого»", async () => {
    stubBackend([apiDish({ price: "5500.00", price_minor: 550_000 })]);

    const restaurant = await new HttpRestaurantRepository({ baseUrl: BASE_URL }).getRestaurant("r-1");

    expect(restaurant.menuHighlights[0].priceMinor).toBe(550_000);
  });

  it("сервер не дал числа — priceMinor null, а не ноль и не разбор строки", async () => {
    stubBackend([apiDish({ price_minor: null })]);

    const restaurant = await new HttpRestaurantRepository({ baseUrl: BASE_URL }).getRestaurant("r-1");

    expect(restaurant.menuHighlights[0].priceMinor).toBeNull();
    // Строку показать всё равно можно — она пришла готовой.
    expect(restaurant.menuHighlights[0].price.replace(/\s/g, "")).toBe("5500₸");
  });
});
