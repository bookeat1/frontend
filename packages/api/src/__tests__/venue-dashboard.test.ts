import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { AdminApiClient } from "../admin";

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

describe("venue dashboard client", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("asks the venue-scoped path, not the platform one", async () => {
    const capture: { url?: string } = {};
    const api = clientWith(
      { from: "", to: "", total: 0, by_status: [], cancelled_share: 0, avg_party_size: 0, cancel_reasons: [], preorder_bookings: 0, preorder_total_minor: 0 },
      capture,
    );

    await api.venueDashboardSummary("rest-1");

    expect(capture.url).toBe("https://api.test/api/v1/restaurants/rest-1/dashboard/summary");
  });

  it("reads the summary as the backend actually shapes it", async () => {
    // by_status and cancel_reasons are ARRAYS of objects, the same shape the
    // platform dashboard uses — a map here would render "[object Object]",
    // which is exactly the bug this repo already shipped once.
    const api = clientWith({
      from: "2026-06-29T00:00:00Z",
      to: "2026-07-29T00:00:00Z",
      total: 50,
      by_status: [
        { status: "cancelled", count: 41 },
        { status: "no_show", count: 7 },
      ],
      cancelled_share: 96,
      avg_party_size: 2.4,
      cancel_reasons: [{ reason: "", count: 30 }],
      preorder_bookings: 3,
      preorder_total_minor: 1234500,
    });

    const got = await api.venueDashboardSummary("rest-1");

    expect(Array.isArray(got.by_status)).toBe(true);
    expect(got.by_status[0].count).toBe(41);
    expect(got.cancel_reasons[0].reason).toBe("");
    expect(got.cancelled_share).toBe(96);
    expect(Number.isInteger(got.preorder_total_minor)).toBe(true);
  });

  it("passes the period through and omits it when empty", async () => {
    const capture: { url?: string } = {};
    const api = clientWith({ slots: [] }, capture);

    await api.venueDashboardLoad("rest-1");
    expect(capture.url).toBe("https://api.test/api/v1/restaurants/rest-1/dashboard/load");

    await api.venueDashboardLoad("rest-1", { from: "2026-07-01" });
    expect(capture.url).toContain("from=2026-07-01");
  });

  it("unwraps the load envelope and survives an empty one", async () => {
    const withSlots = clientWith({ slots: [{ weekday: 5, hour: 19, bookings: 2, guests: 5 }] });
    const got = await withSlots.venueDashboardLoad("rest-1");
    expect(got).toHaveLength(1);
    expect(got[0].hour).toBe(19);

    vi.unstubAllGlobals();
    const empty = clientWith({});
    expect(await empty.venueDashboardLoad("rest-1")).toEqual([]);
  });
});
