import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { AdminApiClient } from "../admin";

/**
 * The dashboard client is thin on purpose, so what these tests guard is the
 * part that actually breaks in production: the request shape (path, query,
 * omitted params) and the two envelopes the backend uses.
 */

function clientWith(payload: unknown, capture: { url?: string } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    capture.url = String(input);
    return new Response(JSON.stringify({ data: payload }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return new AdminApiClient({ baseUrl: "https://api.test/api/v1", getToken: async () => "t" });
}

describe("platform dashboard client", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("reads the overview counters straight out of the envelope", async () => {
    const capture: { url?: string } = {};
    const api = clientWith(
      {
        total_restaurants: 30,
        active_restaurants: 28,
        total_users: 372,
        total_bookings: 624,
        bookings_last_7_days: 3,
        bookings_last_30_days: 42,
      },
      capture,
    );

    const got = await api.platformOverview();

    expect(capture.url).toBe("https://api.test/api/v1/admin/dashboard/overview");
    expect(got.total_restaurants).toBe(30);
    expect(got.bookings_last_30_days).toBe(42);
  });

  it("omits an empty period instead of sending blank dates", async () => {
    const capture: { url?: string } = {};
    const api = clientWith({ from: "", to: "", total: 0, by_status: [] }, capture);

    await api.platformBookings({});

    // A blank ?from= is not the same as no ?from=: the backend applies its own
    // look-back window only when the parameter is absent.
    expect(capture.url).toBe("https://api.test/api/v1/admin/dashboard/bookings");
  });

  it("passes the period through when it is given", async () => {
    const capture: { url?: string } = {};
    const api = clientWith({ from: "", to: "", total: 0, by_status: [] }, capture);

    await api.platformBookings({ from: "2026-07-01", to: "2026-07-29" });

    expect(capture.url).toContain("from=2026-07-01");
    expect(capture.url).toContain("to=2026-07-29");
  });

  it("reads the status breakdown as an array, not a map", async () => {
    // The backend builds by_status as []gin.H{{status, count}} (dashboard
    // handler). Typing it as a map made every card render "[object Object]"
    // titled with an array index, and typescript could not catch it because the
    // shape only exists at runtime.
    const api = clientWith({
      from: "",
      to: "",
      total: 3,
      by_status: [
        { status: "confirmed", count: 2 },
        { status: "cancelled", count: 1 },
      ],
    });

    const got = await api.platformBookings({});

    expect(Array.isArray(got.by_status)).toBe(true);
    expect(got.by_status[0].status).toBe("confirmed");
    expect(got.by_status[0].count).toBe(2);
    expect(got.total).toBe(3);
  });

  it("keeps money in integer minor units", async () => {
    const api = clientWith({
      from: "",
      to: "",
      currency: "KZT",
      captured: { amount_minor: 1234500, count: 7 },
      refunded: { amount_minor: 50000, count: 1 },
    });

    const got = await api.platformPayments({});

    expect(got.captured.amount_minor).toBe(1234500);
    expect(Number.isInteger(got.captured.amount_minor)).toBe(true);
  });

  it("unwraps the top-restaurants envelope and survives an empty one", async () => {
    const withRows = clientWith({
      restaurants: [{ restaurant_id: "r1", name: "Abay", bookings_count: 5, gmv_minor: 100000 }],
    });
    expect(await withRows.platformTopRestaurants({})).toHaveLength(1);

    vi.unstubAllGlobals();
    const empty = clientWith({});
    expect(await empty.platformTopRestaurants({})).toEqual([]);
  });

  it("defaults the leaderboard to bookings and asks for ten rows", async () => {
    const capture: { url?: string } = {};
    const api = clientWith({ restaurants: [] }, capture);

    await api.platformTopRestaurants({});

    expect(capture.url).toContain("by=bookings");
    expect(capture.url).toContain("limit=10");
  });
});
