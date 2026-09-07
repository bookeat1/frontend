"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { GuideCollectionVenue } from "@bookeat/api/client";

import { CoverFrame, EditorialHero } from "@web/components/guide/GuideCards";
import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { assetUrl } from "@web/lib/asset";
import { isApiConfigured } from "@web/lib/api";
import { useCity } from "@web/lib/city";
import { collectionsForRubric, dedupeGuideVenues } from "@web/lib/guide-collections";
import { guideVenueMeta } from "@web/lib/format";
import { useT } from "@web/lib/locale";
import { useGuideCategories, useGuideCollectionDetails, useGuideCollections } from "@web/lib/queries";

/**
 * Экран одной рубрики гастрогида — `/guide/rubric/[slug]`. Figma
 * `qmMsg4jO1ggmyEHNIAD2ll`, узел 5078:5739 («Казахская кухня»): журнальная
 * шапка (та же `EditorialHero`, что у корня `/guide` и у маршрута) и лист
 * «Избранное редакции» со списком заведений рубрики.
 *
 * ДВУХ ЭЛЕМЕНТОВ МАКЕТА ЗДЕСЬ НЕТ НАМЕРЕННО — то же решение владельца
 * (2026-08-28), что уже принято на мобильном экране-близнеце
 * (`apps/mobile/app/gastroguide/rubric/[slug].tsx`):
 *
 *   • плашка «№1» в углу карточки — это РАНГ места в рубрике. Ни у подборки,
 *     ни у заведения в ответе `GET /gastroguide/collections/:slug` нет ни
 *     рейтинга, ни позиции-как-места: `position` там — порядок вывода,
 *     заданный редактором, и подписывать его «№1» значило бы объявить первое
 *     попавшееся заведение лучшим в рубрике;
 *   • плашка «ВЫБОР VISIT ALMATY» — редакционная отметка, которой нет ни у
 *     заведения, ни у подборки в ответе. Рисовать её всем сразу значило бы
 *     обесценить саму отметку.
 *
 * Обе вернутся, когда за ними появится поле в API — не раньше.
 *
 * ОТКУДА ДАННЫЕ (новых ручек не заводилось, ровно как на мобилке):
 *   • название рубрики — `GET /gastroguide/categories`; рубрики с таким
 *     слагом в справочнике не нашлось — берём название ПЕРВОЙ подборки
 *     рубрики (честнее пустой шапки и выдуманного текста);
 *   • фото и подпись шапки — у первой подборки рубрики (`coverImageUrl`,
 *     `description` из `GET /gastroguide/collections`);
 *   • список заведений — заведения ВСЕХ подборок рубрики
 *     (`GET /gastroguide/collections/:slug` на каждую), схлопнутые по
 *     `restaurantId` (`dedupeGuideVenues`).
 *
 * Состояния: пока не известно ни название, ни обложка — рисовать шапку не на
 * чем, остаётся ссылка назад на кремовом листе. Как только имя нашлось, шапка
 * стоит всегда, а загрузка/отказ/пустота списка живут внутри секции.
 * Неизвестный слаг — честное «рубрика не найдена», а не ошибка сети.
 */
