import type { ReactNode } from "react";

import { cx } from "@web/lib/cx";

/**
 * Ярлык страницы заведения — Figma 3z0f6dgev4HMwBAHPjTjPo, узлы 3261:53
 * («Открыто до 23:00») и 3261:58…3261:66 (удобства): высота 32, радиус 10,
 * паддинг 7/12, кегль 13/18 Medium.
 *
 * ПОЧЕМУ ЭТО НЕ `Badge`. Бейдж кита (узел 3274:45) тоже 32 высотой, но у него
 * ПОЛНЫЙ радиус и кегль 14/16 SemiBold — то есть таблетка, а не прямоугольник
 * со скруглением 10. Это два разных элемента макета, и свести их в один
 * компонент можно было бы только выкинув числа одного из них. Бейдж остаётся
 * статусом брони, ярлык — свойством заведения.
 *
 * Точка у тона `success` (узел 3261:54) — 7 px цветом success/500 (#2E7D32),
 * а текст ярлыка темнее, success/700. Разные тона в макете, разные токены
 * здесь.
 */
export type TagTone = "success" | "neutral";

const tones: Record<TagTone, string> = {
  success: "bg-success text-success-text",
  neutral: "bg-muted text-ink-secondary",
};

export function Tag({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: TagTone;
  /** Кружок слева, как у ярлыка «Открыто» (узел 3261:53). */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-venue-tag items-center gap-1.5 rounded-tag px-venue-tag-x text-[13px] font-medium leading-[18px]",
        tones[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cx(
            "h-[7px] w-[7px] shrink-0 rounded-full",
            tone === "success" ? "bg-success-dot" : "bg-ink-tertiary",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}
