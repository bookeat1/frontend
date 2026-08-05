import type { Dictionary } from "./ru";
import type { LocaleOverride } from "./index";

/**
 * English — a PARTIAL translation. Only the handful of strings below are
 * translated; every other key falls back to the Russian base at runtime (see
 * getDictionary). Full translation is a separate task.
 */
export const en: LocaleOverride<Dictionary> = {
  common: {
    back: "Back",
    retry: "Retry",
    close: "Close",
    cancel: "Cancel",
    seeAll: "See all",
    loading: "Loading",
  },
  settings: {
    title: "Settings",
    language: "Language",
    languageTitle: "Interface language",
  },
};
