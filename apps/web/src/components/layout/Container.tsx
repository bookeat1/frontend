import type { ReactNode } from "react";

import { cx } from "@web/lib/cx";

/**
 * Контейнер десктопной сетки (Figma 3z0f6dgev4HMwBAHPjTjPo, узел 3273:124):
 * 1200 px содержимого, 120 px внешних полей на кадре 1440.
 *
 * Поля выражены не паддингом, а центрированием: 1440 − 2 × 120 = 1200, и это
 * ровно `max-w-container` посередине. Паддинг остался только для экранов уже
 * 1440 — там 16/24 px по краям, чтобы текст не прилипал к рамке. Мобильную
 * адаптацию сейчас не делаем, но и рассыпаться на 360 px это не должно.
 *
 * Шапка и подвал заливают фон на всю ширину, а содержимое кладут в этот же
 * контейнер — в макете у них те же 120 px полей.
 */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("mx-auto w-full max-w-container px-4 lg:px-6 2xl:px-0", className)}>
      {children}
    </div>
  );
}
