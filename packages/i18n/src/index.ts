import { ru, type Dictionary } from "./ru";
import { kk } from "./kk";
import { en } from "./en";
import { ko } from "./ko";
import { hi } from "./hi";
import { ar } from "./ar";
import { zh } from "./zh";

/**
 * Every locale the app can display. `ru` is the base (the complete
 * Dictionary); the other six are translated incrementally and may be
 * incomplete — every missing key falls back to `ru`, see getDictionary.
 */
export type Locale = "ru" | "kk" | "en" | "ko" | "hi" | "ar" | "zh";

/**
 * A partial translation of the base Dictionary.
 *
 * Two things it does that a plain `Partial<Dictionary>` cannot:
 *   1. it is DEEP — a locale may translate `settings.title` without having to
 *      restate every other `settings.*` key;
 *   2. it WIDENS leaf strings. `Dictionary` is `typeof ru`, so its leaves are
 *      string LITERALS ("Назад"); a partial that had to supply the literal
 *      "Назад" for `common.back` could never carry a translation. Here every
 *      string leaf becomes plain `string`, so "Back" / "Артқа" typecheck.
 *
 * Function-valued entries (`resultsCount(n)`, `codeSentTo(phone)`, …) are kept
 * with their EXACT signature — a translator must match the arguments, which is
 * the whole point of keeping the pluralisation logic in the dictionary. Arrays
 * are replaced wholesale, never deep-merged.
 */
// eslint-disable-next-line @typescript-eslint/ban-types -- `Function` is the
// only reliable "is this a callable" guard here, and it must be tested BEFORE
// the object branch (functions are objects in TS). This package is not linted.
export type LocaleOverride<T> = T extends Function
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: LocaleOverride<T[K]> }
      : T extends string
        ? string
        : T;

/** Native display name of each locale, for the language picker. Kept next to
 * the code because a language's own name is not a translated string — it reads
 * the same in every locale. */
export interface LocaleOption {
  code: Locale;
  nativeName: string;
}

export const LOCALES: readonly LocaleOption[] = [
  { code: "ru", nativeName: "Русский" },
  { code: "kk", nativeName: "Қазақша" },
  { code: "en", nativeName: "English" },
  { code: "ko", nativeName: "한국어" },
  { code: "hi", nativeName: "हिन्दी" },
  { code: "ar", nativeName: "العربية" },
  { code: "zh", nativeName: "中文" },
];

/** Right-to-left scripts. Only Arabic among the shipped locales; the layout
 * flip is applied by the app's LocaleProvider via react-native's I18nManager. */
export function isRTL(locale: Locale): boolean {
  return locale === "ar";
}

const overrides: Record<Exclude<Locale, "ru">, LocaleOverride<Dictionary>> = {
  kk,
  en,
  ko,
  hi,
  ar,
  zh,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Overlays a partial locale on top of the full base, key by key. A key present
 * in `override` wins; a key absent from it keeps the base value. Only two plain
 * objects are merged recursively — a function, an array or a primitive in the
 * override REPLACES the base entry rather than being merged into it (a
 * half-merged pluralisation function would be a bug, not a translation).
 *
 * Runtime utility over `unknown`: the type-safety of a translation is enforced
 * at the DECLARATION site (each locale file is a `LocaleOverride<Dictionary>`),
 * not here. getDictionary casts the merged result back to Dictionary, which is
 * sound precisely because the override could only have carried valid keys.
 */
function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) {
    // A leaf (or a whole subtree) supplied by the locale.
    return override;
  }
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const overrideValue = override[key];
    if (overrideValue === undefined) continue;
    result[key] = deepMerge(base[key], overrideValue);
  }
  return result;
}

// Merging walks the whole ~1100-line tree, so each non-base locale is merged
// once and cached. `ru` is returned directly — the common case (`const t =
// getDictionary()` at module scope in every screen) never pays for a merge.
const cache = new Map<Locale, Dictionary>();

/**
 * The single entry point for translated strings. Always returns a COMPLETE
 * Dictionary: for a non-base locale it deep-merges that locale's partial over
 * `ru`, so any key the translators have not reached yet is answered in Russian
 * rather than showing a blank or a key name.
 */
export function getDictionary(locale: Locale = "ru"): Dictionary {
  if (locale === "ru") return ru;
  const cached = cache.get(locale);
  if (cached) return cached;
  const merged = deepMerge(ru, overrides[locale]) as Dictionary;
  cache.set(locale, merged);
  return merged;
}

export { ru };
export type { Dictionary };
