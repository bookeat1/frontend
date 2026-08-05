import type { Dictionary } from "./ru";
import type { LocaleOverride } from "./index";

/**
 * Қазақша — PARTIAL translation. Everything not listed here falls back to the
 * Russian base at runtime (see getDictionary). Full translation is a separate
 * task.
 */
export const kk: LocaleOverride<Dictionary> = {
  common: {
    back: "Артқа",
    retry: "Қайталау",
    close: "Жабу",
    cancel: "Бас тарту",
    seeAll: "Барлығын көру",
    loading: "Жүктелуде",
  },
  settings: {
    title: "Баптаулар",
    language: "Тіл",
  },
};
