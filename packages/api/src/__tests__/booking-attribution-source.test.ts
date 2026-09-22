import { describe, expect, it, vi } from "vitest";
import { HttpRestaurantRepository } from "../http-repository";

/**
 * REGRESSION GUARD — `POST /bookings`' `attribution_source` field.
 *
 * This is the wire that carries the Detour/QR channel tag (`campaignAttribution.source`
 * — see `apps/mobile`'s `campaign-attribution.ts`) from the confirm screen to the
 * backend, alongside `promotion_id`. Nothing else asserts the request BODY of
 * `createBooking`, so a silent drop of this field (e.g. someone "cleaning up" the
 * call in `http-repository.ts`) would ship without a single test failing — that
 * gap is exactly what this file closes.
 */

const BASE_URL = "https://api.example.test/api/v1";

const CREATED_BOOKING = {
  id: "b-1",
  restaurant_id: "r-1",
  status: "pending_payment",
  starts_at: "2026-07-28T19:00:00+05:00",
  guests: 2,
  name: "Дамир",
  phone: "+77010000000",
};

function repository() {
  return new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "token" });
}

function respondWith201(booking: unknown) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ data: booking }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("POST /bookings — attribution_source", () => {
  it("sends attribution_source when the guest carries an active channel-tag attribution", async () => {
    const fetchMock = respondWith201(CREATED_BOOKING);

    await repository().createBooking(
      {
        restaurantId: "r-1",
        startsAt: "2026-07-28T19:00:00+05:00",
        guests: 2,
        name: "Дамир",
        phone: "+77010000000",
        attributionSource: "tshirt",
      },
      "idem-key-1",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.attribution_source).toBe("tshirt");
  });

  it("omits attribution_source when there is no attribution to attach", async () => {
    const fetchMock = respondWith201(CREATED_BOOKING);

    await repository().createBooking(
      {
        restaurantId: "r-1",
        startsAt: "2026-07-28T19:00:00+05:00",
        guests: 2,
        name: "Дамир",
        phone: "+77010000000",
      },
      "idem-key-2",
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.attribution_source).toBeUndefined();
  });
});
