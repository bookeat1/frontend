import type { ReactNode } from "react";

import { cx } from "@web/lib/cx";

/**
 * Полоса у нижнего края экрана — паттерн мобильного приложения
 * (`SafeAreaView edges=["bottom"]` + `styles.footer` в
 * `apps/mobile/app/restaurant/[id]/index.tsx` и `.../book/index.tsx`):
 * белая подложка, тень вверх, внутри одна главная кнопка (и, у брони,
 * строка-причина над ней). Живёт ТОЛЬКО ниже `lg` — с `lg` структуру задаёт
 * Figma WEB, и там та же кнопка стоит в правой колонке.
 *
 * Два режима на `lg`:
 *   • `desktop="hidden"` (по умолчанию) — полоса исчезает целиком; так у
 *     страницы заведения, где на десктопе вместо кнопки карточка со слотами;
 *   • `desktop="inline"` — тот же узел остаётся в потоке без подложки и тени;
 *     так у сводки брони, где кнопка одна на оба экрана и второй экземпляр
 *     в DOM недопустим (двойная кнопка отправки — дефект, а не адаптив).
 *
 * Страница, над которой полоса прибита, обязана оставить под ней место:
 * `pb-bottom-bar-clearance lg:pb-*` на своём контейнере — иначе последний
 * блок уходит под полосу (в приложении это `DETAIL_FOOTER_CLEARANCE`).
 *
 * `env(safe-area-inset-bottom)` — аналог `SafeAreaView edges=["bottom"]`:
 * на телефонах с жестовой полосой кнопка не ложится под неё.
 */
export function BottomBar({
  children,
  desktop = "hidden",
  className,
}: {
  children: ReactNode;
  desktop?: "hidden" | "inline";
  className?: string;
}) {
  return (
    <div
      className={cx(
        "fixed inset-x-0 bottom-0 z-40 flex flex-col gap-bottom-bar-gap bg-canvas p-bottom-bar shadow-bottom-bar",
        "pb-[max(theme(spacing.bottom-bar),env(safe-area-inset-bottom))]",
        desktop === "hidden"
          ? "lg:hidden"
          : "lg:static lg:z-auto lg:bg-transparent lg:p-0 lg:shadow-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
