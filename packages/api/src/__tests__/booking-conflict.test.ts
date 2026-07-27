import { describe, expect, it, vi } from "vitest";
import { HttpRestaurantRepository } from "../http-repository";
import { RepositoryError } from "../repository";

/**
 * REGRESSION GUARD — POST /bookings answers 409 for OPPOSITE reasons.
 *
 * `slot_taken` / `no_table_available` → NO booking exists, the guest must pick
 * another time. `idempotency_key_reused` → a booking DOES exist and resending
 * would produce a second table. Older server builds send neither code, and the
 * English `error` text is byte-identical for all of them.
 *
 * The bug this pins (2026-07-25): the client told apart the two by looking for
 * the substring "already exists" in that text, which every branch contained —
 * so a guest who LOST the race was told their table was booked, and did not
 * turn up. The rule that came out of it: branch on `status` and `code`, never
 * on `serverMessage`, and an unlabelled conflict is `unknown`, not a guess.
 *
 * Asserted through the real HTTP client (stubbed `fetch`) rather than by
 * constructing a RepositoryError by hand, so the envelope parsing is covered
 * too — `code` has to survive the whole way from the wire to the predicate.
 */

const BASE_URL = "https://api.example.test/api/v1";

function repository() {
  return new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "token" });
}

/** One canned response for the single POST the repository makes. */
function respondWith(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

async function createBookingError(): Promise<RepositoryError> {
  try {
    await repository().createBooking(
      {
        restaurantId: "r-1",
        startsAt: "2026-07-28T19:00:00+05:00",
        guests: 2,
        name: "Дамир",
        phone: "+77010000000",
      },
      "idem-key-1",
    );
  } catch (error) {
    if (error instanceof RepositoryError) return error;
    throw error;
  }
  throw new Error("createBooking resolved, but the server answered 409");
}

describe("409 on booking creation", () => {
  it("slot_taken means NO booking exists", async () => {
    respondWith(409, { error: "already exists", code: "slot_taken" });
    const error = await createBookingError();
    expect(error.status).toBe(409);
    expect(error.bookingConflict).toBe("slot_taken");
  });

  it("no_table_available means NO booking exists", async () => {
    respondWith(409, { error: "already exists", code: "no_table_available" });
    expect((await createBookingError()).bookingConflict).toBe("no_table_available");
  });

  it("idempotency_key_reused is the ONLY branch that means a booking exists", async () => {
    respondWith(409, { error: "already exists", code: "idempotency_key_reused" });
    expect((await createBookingError()).bookingConflict).toBe("idempotency_key_reused");
  });

  it("an older server that sends no code at all is UNKNOWN", async () => {
    // The exact body the backend returned before 2026-07-25.
    respondWith(409, { error: "already exists" });
    const error = await createBookingError();
    expect(error.bookingConflict).toBe("unknown");
    // The failing behaviour, spelled out: the client must not conclude a
    // booking exists, and must not conclude the slot is gone either.
    expect(error.bookingConflict).not.toBe("idempotency_key_reused");
    expect(error.bookingConflict).not.toBe("slot_taken");
  });

  it("the generic sentinel code is as uninformative as no code", async () => {
    respondWith(409, { error: "already exists", code: "already_exists" });
    expect((await createBookingError()).bookingConflict).toBe("unknown");
  });

  it("a code nobody has taught the client yet is UNKNOWN, not a default", async () => {
    respondWith(409, { error: "already exists", code: "some_future_code" });
    expect((await createBookingError()).bookingConflict).toBe("unknown");
  });

  it("the English server text is carried for logs but is NOT the signal", async () => {
    // Same text, opposite meanings — proof that the text cannot be the input.
    respondWith(409, { error: "already exists", code: "slot_taken" });
    const taken = await createBookingError();
    respondWith(409, { error: "already exists", code: "idempotency_key_reused" });
    const reused = await createBookingError();

    expect(taken.serverMessage).toBe(reused.serverMessage);
    expect(taken.bookingConflict).not.toBe(reused.bookingConflict);
  });

  it("a 409 body that is not JSON at all still does not claim a booking", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>502 from a proxy</html>", { status: 409 })),
    );
    const error = await createBookingError();
    expect(error.status).toBe(409);
    expect(error.code).toBeUndefined();
    expect(error.bookingConflict).toBe("unknown");
  });

  it("non-409 failures are not booking conflicts at all", async () => {
    for (const status of [400, 401, 422, 429, 500, 503]) {
      respondWith(status, { error: "nope", code: "idempotency_key_reused" });
      const error = await createBookingError();
      expect(error.bookingConflict, `status ${status}`).toBeNull();
    }
  });

  it("a transport failure is not a conflict either", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Network request failed");
      }),
    );
    const error = await createBookingError();
    expect(error.status).toBeUndefined();
    expect(error.bookingConflict).toBeNull();
  });

  it("sends the Idempotency-Key it was given, verbatim", async () => {
    // The key is what makes a retry safe; if it were regenerated per attempt
    // the "reused" branch could never happen and a retry would double-book.
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "already exists", code: "slot_taken" }), {
          status: 409,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await createBookingError();

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("idem-key-1");
  });
});
