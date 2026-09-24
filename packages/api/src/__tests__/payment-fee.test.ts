import { describe, expect, it } from "vitest";
import { computePaymentBreakdown } from "../payment-fee";

const cfg = { rateBps: 350, minFeeMinor: 2500 };

describe("computePaymentBreakdown (mirror of GrossUpForAcquirerWithMinimum)", () => {
  it("3500 ₸ at 3.5% / min 25 ₸ -> 3626.95 (362695 minor), rate binds", () => {
    expect(computePaymentBreakdown(350000, cfg)).toEqual({
      baseMinor: 350000,
      feeMinor: 12695,
      totalMinor: 362695,
    });
  });
  it("rounds the gross UP (ceil)", () => {
    // 100000*10000/9650 = 103626.94 -> 103627
    expect(computePaymentBreakdown(100000, { rateBps: 350, minFeeMinor: 0 })?.totalMinor).toBe(103627);
  });
  it("floor binds on a small base: 500 ₸ -> +25 ₸", () => {
    expect(computePaymentBreakdown(50000, cfg)).toEqual({ baseMinor: 50000, feeMinor: 2500, totalMinor: 52500 });
  });
  it("rate 0 with a floor still charges the floor (as the backend)", () => {
    expect(computePaymentBreakdown(10000, { rateBps: 0, minFeeMinor: 2500 })?.feeMinor).toBe(2500);
  });
  it.each([
    ["no config", 350000, undefined],
    ["rate >= 10000", 350000, { rateBps: 10000, minFeeMinor: 0 }],
    ["negative rate", 350000, { rateBps: -1, minFeeMinor: 0 }],
    ["rate 0 and no floor", 350000, { rateBps: 0, minFeeMinor: 0 }],
    ["negative floor", 350000, { rateBps: 350, minFeeMinor: -1 }],
    ["zero base", 0, cfg],
    ["missing base", null, cfg],
    ["fractional base", 100.5, cfg],
  ])("no fee: %s", (_n, base, config) => {
    expect(computePaymentBreakdown(base as number | null, config)).toBeNull();
  });
});
