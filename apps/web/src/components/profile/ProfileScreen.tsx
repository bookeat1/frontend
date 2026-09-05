"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { ProfileCard, type ProfileStat } from "@web/components/profile/ProfileCard";
import { ProfileNav, SECTION_PARAM, parseSection, type ProfileSection } from "@web/components/profile/ProfileNav";
import { ProfileSegmented } from "@web/components/profile/ProfileSegmented";
import { Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { useAuth } from "@web/lib/auth";
import { useLocale } from "@web/lib/locale";
import { type BookingSegment, countVisits, splitBySegment } from "@web/lib/profile-bookings";
import { useFavoriteIds, useMyBookings } from "@web/lib/queries";
import { loginHref } from "@web/lib/return-to";

/**
 * Страница гостя `/profile` — Figma QovvuAoI9YxsLMwWkfgKN8, узел 3525:15153
 * («WEB / 05 · Страница гостя»). Разбор: `design-specs/web/spec-profile.md`,
 * числа — `webProfile` в `packages/design-tokens/src/web.ts`.
 *
 * Каркас: карточка гостя сверху, ниже — меню разделов слева (252) и активный
 * раздел справа через 32. Раздел выбирается адресом (`?section=…`), поэтому
 * пункты меню — ссылки. Здесь собраны карточка, меню и КАРКАС раздела «Мои
 * брони» (заголовок + сегменты + место под список); сами карточки броней,
 * «Избранное» и «Настройки» — отдельные задачи, их место занимают заглушки
 * той же геометрии.
 *
 * ГОСТЬ БЕЗ СЕССИИ: страница личная, показывать на ней нечего — уводим на
 * `/login` с возвратом сюда (`return-to.ts`). Пока сессия читается из
 * хранилища, НИЧЕГО не решаем: иначе перезагрузка страницы у вошедшего гостя
 * мигала бы экраном входа.
 *
 * НИЖЕ `lg` (контракт `apps/web/docs/responsive.md`): структура «Профиля»
 * приложения — карточка, под ней меню на всю ширину, под ним раздел; числа из
 * Figma WEB стоят только под `lg:`. Просветы узкого экрана — шкала Tailwind, как
 * у `Container` и `SiteHeader`; отдельных мобильных токенов у страницы нет.
 */
export function ProfileScreen() {
  const { t } = useLocale();
  const texts = t.web.profile;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user, signedIn, isLoading, signOut } = useAuth();
  const section = parseSection(params.get(SECTION_PARAM));

  // Выход, начатый с этой страницы, ведёт на главную, а не на экран входа:
  // сторож ниже увидит `signedIn=false` в тот же тик и без этого флага
  // перебил бы переход своим редиректом на /login.
  const leaving = useRef(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (isLoading || signedIn || leaving.current) return;
    router.replace(loginHref(pathname));
  }, [isLoading, signedIn, pathname, router]);

  const bookings = useMyBookings();
  const favorites = useFavoriteIds();

  const stats: ProfileStat[] = [
    {
      value: bookings.isError ? null : bookings.data ? countVisits(bookings.data.items) : undefined,
      word: texts.visitsWord,
    },
    {
      value: favorites.isError ? null : favorites.data ? favorites.data.size : undefined,
      word: texts.favoritesWord,
    },
  ];

  const handleSignOut = () => {
    if (signingOut) return;
    leaving.current = true;
    setSigningOut(true);
    signOut();
    router.replace("/");
  };

  let body: React.ReactNode;
  if (isLoading) {
    body = <PageSkeleton />;
  } else if (!signedIn) {
    body = <StateMessage text={texts.signInText} />;
  } else {
    body = (
      <>
        <ProfileCard user={user} fallbackName={t.web.header.account} stats={stats} />
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-profile-content-gap">
          <ProfileNav active={section} onSignOut={handleSignOut} signingOut={signingOut} />
          <div className="min-w-0 flex-1">
            {section === "bookings" ? (
              <BookingsSectionFrame
                counts={bookings.data ? segmentCounts(bookings.data.items) : undefined}
              />
            ) : (
              <SectionFrame title={section === "favorites" ? texts.favorites.title : texts.settings.title} />
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    // Кадр 3525:15153 залит `background/subtle`: белые карточки на серой подложке.
    <SiteChrome tone="subtle">
      <Container className="flex flex-col gap-6 py-6 lg:gap-profile-page-gap lg:pb-profile-page-b lg:pt-profile-page-t">
        {body}
      </Container>
    </SiteChrome>
  );
}

function segmentCounts(items: readonly import("@bookeat/api/client").Booking[]): Record<BookingSegment, number> {
  const split = splitBySegment(items, new Date());
  return { active: split.active.length, past: split.past.length, cancelled: split.cancelled.length };
}

const SEGMENTS: readonly BookingSegment[] = ["active", "past", "cancelled"];

/**
 * Каркас раздела «Мои брони» (узел 3525:15194): заголовок 28/36 и сегменты в
 * одной строке, ниже через 20 — список. Списка здесь ещё нет (задача T2.1b);
 * его место держит заглушка высотой карточки брони, чтобы страница не
 * меняла высоту, когда список появится. Счётчики в сегментах — настоящие,
 * из того же запроса, что и «визиты» в карточке; пока запрос едет, подписи
 * без чисел, а не с нулями.
 */
function BookingsSectionFrame({ counts }: { counts?: Record<BookingSegment, number> }) {
  const { t } = useLocale();
  const texts = t.web.profile.bookings;
  const [segment, setSegment] = useState<BookingSegment>("active");
  const panelId = "profile-bookings-panel";

  const options = useMemo(
    () =>
      SEGMENTS.map((key) => ({
        key,
        label: counts ? texts.segment(texts.segments[key], counts[key]) : texts.segments[key],
      })),
    [counts, texts],
  );

  return (
    <section aria-labelledby="profile-bookings-title" className="flex flex-col gap-profile-section-gap">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="profile-bookings-title" className="text-profile-title tracking-[-0.5px] text-ink">
          {texts.title}
        </h2>
        <ProfileSegmented
          options={options}
          value={segment}
          onChange={setSegment}
          label={texts.segmentsLabel}
          panelId={panelId}
        />
      </div>
      <div id={panelId} role="tabpanel" className="flex flex-col gap-pbook-gap">
        {/* Место под карточки броней (T2.1b): высота карточки — фото 214. */}
        <Skeleton className="h-pbook-image w-full rounded-pbook" />
      </div>
    </section>
  );
}

/** Разделы «Избранное» и «Настройки» — свои задачи; здесь только заголовок и
 * место под содержимое той же геометрии. */
function SectionFrame({ title }: { title: string }) {
  return (
    <section className="flex flex-col gap-profile-section-gap">
      <h2 className="text-profile-title tracking-[-0.5px] text-ink">{title}</h2>
      <Skeleton className="h-fav-image w-full rounded-pbook" />
    </section>
  );
}

/** Пока сессия читается: карточка и колонки той же высоты, что настоящие. */
function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6 lg:gap-profile-page-gap">
      <Skeleton className="h-[156px] w-full rounded-xl" />
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-profile-content-gap">
        <Skeleton className="h-[220px] w-full rounded-card lg:w-profile-nav" />
        <Skeleton className="h-pbook-image w-full flex-1 rounded-pbook" />
      </div>
    </div>
  );
}
