import type { Dictionary } from "./ru";
import type { LocaleOverride } from "./index";

/**
 * 한국어 — PARTIAL translation. Everything not listed here falls back to the
 * Russian base at runtime (see getDictionary). Full translation is a separate
 * task.
 */
export const ko: LocaleOverride<Dictionary> = {
  common: {
    back: "뒤로",
    retry: "다시 시도",
    close: "닫기",
    cancel: "취소",
  },
  settings: {
    title: "설정",
    language: "언어",
  },
};
