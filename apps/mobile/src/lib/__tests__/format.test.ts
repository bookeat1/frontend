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
});
