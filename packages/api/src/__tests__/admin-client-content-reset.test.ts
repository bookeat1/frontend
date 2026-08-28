import { describe, expect, it, vi } from "vitest";

import { AdminApiClient } from "../admin/client";

/**
 * `POST /admin/events/:id/content/reset` — возврат контента ОДНОЙ ДАТЫ к общему
 * контенту серии (migration 0097).
 *
 * Сервер читает отсутствующее тело как «сбросить всё», а список полей — как
 * «сбросить только эти». Разница видна только в теле запроса, поэтому она и
 * прибита здесь: клиент, который всегда шлёт `{"fields":[]}`, работает по
 * счастливой случайности, а не по контракту.
 */

const BASE = "https://api.example.test/api/v1";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function client() {
  return new AdminApiClient({ baseUrl: BASE, getToken: () => "tok-1" });
}

describe("resetEventContent", () => {
  it("без списка полей шлёт POST БЕЗ тела — это и есть «вернуть весь контент серии»", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: { id: "e-1" } }));
    vi.stubGlobal("fetch", fetchMock);

    await client().resetEventContent("e-1");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/admin/events/e-1/content/reset`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
  });

  it("со списком полей шлёт ровно их — «верни обложку, текст оставь мой»", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: { id: "e-1" } }));
    vi.stubGlobal("fetch", fetchMock);

    await client().resetEventContent("e-1", ["cover_image_url"]);

    const init = fetchMock.mock.calls[0]![1];
    expect(JSON.parse(init.body as string)).toEqual({ fields: ["cover_image_url"] });
  });

  it("экранирует идентификатор события в пути", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: { id: "e/1" } }));
    vi.stubGlobal("fetch", fetchMock);

    await client().resetEventContent("e/1");

    expect(String(fetchMock.mock.calls[0]![0])).toBe(`${BASE}/admin/events/e%2F1/content/reset`);
  });
});
