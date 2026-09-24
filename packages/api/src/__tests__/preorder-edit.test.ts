import { describe, expect, it } from "vitest";
import { guestPreorderEditAction } from "../preorder-edit";
import type { BookingPayment, BookingStatus, PaymentStatus } from "../types";

const pay = (status: PaymentStatus) => ({ status, purpose: "preorder" }) as unknown as BookingPayment;
const run = (status: BookingStatus, itemsCount: number, payment: BookingPayment | null | undefined) =>
  guestPreorderEditAction({ status, itemsCount, payment });

describe("guestPreorderEditAction", () => {
  it("pending/waitlist without payment: add when empty, edit when filled", () => {
    expect(run("pending", 0, null)).toBe("add");
    expect(run("waitlist", 0, null)).toBe("add");
    expect(run("pending", 2, null)).toBe("edit");
  });
  it("confirmed: only add on an empty preorder, never edit", () => {
    expect(run("confirmed", 0, null)).toBe("add");
    expect(run("confirmed", 1, null)).toBeNull();
  });
  it("closed statuses hide it", () => {
    for (const s of ["arrived", "completed", "cancelled", "no_show"] as const) expect(run(s, 0, null)).toBeNull();
  });
  it("non-terminal payment freezes it", () => {
    for (const s of ["created", "authorized", "capturing", "captured", "voiding", "partially_refunded"] as const)
      expect(run("pending", 1, pay(s))).toBeNull();
  });
  it("failed/expired/voided/refunded payments unblock", () => {
    for (const s of ["failed", "expired", "voided", "refunded"] as const)
      expect(run("pending", 1, pay(s))).toBe("edit");
  });
  it("unknown payment state hides it", () => {
    expect(run("pending", 0, undefined)).toBeNull();
  });
});
