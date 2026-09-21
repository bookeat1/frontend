import { describe, expect, it, vi } from "vitest";
import { HttpRestaurantRepository } from "../http-repository";
import { mapNotificationPreferences, type ApiNotificationPreferences } from "../http-mapping";

/**
 * push-campaigns spec, §4 criterion 34 — the first client to call
 * `GET/PUT /notification-preferences` (`transport/rest/consent`).
 *
 * `promoPushEnabled` is new (migration 0111); the three existing fields keep
 * their `boolOrTrue` default so a guest with no stored preferences row reads
 * as fully opted in (`domain.DefaultNotificationPreference` — opt-out, not
 * opt-in, per the spec's owner decision).
 */

const BASE_URL = "https://api.example.test/api/v1";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("mapNotificationPreferences", () => {
  it("maps all four fields, snake_case to camelCase", () => {
    const api: ApiNotificationPreferences = {
      notifications_enabled: true,
      push_enabled: false,
      email_enabled: true,
      promo_push_enabled: false,
      updated_at: "2026-09-17T10:00:00Z",
    };
    expect(mapNotificationPreferences(api)).toEqual({
      notificationsEnabled: true,
      pushEnabled: false,
      emailEnabled: true,
      promoPushEnabled: false,
      updatedAt: "2026-09-17T10:00:00Z",
    });
  });

  it("a missing/non-boolean field defaults to true — a guest with no stored row", () => {
    expect(mapNotificationPreferences({})).toEqual({
      notificationsEnabled: true,
      pushEnabled: true,
      emailEnabled: true,
      promoPushEnabled: true,
      updatedAt: "",
    });
  });
});

describe("HttpRestaurantRepository notification preferences", () => {
  it("getNotificationPreferences: authed GET /notification-preferences, mapped", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({
          data: {
            notifications_enabled: true,
            push_enabled: true,
            email_enabled: true,
            promo_push_enabled: false,
            updated_at: "2026-09-17T10:00:00Z",
          } satisfies ApiNotificationPreferences,
        });
      }),
    );

    const repository = new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    const prefs = await repository.getNotificationPreferences();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.init.method).toBe("GET");
    expect(new URL(calls[0]!.url).pathname).toBe("/api/v1/notification-preferences");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer token");
    expect(prefs.promoPushEnabled).toBe(false);
  });

  it("setNotificationPreferences: authed PUT with all four fields on the wire", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({
          data: {
            notifications_enabled: true,
            push_enabled: true,
            email_enabled: false,
            promo_push_enabled: false,
            updated_at: "2026-09-17T10:05:00Z",
          } satisfies ApiNotificationPreferences,
        });
      }),
    );

    const repository = new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    const prefs = await repository.setNotificationPreferences({
      notificationsEnabled: true,
      pushEnabled: true,
      emailEnabled: false,
      promoPushEnabled: false,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.init.method).toBe("PUT");
    expect(new URL(calls[0]!.url).pathname).toBe("/api/v1/notification-preferences");
    const body = JSON.parse(calls[0]!.init.body as string);
    // The FULL body, every time — never a partial PATCH (criterion 34).
    expect(body).toEqual({
      notifications_enabled: true,
      push_enabled: true,
      email_enabled: false,
      promo_push_enabled: false,
    });
    expect(prefs.promoPushEnabled).toBe(false);
  });
});
