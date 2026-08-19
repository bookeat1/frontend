import { describe, expect, it, vi } from "vitest";
import { HttpRestaurantRepository } from "../http-repository";
import { mapFavoriteItems, type ApiFavoriteItems } from "../http-mapping";
import { favoriteEventKey } from "../types";

/**
 * Контракт `GET /favorites/items` и трёх идемпотентных ручек избранного для
 * событий и акций (живой прод, 2026-08-19).
 *
 * Что здесь закреплено и почему это не украшение:
 *   - `counts` считается по ВСЕМ видам, даже когда `type=` сузил items — на
 *     этом стоит весь ряд чипов (одна выдача, ноль лишних запросов);
 *   - у повторяющегося события ключ — `recurrence_id`, а `id` приходит от
 *     БЛИЖАЙШЕЙ будущей даты серии и с сохранённым может не совпадать;
 *   - строка неизвестного вида или без сущности выбрасывается, а не роняет
 *     весь список: новый вид на сервере укоротит выдачу, но не сломает экран.
 */

const BASE_URL = "https://api.example.test/api/v1";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("mapFavoriteItems", () => {
  const payload: ApiFavoriteItems = {
    items: [
      {
        kind: "event",
        favorited_at: "2026-08-19T10:00:00Z",
        event: {
          id: "occ-2",
          restaurant_id: "r-1",
          restaurant_name: "Mongol Bar",
          city: "Алматы",
          title: "Cocktail Wednesday",
          description: "<p>Каждую среду</p>",
          starts_at: "2026-08-26T13:00:00Z",
          ends_at: "2026-08-26T16:00:00Z",
          cover_image_url: "https://cdn.example/e.jpg",
          tags: ["Бар", ""],
          ticketed: false,
          is_recurring: true,
          recurrence_id: "rec-1",
        },
      },
      {
        kind: "promo",
        favorited_at: "2026-08-18T10:00:00Z",
        promo: {
          id: "p-1",
          restaurant_id: "r-2",
          restaurant_name: "INZHU",
          city: "Алматы",
          title: "−30% на завтраки",
          description: "Скидка",
          terms: "Кроме выходных",
          starts_at: "2026-08-01T00:00:00Z",
          ends_at: "2026-09-01T00:00:00Z",
          discount_percent: 30,
        },
      },
    ],
    counts: { all: 5, restaurants: 3, events: 1, promos: 1 },
  };

  it("разбирает событие и акцию, HTML описания приводит к тексту", () => {
    const result = mapFavoriteItems(payload);

    expect(result.items).toHaveLength(2);
    const [event, promo] = result.items;
    if (event.kind !== "event" || promo.kind !== "promo") throw new Error("wrong kinds");

    expect(event.event.id).toBe("occ-2");
    expect(event.event.recurrenceId).toBe("rec-1");
    expect(event.event.isRecurring).toBe(true);
    expect(event.event.description).toBe("Каждую среду");
    // Пустая метка выброшена — серых пустых пилюль в ряду чипов не бывает.
    expect(event.event.tags).toEqual(["Бар"]);
    // Обложки нет в payload акции — это null, а не "undefined" строкой.
    expect(promo.promo.coverImageUrl).toBeNull();
    expect(promo.promo.terms).toBe("Кроме выходных");
    expect(promo.promo.discountPercent).toBe(30);
  });

  it("ключ повторяющегося события — серия, а не дата", () => {
    const result = mapFavoriteItems(payload);
    const item = result.items[0];
    if (item.kind !== "event") throw new Error("wrong kind");

    // Именно это отличает «сохранено» от «пустое сердечко» на соседней дате.
    expect(favoriteEventKey(item.event)).toBe("rec-1");
    expect(favoriteEventKey({ id: "one-off", recurrenceId: null })).toBe("one-off");
  });

  it("counts берутся как есть — они про ВСЕ виды, а не про выданные items", () => {
    // Сервер отдал две строки и counts.all = 5: так и должно быть при type=.
    expect(mapFavoriteItems(payload).counts).toEqual({
      all: 5,
      restaurants: 3,
      events: 1,
      promos: 1,
    });
  });

  it("строка неизвестного вида и строка без сущности выбрасываются", () => {
    const result = mapFavoriteItems({
      items: [
        { kind: "collection", favorited_at: "2026-08-19T10:00:00Z" },
        { kind: "event", favorited_at: "2026-08-19T10:00:00Z" },
        { kind: "promo", favorited_at: "2026-08-19T10:00:00Z", promo: { title: "без id" } },
      ],
      counts: { all: 3, restaurants: 0, events: 1, promos: 2 },
    });

    expect(result.items).toEqual([]);
    // Счётчики — ответ сервера, мы их не пересчитываем под свою фильтрацию.
    expect(result.counts.all).toBe(3);
  });

  it("пустой ответ — это пустой список и нули, а не бросок", () => {
    expect(mapFavoriteItems(undefined)).toEqual({
      items: [],
      counts: { all: 0, restaurants: 0, events: 0, promos: 0 },
    });
  });
});

describe("HttpRestaurantRepository — избранное событий и акций", () => {
  function repositoryWith(fetchMock: ReturnType<typeof vi.fn>) {
    vi.stubGlobal("fetch", fetchMock);
    return new HttpRestaurantRepository({
      baseUrl: BASE_URL,
      getToken: () => "token-123",
    });
  }

  it("GET /favorites/items идёт с токеном и без type, когда его не просили", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      jsonResponse({ data: { items: [], counts: { all: 0, restaurants: 0, events: 0, promos: 0 } } }),
    );
    const repository = repositoryWith(fetchMock);

    await repository.getFavoriteItems();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/favorites/items`);
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-123");
  });

  it("type= передаётся, когда вызывающий его задал", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      jsonResponse({ data: { items: [], counts: { all: 0, restaurants: 0, events: 0, promos: 0 } } }),
    );
    const repository = repositoryWith(fetchMock);

    await repository.getFavoriteItems("event");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE_URL}/favorites/items?type=event`);
  });

  it("PUT/DELETE бьют в собственные пути события и акции", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      jsonResponse({ data: {} }),
    );
    const repository = repositoryWith(fetchMock);

    await repository.addEventFavorite("e-1");
    await repository.removeEventFavorite("e-1");
    await repository.addPromoFavorite("p-1");
    await repository.removePromoFavorite("p-1");

    const calls = fetchMock.mock.calls.map(([url, init]) => [url, init.method]);
    expect(calls).toEqual([
      [`${BASE_URL}/events/e-1/favorite`, "PUT"],
      [`${BASE_URL}/events/e-1/favorite`, "DELETE"],
      [`${BASE_URL}/promos/p-1/favorite`, "PUT"],
      [`${BASE_URL}/promos/p-1/favorite`, "DELETE"],
    ]);
  });

  it("id экранируется — он приходит из ссылки, а не из нашего кода", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      jsonResponse({ data: {} }),
    );
    const repository = repositoryWith(fetchMock);

    await repository.addEventFavorite("e 1/../admin");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE_URL}/events/e%201%2F..%2Fadmin/favorite`);
  });
});
