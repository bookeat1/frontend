import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminApiClient } from "../admin/client";
import { HttpRestaurantRepository } from "../http-repository";

/**
 * Провод блока «Выбрали для вас» — гостевая и админская стороны.
 *
 * Здесь закрепляются ровно те три вещи, которые невидимы на экране и потому
 * ломаются молча:
 *
 *  1. блок спрашивает ОТДЕЛЬНУЮ ручку `/restaurants/picks`, а не каталог с
 *     `is_popular=true`. Каталог ответит похоже — но не ручным списком, и
 *     владелец увидит, что админка «ничего не меняет»;
 *  2. порядок ответа берётся КАК ЕСТЬ. В ручном списке порядок — это решение
 *     владельца, и любая сортировка у клиента его стирает;
 *  3. запись — это ПОЛНАЯ замена (`PUT` со всем списком), а пустой список —
 *     законное «вернуть блок к автоматическому подбору», а не отказ.
 */

const BASE_URL = "https://api.example.test/api/v1";

interface Captured {
  urls: () => string[];
  bodies: () => unknown[];
  methods: () => string[];
}

function capture(items: unknown[] = []): Captured {
  const urls: string[] = [];
  const bodies: unknown[] = [];
  const methods: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      urls.push(String(input));
      methods.push(init?.method ?? "GET");
      bodies.push(init?.body ? JSON.parse(String(init.body)) : undefined);
      return new Response(
        JSON.stringify({ data: { items, total: items.length, page: 1, per_page: items.length } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  );
  return { urls: () => urls, bodies: () => bodies, methods: () => methods };
}

/** Same as `capture`, but also records the `Authorization` header each
 * request carried (or its absence) — this is the thing OptionalAuth needs to
 * tell a signed-in guest from an anonymous one. */
function captureAuth(items: unknown[] = []): { authHeaders: () => Array<string | null> } {
  const authHeaders: Array<string | null> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      authHeaders.push(new Headers(init?.headers).get("Authorization"));
      return new Response(
        JSON.stringify({ data: { items, total: items.length, page: 1, per_page: items.length } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  );
  return { authHeaders: () => authHeaders };
}

function venue(id: string, name: string) {
  return { id, name, city: "Астана", is_active: true };
}

/** Ответ ручки в персональном режиме (спека
 * `foodie-personalization-v1-20260916.md` §5.6): `mode: "for_you"` и `match`
 * на карточке. */
function venueWithMatch(id: string, name: string) {
  return {
    id,
    name,
    city: "Астана",
    is_active: true,
    match: {
      score: 600,
      reasons: [
        { code: "cuisine_match", points: 400, params: { cuisine_codes: ["italian"] } },
        { code: "budget_match", points: 200, detail: "same tier" },
      ],
    },
  };
}

function captureWithMode(items: unknown[], mode: string): Captured {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(
        JSON.stringify({ data: { items, total: items.length, page: 1, per_page: items.length, mode } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  );
  return { urls: () => urls, bodies: () => [], methods: () => [] };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("гость: GET /restaurants/picks", () => {
  it("идёт в ручку picks и передаёт город и лимит", async () => {
    const seen = capture();
    await new HttpRestaurantRepository({ baseUrl: BASE_URL }).getRecommendedRestaurants(
      "Астана",
      8,
    );

    const url = new URL(seen.urls()[0]);
    expect(url.pathname.endsWith("/restaurants/picks")).toBe(true);
    expect(url.searchParams.get("city")).toBe("Астана");
    expect(url.searchParams.get("limit")).toBe("8");
    // Старого способа собрать блок больше нет — если он вернётся, ручной
    // список перестанет доходить до главной.
    expect(url.searchParams.get("is_popular")).toBeNull();
  });

  it("порядок ответа сервера сохраняется — это порядок, заданный руками", async () => {
    const seen = capture([venue("b", "Б"), venue("a", "А"), venue("c", "В")]);
    const out = await new HttpRestaurantRepository({ baseUrl: BASE_URL }).getRecommendedRestaurants(
      "Астана",
    );

    expect(out.items.map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(seen.urls()).toHaveLength(1);
  });

  /** Старый ответ (без `mode`, бэкенд до PR #138) — трактуется как `"popular"`:
   * заголовок не переключается, поведение побайтно как раньше. */
  it("ответ без mode (старый бэкенд) — трактуется как popular", async () => {
    capture([venue("a", "А")]);
    const out = await new HttpRestaurantRepository({ baseUrl: BASE_URL }).getRecommendedRestaurants(
      "Астана",
    );

    expect(out.mode).toBe("popular");
  });

  /** `mode: "for_you"` + `match` — персональный режим (спека
   * `foodie-personalization-v1-20260916.md` §5.6). */
  it("mode: for_you — читает mode и match карточки", async () => {
    captureWithMode([venueWithMatch("a", "Il Primo")], "for_you");
    const out = await new HttpRestaurantRepository({ baseUrl: BASE_URL }).getRecommendedRestaurants(
      "Астана",
    );

    expect(out.mode).toBe("for_you");
    expect(out.items[0]?.match).toEqual({
      score: 600,
      reasons: [
        { code: "cuisine_match", points: 400, params: { cuisineCodes: ["italian"] }, detail: "" },
        { code: "budget_match", points: 200, detail: "same tier" },
      ],
    });
  });

  it("пустой город не уезжает параметром: это запрос списка «для всех городов»", async () => {
    const seen = capture();
    await new HttpRestaurantRepository({ baseUrl: BASE_URL }).getRecommendedRestaurants("  ");

    expect(new URL(seen.urls()[0]).searchParams.has("city")).toBe(false);
  });

  it("пустой ответ — это нормальный ответ, а не ошибка", async () => {
    capture([]);
    await expect(
      new HttpRestaurantRepository({ baseUrl: BASE_URL }).getRecommendedRestaurants("Астана"),
    ).resolves.toEqual({ items: [], mode: "popular" });
  });

  /**
   * Живой баг 2026-09-16: гость заполнил фуди-профиль, ряд «Выбрали для вас»
   * не изменился. Причина — `getRecommendedRestaurants` не передавала
   * `{ optionalAuth: true }`, поэтому запрос уходил БЕЗ токена вообще, и
   * бэкенд не мог отличить вошедшего гостя от анонима: `mode` навсегда
   * застревал на `"editorial"`/`"popular"`, что бы ни было в профиле.
   */
  it("вошедший гость шлёт токен — иначе OptionalAuth ручка никогда не увидит, кто спрашивает", async () => {
    const seen = captureAuth();
    await new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "guest-token" })
      .getRecommendedRestaurants("Алматы");

    expect(seen.authHeaders()).toEqual(["Bearer guest-token"]);
  });

  it("анонимный гость — запрос всё равно уходит, просто без токена", async () => {
    const seen = captureAuth();
    await new HttpRestaurantRepository({ baseUrl: BASE_URL }).getRecommendedRestaurants("Алматы");

    expect(seen.authHeaders()).toEqual([null]);
  });
});

describe("админка: чтение и запись подборки", () => {
  function client() {
    return new AdminApiClient({ baseUrl: BASE_URL, getToken: () => "token" });
  }

  it("читает подборку города админской ручкой", async () => {
    const seen = capture([venue("a", "А")]);
    const page = await client().listHomePicks("Астана");

    const url = new URL(seen.urls()[0]);
    expect(url.pathname.endsWith("/admin/restaurants/picks")).toBe(true);
    expect(url.searchParams.get("city")).toBe("Астана");
    expect(page.items.map((v) => v.id)).toEqual(["a"]);
  });

  it("список «для всех городов» читается без параметра города", async () => {
    const seen = capture();
    await client().listHomePicks();

    expect(new URL(seen.urls()[0]).searchParams.has("city")).toBe(false);
  });

  it("сохранение отправляет ВЕСЬ список одним PUT, в заданном порядке", async () => {
    const seen = capture();
    await client().replaceHomePicks("Астана", ["b", "a", "c"]);

    expect(seen.methods()[0]).toBe("PUT");
    expect(new URL(seen.urls()[0]).pathname.endsWith("/admin/restaurants/picks")).toBe(true);
    expect(seen.bodies()[0]).toEqual({ city: "Астана", restaurant_ids: ["b", "a", "c"] });
  });

  it("пустой список — это «вернуть блок к автоматическому подбору», а не отказ", async () => {
    const seen = capture();
    await client().replaceHomePicks("Астана", []);

    expect(seen.bodies()[0]).toEqual({ city: "Астана", restaurant_ids: [] });
  });
});

/**
 * `GET /events?sort=for_you` — только «Афиша» на главной шлёт этот параметр
 * (спека `foodie-personalization-v1-20260916.md` §5.6/§19/§26). Проверяем
 * провод: параметр уходит, когда его передали, и не уходит вовсе (не пустой
 * строкой), когда его не передали — полный список `/events` его не знает.
 */
describe("гость: GET /events sort=for_you", () => {
  it("sort уходит параметром, когда его передали", async () => {
    const seen = capture();
    await new HttpRestaurantRepository({ baseUrl: BASE_URL }).listUpcomingEvents({
      city: "Астана",
      sort: "for_you",
    });

    expect(new URL(seen.urls()[0]).searchParams.get("sort")).toBe("for_you");
  });

  it("без sort параметр не уходит вовсе — полный список /events по дате", async () => {
    const seen = capture();
    await new HttpRestaurantRepository({ baseUrl: BASE_URL }).listUpcomingEvents({
      city: "Астана",
    });

    expect(new URL(seen.urls()[0]).searchParams.has("sort")).toBe(false);
  });

  it("вошедший гость шлёт токен на sort=for_you — та же ошибка 2026-09-16, что у picks", async () => {
    const seen = captureAuth();
    await new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "guest-token" })
      .listUpcomingEvents({ city: "Алматы", sort: "for_you" });

    expect(seen.authHeaders()).toEqual(["Bearer guest-token"]);
  });
});

describe("гость: GET /feed (ряд «Акции»)", () => {
  it("вошедший гость шлёт токен — иначе персональная сортировка ленты недостижима", async () => {
    const seen = captureAuth();
    await new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "guest-token" })
      .getPromotions("Алматы");

    expect(seen.authHeaders()).toEqual(["Bearer guest-token"]);
  });
});
