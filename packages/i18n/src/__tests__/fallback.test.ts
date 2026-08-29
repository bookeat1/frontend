import { afterEach, describe, expect, it } from "vitest";
import {
  getCurrentLocale,
  getDictionary,
  isRTL,
  LOCALES,
  ru,
  setCurrentLocale,
} from "../index";

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
    // en and kk are complete (see completeness.test.ts), so the fallback
    // contract is pinned on a deliberately PARTIAL locale instead. ko
    // translates common.back and settings.*, nothing else.
    const ko = getDictionary("ko");
    expect(ko.common.back).toBe("뒤로");
    expect(ko.explore.recommendedTitle).toBe(ru.explore.recommendedTitle);
    // A subtree the locale never mentions is the base's own object, not a copy.
    expect(ko.admin.schedule.days).toBe(ru.admin.schedule.days);
    expect(ko.booking.whatsNextSteps).toBe(ru.booking.whatsNextSteps);
  });

  it("lets a locale translate the array-typed leaves too", () => {
    // Regression: `LocaleOverride` used to hand arrays through unwidened, so
    // ru's `as const` tuple of literals made these two keys impossible to
    // translate — every locale silently showed Russian weekday names.
    expect(getDictionary("en").admin.schedule.days[1]).toBe("Monday");
    expect(getDictionary("kk").admin.schedule.days[1]).toBe("Дүйсенбі");
    expect(getDictionary("en").booking.whatsNextSteps).not.toBe(ru.booking.whatsNextSteps);
  });

  it("keeps function-valued entries callable (they are not deep-merged away)", () => {
    const en = getDictionary("en");
    // resultsCount is a pluralising function. en translates it, so it no longer
    // equals the ru wording — what matters here is that the merge kept it a
    // callable that returns a string rather than clobbering it.
    expect(typeof en.search.resultsCount).toBe("function");
    expect(typeof en.search.resultsCount(3)).toBe("string");
    // kk translates the same function too — still callable, still a string.
    expect(typeof getDictionary("kk").search.resultsCount(3)).toBe("string");
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

describe("current-locale — module-level default for getDictionary()", () => {
  // The module cell is process-wide; every test here restores the "ru" default
  // so neither these tests nor the fallback suite above can leak into one
  // another regardless of run order.
  afterEach(() => setCurrentLocale("ru"));

  it("defaults to ru until something sets it", () => {
    expect(getCurrentLocale()).toBe("ru");
    expect(getDictionary()).toBe(ru);
  });

  it("getDictionary() with no argument follows setCurrentLocale()", () => {
    setCurrentLocale("en");
    expect(getCurrentLocale()).toBe("en");
    expect(getDictionary()).toBe(getDictionary("en"));
    expect(getDictionary().common.back).toBe("Back");
  });

  it("an explicit argument always overrides the current locale", () => {
    setCurrentLocale("en");
    // Explicit "ru" wins over the "en" default.
    expect(getDictionary("ru")).toBe(ru);
    // Explicit non-ru wins too.
    expect(getDictionary("kk")).toBe(getDictionary("kk"));
  });

  it("falls back to ru after setCurrentLocale('ru')", () => {
    setCurrentLocale("en");
    setCurrentLocale("ru");
    expect(getDictionary()).toBe(ru);
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
