import type { AvailabilitySlot } from "@bookeat/api";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { BookingDraftProvider, useBookingDraft, type BookingPrefill } from "../booking-draft";

/**
 * REGRESSION GUARD — a time prefilled from the home screen must not survive
 * the slot turning out to be taken.
 *
 * The Explore card links into the flow with `?date=…&startsAt=…&guests=…`.
 * That start time is an INTENT, not a selection: the slot object only exists
 * once availability has answered, and the answer can be a cached one from a
 * minute ago. Two ways this goes wrong, both pinned here:
 *
 *   1. the slot was already gone when the flow opened — the form must not
 *      silently keep the time and fail with a 409 at submit;
 *   2. the first (cached) answer had it free and the refetch says otherwise —
 *      the pre-selected time must be TAKEN BACK, because the guest never
 *      picked it by hand and has no reason to suspect it is stale.
 */

function slot(startsAt: string, available: boolean): AvailabilitySlot {
  return {
    startsAt,
    endsAt: startsAt.replace("T19:", "T21:"),
    available,
    freeTables: available ? 3 : 0,
    reason: available ? null : "occupied",
  };
}

/** A date the sanitizer will accept (today .. +60 days). */
function futureDateKey(daysAhead = 3): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function futureStartsAt(daysAhead = 3): string {
  return `${futureDateKey(daysAhead)}T19:00:00+05:00`;
}

function draft(prefill?: BookingPrefill) {
  return renderHook(() => useBookingDraft(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <BookingDraftProvider restaurantId="r-1" prefill={prefill}>
        {children}
      </BookingDraftProvider>
    ),
  });
}

describe("time prefill from the home screen", () => {
  it("is applied when the slot really is free", () => {
    const startsAt = futureStartsAt();
    const { result } = draft({ date: futureDateKey(), guests: "4", startsAt });
    expect(result.current.prefillOutcome).toBe("pending");
    expect(result.current.slot).toBeNull();

    act(() => result.current.resolvePrefill([slot(startsAt, true)]));

    expect(result.current.prefillOutcome).toBe("applied");
    expect(result.current.slot?.startsAt).toBe(startsAt);
    expect(result.current.guests).toBe(4);
  });

  it("does NOT survive the slot being taken", () => {
    const startsAt = futureStartsAt();
    const { result } = draft({ date: futureDateKey(), guests: "4", startsAt });

    act(() => result.current.resolvePrefill([slot(startsAt, false)]));

    expect(result.current.prefillOutcome).toBe("taken");
    // The whole point: no time is left sitting in the form.
    expect(result.current.slot).toBeNull();
    // The date and party size DO survive — they were not the thing that went.
    expect(result.current.date).toBe(futureDateKey());
    expect(result.current.guests).toBe(4);
  });

  it("does not survive the slot vanishing from the day entirely", () => {
    const { result } = draft({ startsAt: futureStartsAt() });
    act(() => result.current.resolvePrefill([slot(futureStartsAt(4), true)]));
    expect(result.current.prefillOutcome).toBe("taken");
    expect(result.current.slot).toBeNull();
  });

  it("is TAKEN BACK when a refetch contradicts the cached answer", () => {
    const startsAt = futureStartsAt();
    const { result } = draft({ startsAt });

    // First answer — from the cache the Explore screen filled a minute ago.
    act(() => result.current.resolvePrefill([slot(startsAt, true)]));
    expect(result.current.slot?.startsAt).toBe(startsAt);

    // The refetch says it is gone.
    act(() => result.current.resolvePrefill([slot(startsAt, false)]));
    expect(result.current.prefillOutcome).toBe("taken");
    expect(result.current.slot).toBeNull();
  });

  it("does NOT take back a time the guest chose by hand", () => {
    const startsAt = futureStartsAt();
    const { result } = draft();
    act(() => result.current.setSlot(slot(startsAt, true)));
    expect(result.current.prefillOutcome).toBe("none");

    // Availability now disagrees. A hand-picked time is the guest's own
    // decision — the flow must not silently clear it under them; the 409
    // branch on submit is where that conversation happens.
    act(() => result.current.resolvePrefill([slot(startsAt, false)]));
    expect(result.current.slot?.startsAt).toBe(startsAt);
  });

  it("a start time in the past is refused before availability is even asked", () => {
    const { result } = draft({ startsAt: "2020-01-01T19:00:00+05:00" });
    expect(result.current.prefillOutcome).toBe("none");
    expect(result.current.slot).toBeNull();
  });

  it.each([
    ["a date beyond the booking horizon", { date: futureDateKey(400) }],
    ["a malformed date", { date: "28.07.2026" }],
    ["a party size above the cap", { guests: "999" }],
    ["a party size of zero", { guests: "0" }],
    ["a non-numeric party size", { guests: "две" }],
  ])("ignores %s from the URL", (_label, prefill) => {
    const { result } = draft(prefill as BookingPrefill);
    expect(result.current.guests).toBeGreaterThanOrEqual(1);
    expect(result.current.guests).toBeLessThanOrEqual(20);
    expect(result.current.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("the Idempotency-Key follows the request body", () => {
  it("changing the party size rotates it — that is a different booking", () => {
    const { result } = draft();
    const before = result.current.idempotencyKey;
    act(() => result.current.setGuests(6));
    expect(result.current.idempotencyKey).not.toBe(before);
  });

  it("changing the phone number rotates it too", () => {
    // The bug behind this: a guest who fixed a typo in their phone after a
    // timed-out submit reused the key with a DIFFERENT body, got the 409 that
    // means "reused", and the screen read it as "your time was taken".
    const { result } = draft();
    const before = result.current.idempotencyKey;
    act(() => result.current.setPhone("+77010000001"));
    expect(result.current.idempotencyKey).not.toBe(before);
  });

  it("a resubmit with an unchanged body keeps the SAME key", () => {
    // This is what makes a retry after a timeout safe: the backend replays the
    // original booking instead of creating a second table.
    const { result } = draft();
    act(() => result.current.setPhone("+77010000001"));
    const key = result.current.idempotencyKey;
    act(() => result.current.setPhone("+77010000001"));
    expect(result.current.idempotencyKey).toBe(key);
  });

  it("clamps the party size instead of sending an impossible one", () => {
    const { result } = draft();
    act(() => result.current.setGuests(999));
    expect(result.current.guests).toBe(20);
    act(() => result.current.setGuests(-4));
    expect(result.current.guests).toBe(1);
  });
});
