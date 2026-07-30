import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { AdminApiClient, classifyBookingActionFailure } from "../admin";
import { RepositoryError } from "../repository";

/**
 * GET /restaurants/:id/dashboard/today and the refusals of the venue's answer
 * to a request. Both are contracts with the Go backend
 * (transport/rest/venuedashboard/handler.go, usecase/bookings/status.go), so
 * they are pinned without a DOM.
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

describe("venue today client", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("asks the venue-scoped path and sends no period", async () => {
    const capture: { url?: string } = {};
    const api = clientWith(
      { awaiting: [], awaiting_total: 0, today: [], today_total: 0, guests: 0 },
      capture,
    );

    await api.venueDashboardToday("rest-1");

    // "Today" is the VENUE's local day, resolved server-side — a client that
    // sent its own date would hand the browser's timezone to the answer.
    expect(capture.url).toBe("https://api.test/api/v1/restaurants/rest-1/dashboard/today");
  });

  it("reads the rows as the backend shapes them", async () => {
    const api = clientWith({
      awaiting: [
        {
          id: "b-1",
          starts_at: "2026-08-01T19:00:00+05:00",
          name: "Айгерим",
          phone: "+7 701 000 00 00",
          guests: 2,
          status: "pending",
          created_at: "2026-07-28T18:00:00+05:00",
          waiting_minutes: 7,
        },
      ],
      awaiting_total: 17,
      today: [],
      today_total: 0,
      // Heads for the WHOLE day, not for the rows above: a truncated list must
      // not shrink the headcount with it.
      guests: 42,
    });

    const got = await api.venueDashboardToday("rest-1");

    expect(got.awaiting).toHaveLength(1);
    expect(got.awaiting[0].waiting_minutes).toBe(7);
    expect(got.awaiting[0].phone).toBe("+7 701 000 00 00");
    expect(got.awaiting_total).toBe(17);
    expect(got.guests).toBe(42);
  });

  it("defaults the lists so a stripped body cannot crash the landing page", async () => {
    const api = clientWith({ awaiting_total: 3 });

    const got = await api.venueDashboardToday("rest-1");

    expect(got.awaiting).toEqual([]);
    expect(got.today).toEqual([]);
    expect(got.today_total).toBe(0);
  });
});

describe("classifyBookingActionFailure", () => {
  const failure = (status?: number, code?: string) =>
    classifyBookingActionFailure(new RepositoryError("x", undefined, status, "server text", code));

  it("separates «somebody already answered» from a plain refusal — both are 422", () => {
    expect(failure(422, "invalid_status").kind).toBe("already_answered");
    expect(failure(422, "validation_failed").kind).toBe("refused");
  });

  it("treats an already-answered request as a stale list, not as an error to retry", () => {
    const outcome = failure(422, "invalid_status");
    expect(outcome.applied).toBe(false);
    expect(outcome.staleList).toBe(true);
  });

  it("never claims «nothing changed» when the server did not say so", () => {
    // No status at all: offline, timeout, malformed body — the call may well
    // have committed on the server.
    expect(classifyBookingActionFailure(new RepositoryError("network")).applied).toBe("unknown");
    expect(failure(500).applied).toBe("unknown");
    expect(failure(503).kind).toBe("unknown");
  });

  it("maps the authorisation answers", () => {
    expect(failure(401).kind).toBe("unauthorized");
    expect(failure(403).kind).toBe("forbidden");
    expect(failure(404).kind).toBe("not_found");
  });

  it("survives a non-error thrown value", () => {
    expect(classifyBookingActionFailure("boom").kind).toBe("unknown");
  });
});
