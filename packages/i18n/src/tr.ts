import type { Dictionary } from "./ru";
import type { LocaleOverride } from "./index";

/**
 * Türkçe — a PARTIAL translation. Only the handful of strings below are
 * translated; every other key falls back to the Russian base at runtime (see
 * getDictionary). Full translation is a separate task.
 */
export const tr: LocaleOverride<Dictionary> = {
  common: {
    back: "Geri",
    retry: "Tekrar dene",
    close: "Kapat",
    cancel: "İptal",
    seeAll: "Tümünü gör",
    loading: "Yükleniyor",
  },
  settings: {
    title: "Ayarlar",
    language: "Dil",
    languageTitle: "Arayüz dili",
  },
};
