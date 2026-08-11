import { describe, expect, it, vi } from "vitest";
import { HttpRestaurantRepository } from "../http-repository";
import {
  mapNotificationFeed,
  type ApiNotificationFeed,
} from "../http-mapping";

/**
 * B5 Part 2 — the «Уведомления» feed.
 *
 * Pins the wire contract the screen depends on: the list is AUTHENTICATED (a
 * feed of the caller's own items, owner derived from the bearer token like GET
 * /bookings), it maps `created_at` → `createdAt` and passes `type` / `read`
 * through, and it carries the whole-inbox `unread_count` that drives the home
 * bell badge. A partial payload must degrade one field, never throw and blank
 * the inbox. Mark-read is a POST to the id's own path with the token attached.
 */

const BASE_URL = "https://api.example.test/api/v1";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("mapNotificationFeed", () => {
  it("maps a page: created_at→createdAt, read/type passthrough, count + cursor", () => {
    const api: ApiNotificationFeed = {
      items: [
        {
          id: "n-1",
          type: "booking",
          title: "Бронь подтверждена",
          body: "Столик на 19:00 подтверждён.",
          booking_id: "b-1",
          restaurant_id: "r-1",
          read: false,
          created_at: "2026-08-07T10:00:00Z",
        },
        {
          id: "n-2",
          type: "promo",
          title: "−20%",
          body: "Скидка на ужин.",
          read: true,
          created_at: "2026-08-06T09:00:00Z",
        },
      ],
      unread_count: 1,
      next_cursor: "opaque-cursor",
    };

    const feed = mapNotificationFeed(api);

    expect(feed.unreadCount).toBe(1);
    expect(feed.nextCursor).toBe("opaque-cursor");
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]).toEqual({
      id: "n-1",
      type: "booking",
      title: "Бронь подтверждена",
      body: "Столик на 19:00 подтверждён.",
      createdAt: "2026-08-07T10:00:00Z",
      read: false,
      bookingId: "b-1",
    });
    // restaurant_id is carried on the wire but still not modelled — no screen
    // opens a venue from the inbox. booking_id IS modelled: the row opens it.
    expect(feed.items[0]).not.toHaveProperty("restaurantId");
    // Уведомление без брони не выдумывает её: bookingId остаётся null.
    expect(feed.items[1]!.bookingId).toBeNull();
    expect(feed.items[1]!.read).toBe(true);
    expect(feed.items[1]!.type).toBe("promo");
  });

  it("an unknown type degrades to reminder rather than being dropped", () => {
    const feed = mapNotificationFeed({
      items: [
        {
          id: "n-3",
          type: "system_broadcast",
          title: "Новость",
          body: "…",
          read: false,
          created_at: "2026-08-07T10:00:00Z",
        },
      ],
      unread_count: 1,
      next_cursor: null,
    });

    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]!.type).toBe("reminder");
  });

  it("a partial payload defaults, never NaN or a broken cursor", () => {
    const feed = mapNotificationFeed({});
    expect(feed.items).toEqual([]);
    expect(feed.unreadCount).toBe(0);
    expect(feed.nextCursor).toBeNull();
  });
});

describe("HttpRestaurantRepository notifications", () => {
  it("listNotifications: authed GET /notifications with a limit, mapped", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({
          data: {
            items: [
              {
                id: "n-1",
                type: "reminder",
                title: "Напоминание",
                body: "Завтра в 13:30.",
                read: false,
                created_at: "2026-08-07T10:00:00Z",
              },
            ],
            unread_count: 1,
            next_cursor: null,
          } satisfies ApiNotificationFeed,
        });
      }),
    );

    const repository = new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    const feed = await repository.listNotifications();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.init.method).toBe("GET");
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/api/v1/notifications");
    // limit is sent; no cursor on the first page.
    expect(url.searchParams.get("limit")).toBe("30");
    expect(url.searchParams.has("cursor")).toBe(false);
    // Authenticated — the owner is derived from the bearer token.
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer token");

    expect(feed.unreadCount).toBe(1);
    expect(feed.items[0]!.createdAt).toBe("2026-08-07T10:00:00Z");
    expect(feed.items[0]!.read).toBe(false);
  });

  it("listNotifications: forwards a cursor when paging", async () => {
    const calls: Array<{ url: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push({ url });
        return jsonResponse({ data: { items: [], unread_count: 0, next_cursor: null } });
      }),
    );

    const repository = new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    await repository.listNotifications("page-2-cursor");

    expect(new URL(calls[0]!.url).searchParams.get("cursor")).toBe("page-2-cursor");
  });

  it("markNotificationRead: authed POST to the id's own path", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({ data: {} });
      }),
    );

    const repository = new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    await repository.markNotificationRead("n-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.init.method).toBe("POST");
    expect(new URL(calls[0]!.url).pathname).toBe("/api/v1/notifications/n-1/read");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer token");
  });

  it("markAllNotificationsRead: authed POST /notifications/read-all", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({ data: {} });
      }),
    );

    const repository = new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    await repository.markAllNotificationsRead();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.init.method).toBe("POST");
    expect(new URL(calls[0]!.url).pathname).toBe("/api/v1/notifications/read-all");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer token");
  });
});
