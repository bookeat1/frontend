import type { Dictionary } from "./ru";
import type { LocaleOverride } from "./index";

/**
 * 中文 — PARTIAL translation. Everything not listed here falls back to the
 * Russian base at runtime (see getDictionary). Full translation is a separate
 * task.
 */
export const zh: LocaleOverride<Dictionary> = {
  common: {
    back: "返回",
    retry: "重试",
    close: "关闭",
    cancel: "取消",
  },
  settings: {
    title: "设置",
    language: "语言",
  },
};
