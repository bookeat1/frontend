"use client";

import { FILTERS_BUTTON_FRAME, FILTERS_RAIL_FRAME } from "@web/components/catalog/FiltersRail";
import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { Skeleton } from "@web/components/state/AsyncBlock";
import { cx } from "@web/lib/cx";
import { useT } from "@web/lib/locale";

/**
 * Что видно на месте листинга, пока не выполнился JS (граница Suspense вокруг
 * `useSearchParams`). Шапка, подвал и скелет выдачи — той же высоты, что
 * настоящие карточки, чтобы страница не прыгнула при появлении данных.
 *
 * Скелет фильтров повторяет НАСТОЯЩИЙ блок в обе стороны от `lg`: на десктопе
 * — колонка 288, на телефоне — кнопка «Фильтры» высотой чипа. Классы каркаса
 * общие с `FiltersRail` (`apps/web/docs/responsive.md`, дыра № 9): раньше
 * `h-[560px] w-full` лежал на телефоне серым прямоугольником над выдачей.
 */
export function CatalogFallback() {
  const t = useT();

  return (
    <SiteChrome active="venues">
      <Container className="flex flex-col gap-8 py-8 lg:flex-row">
        <Skeleton className={cx(FILTERS_RAIL_FRAME, "h-[560px]")} />
        <Skeleton className={cx(FILTERS_BUTTON_FRAME, "w-[124px]")} />
        <div role="status" aria-live="polite" aria-busy="true" className="flex min-w-0 flex-1 flex-col gap-4">
          <span className="sr-only">{t.web.states.loading}</span>
          {["a", "b", "c", "d", "e"].map((key) => (
            <Skeleton key={key} className="h-wide-card rounded-wide-card" />
          ))}
        </div>
      </Container>
    </SiteChrome>
  );
}
