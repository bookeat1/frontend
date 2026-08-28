import type { Booking, BookingPayment } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { CancelBookingDialog } from "../CancelBookingDialog";
import { describeCancellationCost } from "../cancellation-cost";

/**
 * The money sentence, as the guest actually sees it.
 *
 * This is the one test that renders a real React Native component tree
 * (Modal / View / Text / Pressable) rather than exercising a pure function —
 * it is the proof that the harness runs RN components, and it closes the last
 * gap in the cancellation guarantee: `describeCancellationCost` may be right
 * and the dialog could still fail to show its answer.
 */

const t = getDictionary();
const DEADLINE = "2026-07-28T15:00:00.000Z";

/**
 * Testing Library's default text matcher collapses whitespace, and the money
 * formatter deliberately uses non-breaking spaces ("5 000 ₸" must never wrap
 * mid-number). Matching on the element's own textContent keeps the assertion
 * about the sentence rather than about which space character is in it.
 */
const exactly = (expected: string) => (_: string, element: Element | null) =>
  element?.textContent === expected;

const booking: Booking = {
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
};

const heldDeposit: BookingPayment = {
  id: "p-1",
  bookingId: "b-1",
  purpose: "deposit",
  status: "authorized",
  amountMinor: 500_000,
  currency: "KZT",
};

function open(consequence: string, overrides: Partial<React.ComponentProps<typeof CancelBookingDialog>> = {}) {
  const onConfirm = vi.fn();
  const onDismiss = vi.fn();
  render(
    <CancelBookingDialog
      visible
      consequence={consequence}
      pending={false}
      error={null}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
      {...overrides}
    />,
  );
  return { onConfirm, onDismiss };
}

describe("CancelBookingDialog", () => {
  it("puts the forfeit warning in front of the guest, not behind a link", () => {
    const { text } = describeCancellationCost({
      booking,
      payment: heldDeposit,
      now: new Date(Date.parse(DEADLINE) + 1),
    });
    open(text);

    expect(screen.getByText(t.booking.cancelDialogTitle)).toBeTruthy();
    expect(screen.getByText(exactly(text))).toBeTruthy();
    expect(screen.getByText(exactly(text)).textContent).toContain("5\u00A0000\u00A0₸");
  });

  it("shows the 'we do not know' wording verbatim when the payment is unreadable", () => {
    const { text } = describeCancellationCost({ booking, payment: undefined });
    open(text);
    expect(screen.getByText(t.booking.cancelMoneyUnknown)).toBeTruthy();
    expect(screen.queryByText(t.booking.cancelFreeNoMoney)).toBeNull();
  });

  it("the safe choice is offered alongside the destructive one", () => {
    const { onConfirm, onDismiss } = open(t.booking.cancelFreeNoMoney);
    fireEvent.click(screen.getByText(t.booking.cancelKeep));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirming cancels", () => {
    const { onConfirm } = open(t.booking.cancelFreeNoMoney);
    fireEvent.click(screen.getByText(t.booking.cancelConfirm));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("while the request is in flight both buttons are inert — no double cancel", () => {
    const { onConfirm, onDismiss } = open(t.booking.cancelFreeNoMoney, { pending: true });
    expect(screen.getByText(t.booking.cancelling)).toBeTruthy();
    fireEvent.click(screen.getByText(t.booking.cancelling));
    fireEvent.click(screen.getByText(t.booking.cancelKeep));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("a failure is shown inside the dialog, where the guest acted", () => {
    open(t.booking.cancelFreeNoMoney, { error: "Не удалось отменить бронь" });
    expect(screen.getByText("Не удалось отменить бронь")).toBeTruthy();
  });

  it("renders nothing while closed", () => {
    render(
      <CancelBookingDialog
        visible={false}
        consequence={t.booking.cancelFreeNoMoney}
        pending={false}
        error={null}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.queryByText(t.booking.cancelDialogTitle)).toBeNull();
  });
});
