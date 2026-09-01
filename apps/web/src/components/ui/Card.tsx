import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "@web/lib/cx";

/**
 * Белая карточка-подложка: радиус 24 и две тени
 * (0 4 10 rgba(0,0,0,.10) + 0 2 4 rgba(0,0,0,.05)) — Figma
 * 3z0f6dgev4HMwBAHPjTjPo, узел 3280:5482.
 *
 * ВАЖНО: блок «РАДИУСЫ И ОТСТУПЫ» кита подписывает под «карточки заведений»
 * 20, а сами карточки на кадрах нарисованы с 24. Взяли то, что нарисовано;
 * оба числа лежат в токенах (`webRadius.xl` и `webRadius.card`), чтобы
 * расхождение было видно, а не спрятано.
 *
 * Компонент намеренно тупой: одна подложка, никакой внутренней раскладки.
 * Содержимое собирают карточки конкретных сущностей — `VenueCard` и те, что
 * появятся вместе с экранами.
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...rest }: CardProps) {
  return (
    <div {...rest} className={cx("overflow-hidden rounded-card bg-canvas shadow-card", className)}>
      {children}
    </div>
  );
}
