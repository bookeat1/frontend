import { describe, expect, it } from "vitest";

import { parsePriceRangeInput } from "../admin/price-input";

/**
 * The «Средний чек» range is both-or-neither: the backend validates the merged
 * row against migration 0068's CHECK, and a half-filled pair would come back a
 * generic 422. This helper catches it before the request and is the one piece
 * of that card worth a DOM-free test.
 */
describe("parsePriceRangeInput", () => {
  it("treats both blank as no range (both null)", () => {
    expect(parsePriceRangeInput("", "")).toEqual({ ok: true, min: null, max: null });
    // whitespace-only is still blank
    expect(parsePriceRangeInput("  ", "\t")).toEqual({ ok: true, min: null, max: null });
  });

  it("accepts a valid whole-tenge pair", () => {
    expect(parsePriceRangeInput("4000", "9000")).toEqual({ ok: true, min: 4000, max: 9000 });
  });

  it("allows min == max", () => {
    expect(parsePriceRangeInput("5000", "5000")).toEqual({ ok: true, min: 5000, max: 5000 });
  });

  it("allows a min of 0", () => {
    expect(parsePriceRangeInput("0", "1000")).toEqual({ ok: true, min: 0, max: 1000 });
  });

  it("rejects exactly one field filled as incomplete", () => {
    expect(parsePriceRangeInput("4000", "")).toEqual({ ok: false, error: "incomplete" });
    expect(parsePriceRangeInput("", "9000")).toEqual({ ok: false, error: "incomplete" });
  });

  it("rejects max below min as inverted", () => {
    expect(parsePriceRangeInput("9000", "4000")).toEqual({ ok: false, error: "inverted" });
  });

  it("rejects non-integer or negative input as invalid", () => {
    expect(parsePriceRangeInput("40.5", "9000")).toEqual({ ok: false, error: "invalid" });
    expect(parsePriceRangeInput("-1", "9000")).toEqual({ ok: false, error: "invalid" });
    expect(parsePriceRangeInput("abc", "9000")).toEqual({ ok: false, error: "invalid" });
    expect(parsePriceRangeInput("4000", "")).not.toEqual({ ok: false, error: "invalid" });
  });
});
