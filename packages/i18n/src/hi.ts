import type { Dictionary } from "./ru";
import type { LocaleOverride } from "./index";

/**
 * हिन्दी — PARTIAL translation. Everything not listed here falls back to the
 * Russian base at runtime (see getDictionary). Full translation is a separate
 * task.
 */
export const hi: LocaleOverride<Dictionary> = {
  common: {
    back: "वापस",
    retry: "पुनः प्रयास",
    close: "बंद करें",
    cancel: "रद्द करें",
  },
  settings: {
    title: "सेटिंग्स",
    language: "भाषा",
  },
};
