import type { Dictionary } from "./ru";
import type { LocaleOverride } from "./index";

/**
 * العربية — PARTIAL translation, right-to-left. Everything not listed here
 * falls back to the Russian base at runtime (see getDictionary); the layout
 * flip is handled separately by the app's LocaleProvider (isRTL). Full
 * translation is a separate task.
 */
export const ar: LocaleOverride<Dictionary> = {
  common: {
    back: "رجوع",
    retry: "إعادة المحاولة",
    close: "إغلاق",
    cancel: "إلغاء",
  },
  settings: {
    title: "الإعدادات",
    language: "اللغة",
  },
};
