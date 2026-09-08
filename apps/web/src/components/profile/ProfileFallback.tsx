"use client";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { Skeleton } from "@web/components/state/AsyncBlock";
import { useT } from "@web/lib/locale";

/**
 * Скелет страницы гостя: карточка и две колонки той же высоты, что настоящие,
 * чтобы страница не прыгала, когда сессия прочитана и данные приехали.
 * Высоты 156 и 220 — суммы токенов `webProfile` (паддинги карточки + аватар;
 * паддинги меню + четыре пункта с просветами), а не отдельные числа макета:
 * своего токена у них нет, потому что в Figma такого слоя нет.
 */
export function ProfileSkeleton() {
  const t = useT();

  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6 lg:gap-profile-page-gap">
      <span className="sr-only">{t.web.states.loading}</span>
      <Skeleton className="h-[156px] w-full rounded-xl" />
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-profile-content-gap">
        <Skeleton className="h-[220px] w-full rounded-card lg:w-profile-nav" />
        <Skeleton className="h-pbook-image w-full flex-1 rounded-pbook" />
      </div>
    </div>
  );
}

/**
 * Что видно на месте страницы гостя, пока не выполнился JS (граница Suspense
 * вокруг `useSearchParams`, см. `app/profile/page.tsx`). Шапка, подвал и тот
 * же скелет, что пока читается сессия — а не пустой белый лист, как у
 * `/venues` (`CatalogFallback`) и `/login`.
 */
export function ProfileFallback() {
  return (
    <SiteChrome tone="subtle">
      <Container className="flex flex-col gap-6 py-6 lg:gap-profile-page-gap lg:pb-profile-page-b lg:pt-profile-page-t">
        <ProfileSkeleton />
      </Container>
    </SiteChrome>
  );
}
