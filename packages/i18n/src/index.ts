import { ru, type Dictionary } from "./ru";

export type Locale = "ru";

const dictionaries: Record<Locale, Dictionary> = { ru };

/**
 * Single entry point for translated strings. Currently only "ru" is
 * implemented; adding "kk" / "en" means adding a sibling dictionary file
 * with the same shape and registering it here.
 */
export function getDictionary(locale: Locale = "ru"): Dictionary {
  return dictionaries[locale];
}

export { ru };
export type { Dictionary };
