import type { Booking, BookingPayment } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { formatMoneyMinor, formatRelativeDateTime } from "../../lib/format";

const t = getDictionary();

/**
 * What cancelling actually costs the guest, in one sentence.
 *
 * This is the whole point of the confirmation dialog, so it is derived from
 * the backend's real rules rather than from a hopeful assumption. Two inputs,
 * both read from the API:
 *
 *  - `booking.freeCancelDeadline` — `free_cancel_deadline` on
 *    `GET /bookings/:id` (bookingDetailsResponse.FreeCancelDeadline). It is
 *    `starts_at − restaurants.free_cancel_window_minutes`, and it is exactly
 *    the boundary the money settlement uses: in
 *    usecase/payments/cancel.go the deposit is forfeited when
 *    `!cancelledAt.Before(deadline)` — i.e. BEFORE the deadline the hold is
 *    voided (guest gets the money back), ON or AFTER it the hold is captured
 *    (the venue keeps it).
 *  - the booking's live payment from `GET /bookings/:id/payment`, or `null`
 *    when there is none (the endpoint answers 404 — the common case today).
 *
 * `payment === undefined` means "we could not find out" (the request failed).
 * That is reported as unknown, never as free: telling a guest a cancellation
 * costs nothing and then taking their deposit is the worst outcome here.
 */
export type CancellationCost =
  | { kind: "free" }
  | { kind: "free-until"; deadline: string }
  | { kind: "forfeit" }
  | { kind: "unknown" };

/** Payment states in which the guest's money is actually at risk. `created`
 * never reached the acquirer; `voided`/`refunded`/`failed`/`expired` are
 * already resolved in the guest's favour. Mirrors domain.PaymentStatus. */
function moneyIsAtRisk(payment: BookingPayment): boolean {
  switch (payment.status) {
    case "authorized":
    case "capturing":
    case "captured":
    case "partially_refunded":
      return true;
    case "created":
    case "voiding":
    case "voided":
    case "refunded":
    case "failed":
    case "expired":
      return false;
  }
}

export function describeCancellationCost(input: {
  booking: Booking;
  /** `null` = checked, there is none. `undefined` = the check failed. */
  payment: BookingPayment | null | undefined;
  now?: Date;
}): { cost: CancellationCost; text: string } {
  const { booking, payment } = input;
  const now = input.now ?? new Date();

  if (payment === undefined) {
    return { cost: { kind: "unknown" }, text: t.booking.cancelMoneyUnknown };
  }
  if (payment === null || !moneyIsAtRisk(payment)) {
    return { cost: { kind: "free" }, text: t.booking.cancelFreeNoMoney };
  }

  const amount = formatMoneyMinor(payment.amountMinor);
  const deadlineIso = booking.freeCancelDeadline;
  const deadline = deadlineIso ? new Date(deadlineIso) : null;

  // No deadline with money on the line: the server is telling us free
  // cancellation does not apply to this booking. Warn rather than reassure.
  if (!deadline || Number.isNaN(deadline.getTime())) {
    return { cost: { kind: "forfeit" }, text: t.booking.cancelDepositLost(amount) };
  }

  // Strictly before, matching `!cancelledAt.Before(deadline)` server-side.
  if (now.getTime() < deadline.getTime()) {
    return {
      cost: { kind: "free-until", deadline: deadlineIso! },
      text: t.booking.cancelDepositLostSoon(amount, formatRelativeDateTime(deadlineIso!, now)),
    };
  }
  return { cost: { kind: "forfeit" }, text: t.booking.cancelDepositLost(amount) };
}
