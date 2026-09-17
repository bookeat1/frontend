import { describe, expect, it, vi } from "vitest";

import { AdminApiClient } from "../admin/client";

/**
 * `updateMenuItem` — правка одного блюда через `PATCH
 * /admin/restaurants/:id/menu-items/:itemId` (admin.updateMenuItem →
 * menuuc.ItemInput). Панель сегодня зовёт её только ради фото (см.
 * MenuItemPatch в types.ts), но ручка честно партиальная: только присланные
 * ключи меняются, остальное сервер не трогает (menu/facade.go: applyItem
 * поверх загруженной записи).
 */

const BASE = "https://api.example.test/api/v1";
const RESTAURANT = "85817ed1-3775-42f9-a453-c4f08462899b";
const ITEM = "b2c3d4e5-f6a7-4890-9abc-def012345678";

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

function bodyOf(call: unknown[]): unknown {
  return JSON.parse((call[1] as RequestInit).body as string);
}

function methodOf(call: unknown[]): string | undefined {
  return (call[1] as RequestInit).method;
}

describe("updateMenuItem", () => {
  it("PATCHes the item endpoint with exactly the given patch", async () => {
    const responseItem = {
      id: ITEM,
      restaurant_id: RESTAURANT,
      name: "Бешбармак",
      description: "",
      price: "4500",
      image_url: "https://pub-x.r2.dev/menu/besh.jpg",
      is_available: true,
      category: "Горячее",
      subcategory: null,
      portion_size: null,
      display_order: 1,
      tags: [],
    };
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: responseItem }));
    const api = client(fetchMock as unknown as typeof fetch);

    const result = await api.updateMenuItem(RESTAURANT, ITEM, {
      image_url: "https://pub-x.r2.dev/menu/besh.jpg",
    });

    expect(urlOf(fetchMock.mock.calls[0])).toBe(
      `${BASE}/admin/restaurants/${RESTAURANT}/menu-items/${ITEM}`,
    );
    expect(methodOf(fetchMock.mock.calls[0])).toBe("PATCH");
    // Ровно один ключ — не полная запись блюда, только то, что прислано.
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
      image_url: "https://pub-x.r2.dev/menu/besh.jpg",
    });
    expect(result).toEqual(responseItem);
  });

  it("an empty string clears the photo instead of leaving the key out", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { data: { id: ITEM, image_url: null } }),
    );
    const api = client(fetchMock as unknown as typeof fetch);

    await api.updateMenuItem(RESTAURANT, ITEM, { image_url: "" });

    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({ image_url: "" });
  });

  it("a rejected save surfaces the status on AdminApiError", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(422, { error: "validation failed" }));
    const api = client(fetchMock as unknown as typeof fetch);

    await expect(
      api.updateMenuItem(RESTAURANT, ITEM, { image_url: "not a url" }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
