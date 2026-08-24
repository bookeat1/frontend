import { describe, expect, it } from "vitest";
import { formatPriceRange } from "../format";

const NBSP = "\u00A0";
const ENDASH = "–";

describe("formatPriceRange", () => {
  it("formats a range ru-style: NBSP thousands, en-dash, trailing ₸", () => {
    expect(formatPriceRange({ min: 4000, max: 9000 })).toBe(
      `4${NBSP}000${ENDASH}9${NBSP}000${NBSP}₸`,
    );
  });

  it("groups five-digit bounds correctly", () => {
    expect(formatPriceRange({ min: 25000, max: 60000 })).toBe(
      `25${NBSP}000${ENDASH}60${NBSP}000${NBSP}₸`,
    );
  });

  it("uses a non-breaking space, never a plain one, so the number can't wrap", () => {
    const out = formatPriceRange({ min: 4000, max: 9000 });
    expect(out).not.toMatch(/ /); // no ASCII space anywhere
    expect(out).toContain(NBSP);
  });

  it("collapses a point (min === max) to a single number, not «X–X»", () => {
    expect(formatPriceRange({ min: 5000, max: 5000 })).toBe(`5${NBSP}000${NBSP}₸`);
  });

  it("normalises an inverted range instead of drawing the dash backwards", () => {
    expect(formatPriceRange({ min: 9000, max: 4000 })).toBe(
      `4${NBSP}000${ENDASH}9${NBSP}000${NBSP}₸`,
    );
  });

  /**
   * Тире против дефиса (правка владельца 2026-08-24). На глаз «–» и «-» в
   * исходнике неразличимы, поэтому проверяется КОДОВАЯ ТОЧКА: U+2013 есть,
   * дефис-минус U+002D отсутствует. Иначе правка молча откатывается первой же
   * копипастой.
   */
  it("joins the bounds with U+2013 and never with a hyphen-minus", () => {
    const out = formatPriceRange({ min: 8000, max: 15000 });
    expect(out).toBe(`8${NBSP}000${ENDASH}15${NBSP}000${NBSP}₸`);
    expect(out).toContain("\u2013");
    expect(out).not.toContain("\u002D");
  });
});
