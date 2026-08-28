import { describe, expect, it, vi } from "vitest";

import { AdminApiClient } from "../admin/client";

/**
 * REGRESSION GUARD — блоки «Средний чек» и «Соцсети» не открывались у
 * ВЫКЛЮЧЕННОГО заведения.
 *
 * Обе карточки читали заведение публичной ручкой `GET /restaurants/:id`, а она
 * обслуживает каталог: у заведения с `is_active = false` она отвечает 404.
 * Панель показывала на этом «Не удалось загрузить. Проверьте соединение» — и
 * человек шёл искать поломку в сети, которой не было (проверено на бою:
 * заведение 85817ed1-3775-42f9-a453-c4f08462899b выключено, публичная ручка
 * даёт 404).
 *
 * Читать надо кабинетной ручкой `GET /admin/restaurants/:id`: тот же
 * `RequireRestaurantManager(…, "id")`, что и у записи, выключенные заведения
 * видны, `price_range` и `social_links` в ответе есть. ЗАПИСЬ остаётся на
 * `PATCH /restaurants/:id` — она смонтирована не под `/admin`, и путать эти два
 * пути нельзя.
 */

const BASE = "https://api.example.test/api/v1";
const VENUE = "85817ed1-3775-42f9-a453-c4f08462899b";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function client(fetchMock: typeof fetch): AdminApiClient {
  vi.stubGlobal("fetch", fetchMock);
  return new AdminApiClient({ baseUrl: BASE, getToken: () => "token" });
}

function urlOf(call: unknown[]): string {
  return String(call[0]);
}

function methodOf(call: unknown[]): string | undefined {
  return (call[1] as RequestInit).method;
}

describe("чтение заведения кабинетом", () => {
  it("«Средний чек» читается админской ручкой, а не публичной карточкой", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: { price_category: "₸₸", price_range: { min: 5000, max: 15000 } },
      }),
    );
    const api = client(fetchMock as unknown as typeof fetch);

    await expect(api.getRestaurantPricing(VENUE)).resolves.toMatchObject({
      price_category: "₸₸",
    });
    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${BASE}/admin/restaurants/${VENUE}`);
    expect(methodOf(fetchMock.mock.calls[0])).toBe("GET");
  });

  it("«Соцсети» читаются той же админской ручкой", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: { social_links: [{ id: "s-1", type: "website", url: "https://yurta.kz" }] },
      }),
    );
    const api = client(fetchMock as unknown as typeof fetch);

    await expect(api.getRestaurantSocialLinks(VENUE)).resolves.toEqual([
      { id: "s-1", type: "website", url: "https://yurta.kz" },
    ]);
    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${BASE}/admin/restaurants/${VENUE}`);
  });

  it("отсутствие ключа social_links — это «ссылок нет», а не ошибка (omitempty)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: { id: VENUE } }));
    const api = client(fetchMock as unknown as typeof fetch);

    await expect(api.getRestaurantSocialLinks(VENUE)).resolves.toEqual([]);
  });

  it("404 остаётся 404: ручка видит выключенные, поэтому это «заведения здесь нет»", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(404, { error: "restaurant not found" }));
    const api = client(fetchMock as unknown as typeof fetch);

    await expect(api.getRestaurantPricing(VENUE)).rejects.toMatchObject({ status: 404 });
  });

  it("ЗАПИСЬ не переезжает под /admin: PATCH смонтирован на голом /restaurants/:id", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: { price_category: "₸₸" } }));
    const api = client(fetchMock as unknown as typeof fetch);

    await api.patchRestaurant(VENUE, { price_category: "₸₸" });
    await api.setRestaurantSocialLinks(VENUE, [{ type: "website", url: "https://yurta.kz" }]);

    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${BASE}/restaurants/${VENUE}`);
    expect(methodOf(fetchMock.mock.calls[0])).toBe("PATCH");
    expect(urlOf(fetchMock.mock.calls[1])).toBe(`${BASE}/restaurants/${VENUE}`);
    expect(methodOf(fetchMock.mock.calls[1])).toBe("PATCH");
  });
});
