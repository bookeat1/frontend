"use client";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { Skeleton } from "@web/components/state/AsyncBlock";
import { useT } from "@web/lib/locale";

/**
 * Что видно на месте листинга, пока не выполнился JS (граница Suspense вокруг
 * `useSearchParams`). Шапка, подвал и скелет выдачи — той же высоты, что
 * настоящие карточки, чтобы страница не прыгнула при появлении данных.
 */
export function CatalogFallback() {
  const t = useT();

  return (
    <SiteChrome active="venues">
      <Container className="flex flex-col gap-8 py-8 lg:flex-row">
        <Skeleton className="h-[560px] w-full lg:w-[288px] lg:shrink-0" />
        <div role="status" aria-live="polite" aria-busy="true" className="flex min-w-0 flex-1 flex-col gap-4">
          <span className="sr-only">{t.web.states.loading}</span>
          {["a", "b", "c", "d", "e"].map((key) => (
            <Skeleton key={key} className="h-[229px] rounded-card" />
          ))}
        </div>
      </Container>
    </SiteChrome>
  );
}