export function GuideRubricScreen({ slug }: { slug: string }) {
  const t = useT();
  const { city } = useCity();
  const categoriesQuery = useGuideCategories();
  const collectionsQuery = useGuideCollections();

  const rubricCollections = useMemo(
    () => collectionsForRubric(collectionsQuery.data ?? [], slug),
    [collectionsQuery.data, slug],
  );
  const detailSlugs = useMemo(() => rubricCollections.map((c) => c.slug), [rubricCollections]);
  const detailQueries = useGuideCollectionDetails(detailSlugs);

  const category = useMemo(
    () => (categoriesQuery.data ?? []).find((c) => c.slug === slug),
    [categoriesQuery.data, slug],
  );
  const lead = rubricCollections[0];
  const title = category?.title || lead?.title || "";
  const venues = dedupeGuideVenues(detailQueries.map((q) => q.data));

  const backLink = (
    <Link
      href="/guide"
      className="inline-flex h-article-back w-fit items-center gap-1 rounded-lg bg-canvas px-3 py-2 text-[16px] font-semibold leading-[22px] text-brand shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span aria-hidden="true">←</span>
      {t.web.guide.backLink}
    </Link>
  );

  if (!isApiConfigured) {
    return (
      <SiteChrome active="guide">
        <Container className="py-24">
          <StateMessage title={t.web.states.notConfiguredTitle} text={t.web.states.notConfiguredText} tone="danger" />
        </Container>
      </SiteChrome>
    );
  }

  if (collectionsQuery.isPending || categoriesQuery.isPending) {
    return (
      <SiteChrome active="guide">
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">{t.web.states.loading}</span>
          <RubricSkeleton />
        </div>
      </SiteChrome>
    );
  }

  if (collectionsQuery.isError) {
    return (
      <SiteChrome active="guide">
        <Container className="flex flex-col gap-6 py-24">
          {backLink}
          <StateMessage title={t.web.states.errorTitle} text={t.web.states.errorText} tone="danger">
            <Button size="m" variant="secondary" onClick={() => collectionsQuery.refetch()}>
              {t.web.states.retry}
            </Button>
          </StateMessage>
        </Container>
      </SiteChrome>
    );
  }

  // Ни рубрики с таким слагом, ни подборок с ним — ссылка устарела.
  if (!title) {
    return (
      <SiteChrome active="guide">
        <Container className="flex flex-col gap-6 py-24">
          {backLink}
          <StateMessage title={t.articles.rubricNotFoundTitle} text={t.articles.rubricNotFoundDescription} />
        </Container>
      </SiteChrome>
    );
  }

  const detailsLoading = detailQueries.some((q) => q.isPending);
  const failed = detailQueries.find((q) => q.isError);
  const allFailed = detailQueries.length > 0 && detailQueries.every((q) => q.isError);

  return (
    <SiteChrome active="guide">
      <EditorialHero
        photo={
          <RemoteImage
            src={lead?.coverImageUrl ?? null}
            alt=""
            sizes="100vw"
            priority
            className="absolute inset-0 h-full w-full"
          />
        }
        eyebrow={t.articles.rubricEyebrow(city ?? t.explore.cityFallback)}
        headline={title}
        subheadline={lead?.description || undefined}
      />

      <Container className="flex flex-col gap-6 py-8 lg:py-12">
        {backLink}

        <h2 className="break-words text-[22px] font-semibold leading-7 text-ink lg:text-[26px] lg:leading-6">
          {t.articles.rubricEditorialTitle}
        </h2>

        {detailsLoading ? (
          <div role="status" aria-live="polite" aria-busy="true">
            <span className="sr-only">{t.web.states.loading}</span>
            <VenueListSkeleton />
          </div>
        ) : allFailed && failed ? (
          <StateMessage title={t.web.states.errorTitle} text={t.web.states.errorText} tone="danger">
            <Button size="m" variant="secondary" onClick={() => detailQueries.forEach((q) => q.refetch())}>
              {t.web.states.retry}
            </Button>
          </StateMessage>
        ) : venues.length === 0 ? (
          <StateMessage title={t.articles.rubricEmptyTitle} text={t.articles.rubricEmptyDescription} />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:gap-6" aria-label={t.articles.rubricEditorialTitle}>
            {venues.map((venue) => (
              <li key={venue.restaurantId}>
                <RubricVenueCard venue={venue} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </SiteChrome>
  );
}

const HALF_SIZES = "(min-width: 1280px) 588px, (min-width: 768px) 50vw, 100vw";

/**
 * Карточка заведения рубрики — тот же журнальный приём, что у гастропрогулки
 * (`RouteStopCard`/`WalkCard` в `GuideCards.tsx`): фото с затемнением, текст
 * снизу. Своя, а не переиспользованная `RouteStopCard`, потому что данные
 * другой формы (`GuideCollectionVenue`, не `GuideRoutePoint`) и у карточки нет
 * бейджа с номером остановки.
 */
function RubricVenueCard({ venue }: { venue: GuideCollectionVenue }) {
  const t = useT();
  return (
    <CoverFrame
      src={venue.imageUrl}
      alt={venue.name}
      sizes={HALF_SIZES}
      className="h-guide-walk-m px-4 py-4 lg:h-guide-walk lg:px-[27px] lg:py-5"
    >
      <div className="flex flex-col gap-1">
        <h3 className="break-words font-serif text-[20px] italic leading-6 text-ink-on-inverse lg:text-[22px]">
          <Link
            href={`/venues/${encodeURIComponent(venue.restaurantId)}`}
            aria-label={t.articles.openVenue(venue.name)}
            className="after:absolute after:inset-0 after:z-20 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guide-gold"
          >
            {venue.name}
          </Link>
        </h3>
        <p className="break-words text-[16px] leading-6 text-ink-on-inverse lg:text-[18px]">
          {guideVenueMeta(venue.cuisineType, venue.priceCategory, t)}
        </p>
      </div>
    </CoverFrame>
  );
}

function RubricSkeleton() {
  return (
    <>
      <Skeleton className="h-[280px] w-full rounded-none lg:h-[360px]" />
      <Container className="flex flex-col gap-6 py-8 lg:py-12">
        <Skeleton className="h-article-back w-32 rounded-lg" />
        <Skeleton className="h-8 w-40" />
        <VenueListSkeleton />
      </Container>
    </>
  );
}

function VenueListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:gap-6">
      <Skeleton className="h-guide-walk-m w-full rounded-card lg:h-guide-walk" />
      <Skeleton className="h-guide-walk-m w-full rounded-card lg:h-guide-walk" />
    </div>
  );
}
