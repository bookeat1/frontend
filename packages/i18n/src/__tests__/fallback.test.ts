import { describe, expect, it } from "vitest";
import { getDictionary, isRTL, LOCALES, ru } from "../index";

/**
 * The point of the seven-locale plumbing is that a PARTIAL translation still
 * yields a COMPLETE dictionary: a translated key wins, everything else falls
 * back to the Russian base. These tests pin that contract down — a translator
 * shipping half a locale must never blank out the other half.
 */
describe("getDictionary — deep-merge fallback over ru", () => {
  it("returns the untouched base object for ru (no merge cost)", () => {
    expect(getDictionary("ru")).toBe(ru);
    expect(getDictionary()).toBe(ru);
  });

  it("uses the locale's own value where it has one", () => {
    // en translates common.back.
    expect(getDictionary("en").common.back).toBe("Back");
    expect(getDictionary("en").settings.title).toBe("Settings");
  });

  it("falls back to ru for any key the locale has not translated", () => {
    const en = getDictionary("en");
    // Not in en.ts → Russian base.
    expect(en.profile.title).toBe(ru.profile.title);
    expect(en.deleteAccount.heading).toBe(ru.deleteAccount.heading);
    // A sibling key inside a partially-translated section is still Russian.
    expect(en.settings.deleteAccount).toBe(ru.settings.deleteAccount);
  });

  it("keeps function-valued entries callable (they are not deep-merged away)", () => {
    const en = getDictionary("en");
    // resultsCount is a pluralising function only defined on the base.
    expect(typeof en.search.resultsCount).toBe("function");
    expect(en.search.resultsCount(3)).toBe(ru.search.resultsCount(3));
  });

  it("every non-ru locale merges to a full dictionary with the base's key set", () => {
    for (const { code } of LOCALES) {
      const dict = getDictionary(code);
      expect(Object.keys(dict).sort()).toEqual(Object.keys(ru).sort());
    }
  });

  it("caches the merged dictionary (same reference on repeat calls)", () => {
    expect(getDictionary("kk")).toBe(getDictionary("kk"));
  });
});

describe("isRTL", () => {
  it("is true only for Arabic among the shipped locales", () => {
    expect(isRTL("ar")).toBe(true);
    for (const { code } of LOCALES.filter((l) => l.code !== "ar")) {
      expect(isRTL(code)).toBe(false);
    }
  });
});
