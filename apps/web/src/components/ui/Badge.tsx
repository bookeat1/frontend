import type { ReactNode } from "react";

import { cx } from "@web/lib/cx";

/**
 * Бейдж статуса. Figma 3z0f6dgev4HMwBAHPjTjPo, узлы 3274:45…3274:53 —
 * высота 32, паддинг 8/16, радиус полный, кегль 14/16 SemiBold.
 *
 * Пять нарисованных бейджей — это не пять компонентов, а пять пар
 * «подложка + текст». Тон назван по СМЫСЛУ, а подпись приходит снаружи:
 * статус брони переводится словарём и склоняется бэкендом, компонент про
 * текст ничего не знает.
 *
 * Тона success и warning взяты из самих бейджей, а не из блока «Цвета»: там
 * подписан success/500 (#2E7D32), а бейдж нарисован темнее (#1B5E20), у
 * warning текстового образца нет вовсе. Расхождение зафиксировано в токенах
 * (packages/design-tokens/src/web.ts), а не заглажено здесь.
 */
export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "brand";

const tones: Record<BadgeTone, string> = {
  success: "bg-success text-success-text",
  warning: "bg-warning text-warning-text",
  danger: "bg-danger text-danger-text",
  neutral: "bg-muted text-ink-secondary",
  brand: "bg-brand text-ink-on-brand",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-badge items-center justify-center rounded-full px-badge-x text-[14px] font-semibold leading-4",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
