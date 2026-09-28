import type { BookingPayment, BookingStatus, PaymentStatus } from "./types";

/** Payment statuses after which the preorder is editable again. */
const UNBLOCKING: PaymentStatus[] = ["failed", "expired", "voided", "refunded"];

/**
 * What the guest may do with the preorder of an existing booking, mirroring
 * usecase/preorder.Replace on the backend:
 *  - pending / waitlist: editable;
 *  - confirmed: locked for the guest (PREORDER_LOCKED), EXCEPT while the
 *    booking has no lines yet (then adding is accepted);
 *  - any other status: closed;
 *  - any non-terminal payment freezes the preorder (PREORDER_PAYMENT_IN_FLIGHT).
 *
 * `payment`: `null` = no live payment, `undefined` = not known (loading or
 * failed to load) -> hidden, because offering an edit the server refuses is
 * worse than waiting for the answer.
 */
export function guestPreorderEditAction(input: {
  status: BookingStatus;
  itemsCount: number;
  payment: BookingPayment | null | undefined;
}): "add" | "edit" | null {
  const { status, itemsCount, payment } = input;
  const editableStatus =
    status === "pending" || status === "waitlist" || (status === "confirmed" && itemsCount === 0);
  if (!editableStatus) return null;
  if (payment === undefined) return null;
  if (payment !== null && !UNBLOCKING.includes(payment.status)) return null;
  return itemsCount > 0 ? "edit" : "add";
}
