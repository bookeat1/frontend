import { RepositoryError } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { describe, expect, it } from "vitest";
import { preorderSaveErrorMessage } from "../preorder-save-error";

const t = getDictionary();
const err = (code?: string) => new RepositoryError("x", undefined, 409, "x", code);

describe("preorderSaveErrorMessage", () => {
  it("maps preorder_locked", () => {
    expect(preorderSaveErrorMessage(err("preorder_locked"))).toBe(t.booking.preorderEditLocked);
  });
  it("maps preorder_payment_in_flight", () => {
    expect(preorderSaveErrorMessage(err("preorder_payment_in_flight"))).toBe(t.booking.preorderEditInFlight);
  });
  it("falls back to the generic message", () => {
    expect(preorderSaveErrorMessage(err("other"))).toBe(t.booking.preorderSaveFailed);
    expect(preorderSaveErrorMessage(new Error("boom"))).toBe(t.booking.preorderSaveFailed);
  });
});
