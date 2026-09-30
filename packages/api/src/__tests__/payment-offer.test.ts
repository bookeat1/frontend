import { describe, expect, it } from "vitest";

import { venueOffersPreorderPayment } from "../payment-offer";
import { RepositoryError } from "../repository";

describe("venueOffersPreorderPayment", () => {
  it("предлагает оплату: принимает и требует", () => {
    expect(venueOffersPreorderPayment({ acceptsOnlinePayment: true, preorderPaymentRequired: true })).toBe(true);
  });
  it("не предлагает: сервер сказал явное false", () => {
    expect(venueOffersPreorderPayment({ acceptsOnlinePayment: true, preorderPaymentRequired: false })).toBe(false);
  });
  it("старый бэкенд (нет поля / null) — поведение прежнее", () => {
    expect(venueOffersPreorderPayment({ acceptsOnlinePayment: true })).toBe(true);
    expect(venueOffersPreorderPayment({ acceptsOnlinePayment: true, preorderPaymentRequired: null })).toBe(true);
  });
  it("не принимает онлайн-оплату — не предлагает, что бы ни было в поле", () => {
    expect(venueOffersPreorderPayment({ acceptsOnlinePayment: false, preorderPaymentRequired: true })).toBe(false);
    expect(venueOffersPreorderPayment(undefined)).toBe(false);
  });
});

describe("RepositoryError.isPaymentNotRequired", () => {
  it("код payment_not_required — главный признак", () => {
    expect(new RepositoryError("x", undefined, 422, "validation failed", "payment_not_required").isPaymentNotRequired).toBe(true);
    expect(new RepositoryError("x", undefined, 422, "validation failed", "other_code").isPaymentNotRequired).toBe(false);
  });
  it("текст «requires no payment» — только запасной вариант для старого бэкенда, только при 422", () => {
    expect(new RepositoryError("x", undefined, 422, "validation: this booking requires no payment").isPaymentNotRequired).toBe(true);
    expect(new RepositoryError("x", undefined, 422, "payments are not enabled").isPaymentNotRequired).toBe(false);
    expect(new RepositoryError("x", undefined, 500, "requires no payment").isPaymentNotRequired).toBe(false);
  });
});
