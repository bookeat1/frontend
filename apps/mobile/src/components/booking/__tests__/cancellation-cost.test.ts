import type { Booking, BookingPayment } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { describe, expect, it } from "vitest";
import { describeCancellationCost } from "../cancellation-cost";

/**
 * REGRESSION GUARD — the money sentence in «Отменить бронь?».
 *
 * The guest decides whether to cancel based on exactly one sentence, and the
 * expensive failure is one-directional: telling somebody the cancellation is
 * free and then keeping their deposit. So this file pins three things the
 * screen must never get wrong:
 *
 *   1. the deadline boundary is STRICT — free strictly BEFORE it, forfeited
 *      AT it and after (server side: `!cancelledAt.Before(deadline)` in
 *      usecase/payments/cancel.go);
 *   2. an unknown payment is reported as unknown, never as free;
 *   3. money that is not at risk (no payment / already voided or refunded) is
 *      free, and the wording says so.
 */

const t = getDictionary();

const DEADLINE = "2026-07-28T15:00:00.000Z";

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b-1",
    restaurantId: "r-1",
    name: "Дамир",
    phone: "+77010000000",
    guests: 2,
    startsAt: "2026-07-28T19:00:00.000Z",
    endsAt: "2026-07-28T21:00:00.000Z",
    status: "confirmed",
    notes: null,
    freeCancelDeadline: DEADLINE,
    createdAt: null,
    ...overrides,
  };
}

function payment(overrides: Partial<BookingPayment> = {}): BookingPayment {
  return {
    id: "p-1",
    bookingId: "b-1",
    purpose: "deposit",
    status: "authorized",
    amountMinor: 500_000,
    currency: "KZT",
    paymentUrl: null,
    expiresAt: null,
    ...overrides,
  };
}

describe("describeCancellationCost — the deadline boundary", () => {
  it("one millisecond BEFORE the deadline the cancellation is still free", () => {
    const now = new Date(Date.parse(DEADLINE) - 1);
    const { cost } = describeCancellationCost({ booking: booking(), payment: payment(), now });
    expect(cost).toEqual({ kind: "free-until", deadline: DEADLINE });
  });

  it("EXACTLY at the deadline the deposit is already forfeited", () => {
    // The one case a `<=` instead of a `<` gets wrong, and the one the server
    // resolves against the guest.
    const now = new Date(Date.parse(DEADLINE));
    const { cost, text } = describeCancellationCost({
      booking: booking(),
      payment: payment(),
      now,
    });
    expect(cost).toEqual({ kind: "forfeit" });
    expect(text).toBe(t.booking.cancelDepositLost("5\u00A0000\u00A0₸"));
  });

  it("one millisecond AFTER the deadline the deposit is forfeited", () => {
    const now = new Date(Date.parse(DEADLINE) + 1);
    const { cost } = describeCancellationCost({ booking: booking(), payment: payment(), now });
    expect(cost).toEqual({ kind: "forfeit" });
  });

  it("names the deposit and the deadline while it is still free", () => {
    const now = new Date(Date.parse(DEADLINE) - 3 * 60 * 60 * 1000);
    const { text } = describeCancellationCost({ booking: booking(), payment: payment(), now });
    expect(text).toContain("5\u00A0000\u00A0₸");
    // The deadline itself must be in the sentence: "free until" without a
    // "until when" is not actionable.
    expect(text).toMatch(/\d{2}:\d{2}/);
  });
});

describe("describeCancellationCost — what we do not know", () => {
  it("an unreadable payment is UNKNOWN, never free", () => {
    // `undefined` = the GET /bookings/:id/payment request failed. This is the
    // case that must not be optimistically collapsed into "free".
    const { cost, text } = describeCancellationCost({
      booking: booking(),
      payment: undefined,
      now: new Date("2026-07-28T10:00:00.000Z"),
    });
    expect(cost).toEqual({ kind: "unknown" });
    expect(text).toBe(t.booking.cancelMoneyUnknown);
    expect(text).not.toBe(t.booking.cancelFreeNoMoney);
  });

  it("stays UNKNOWN even after the deadline has passed", () => {
    // Not knowing does not become knowing just because time moved on.
    const { cost } = describeCancellationCost({
      booking: booking(),
      payment: undefined,
      now: new Date(Date.parse(DEADLINE) + 60_000),
    });
    expect(cost).toEqual({ kind: "unknown" });
  });

  it("money on the line with NO deadline warns instead of reassuring", () => {
    const { cost } = describeCancellationCost({
      booking: booking({ freeCancelDeadline: null }),
      payment: payment(),
      now: new Date("2026-07-28T10:00:00.000Z"),
    });
    expect(cost).toEqual({ kind: "forfeit" });
  });

  it("an unparseable deadline is treated as no deadline, not as 'plenty of time'", () => {
    const { cost } = describeCancellationCost({
      booking: booking({ freeCancelDeadline: "не дата" }),
      payment: payment(),
      now: new Date("2026-07-28T10:00:00.000Z"),
    });
    expect(cost).toEqual({ kind: "forfeit" });
  });
});

describe("describeCancellationCost — when nothing is at stake", () => {
  it("no payment at all is free, whatever the clock says", () => {
    for (const now of [new Date(Date.parse(DEADLINE) - 1), new Date(Date.parse(DEADLINE) + 1)]) {
      const { cost, text } = describeCancellationCost({ booking: booking(), payment: null, now });
      expect(cost).toEqual({ kind: "free" });
      expect(text).toBe(t.booking.cancelFreeNoMoney);
    }
  });

  it.each(["created", "voiding", "voided", "refunded", "failed", "expired"] as const)(
    "payment status %s puts no money at risk — free",
    (status) => {
      const { cost } = describeCancellationCost({
        booking: booking(),
        payment: payment({ status }),
        now: new Date(Date.parse(DEADLINE) + 60_000),
      });
      expect(cost).toEqual({ kind: "free" });
    },
  );

  it.each(["authorized", "capturing", "captured", "partially_refunded"] as const)(
    "payment status %s IS money at risk — forfeited past the deadline",
    (status) => {
      const { cost } = describeCancellationCost({
        booking: booking(),
        payment: payment({ status }),
        now: new Date(Date.parse(DEADLINE) + 60_000),
      });
      expect(cost).toEqual({ kind: "forfeit" });
    },
  );
});
