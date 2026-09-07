"use client";

import Image from "next/image";
import Link from "next/link";
import type { GuideRouteDetail } from "@bookeat/api/client";

import {
  EditorialHero,
  RouteStopCard,
  RouteStopCardSkeleton,
} from "@web/components/guide/GuideCards";
import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { assetUrl } from "@web/lib/asset";
import { isApiConfigured } from "@web/lib/api";
import { useCity } from "@web/lib/city";
import { useT } from "@web/lib/locale";
import { isNotFound } from "@web/lib/not-found";
import { useGuideRoute } from "@web/lib/queries";

/**
 * Одна гастропрогулка — «Маршруты» на сайте, `/routes/[slug]`. Figma
 * `qmMsg4jO1ggmyEHNIAD2ll`, узел 5078:5976 («Классический тур по Алматы»).
 * Данные — `GET /gastroguide/routes/:slug` (`useGuideRoute`); неизвестный
 * слаг, черновик и снятый с публикации маршрут дают одинаковый 404, экран
 * показывает честное «не найдено».
 *
 * КАРТЫ НА СТРАНИЦЕ НЕТ. В макете «Маршрут» — это карта города с
 * пронумерованными пинами по остановкам. У бэкенда с 2026-09 есть широта и
 * долгота каждой остановки (`GuideRoutePoint.Latitude/Longitude`,
 * bookeat-backend `internal/domain/gastro_route.go`), но нет способа
 * ОТРИСОВАТЬ несколько пинов на одной карте: единственная карточная ручка,
 * `GET /restaurants/:id/map`, рендерит РОВНО ОДНО заведение и её вайтлист
 * размеров/зумов не рассчитан на маршрут (`internal/usecase/staticmap`).
 * Звать сторонний картографический провайдер прямо с клиента — уже другое
 * архитектурное решение (новая зависимость, чужой сервер, ключ провайдера),
 * которое по правилам репозитория утверждает tech-lead, а не эта правка.
 * Секция «Маршрут» показывает ВСЕ остановки по порядку — тот же контент, что
 * дала бы карта, без географии; ровно так уже сделан мобильный экран
 * (`apps/mobile/app/routes/[slug].tsx`) — там редизайн с картой был
 * заблокирован по той же причине (`bookeat-guide-route-redesign`, 2026-09-01)
 * и страница осталась «журнальной». Флаг для tech-lead/product: координаты
 * есть, карты по-прежнему нет — оба клиента ждут решения про провайдера.
 *
 * МЕСТО КАРТЫ занимает статичная картинка-заглушка (`RouteMapIllustration`
 * ниже) — тот же приём, что «карта-иллюстрация» на фирменной странице Ocean
 * Basket (`apps/web/src/components/ocean/OceanBasketScreen.tsx`,
 * `oceanAssets.map`): локальный файл в `public/`, без `fill`-функциональности
 * и без живых пинов. Разница с Ocean Basket: та картинка — конкретная точка
 * на конкретной карте (у бренда одна локация, её можно нарисовать один раз),
 * а маршрут — любой город и любой набор остановок, поэтому картинка здесь
 * АБСТРАКТНАЯ (дорога и пины без надписей и координат), а не снимок
 * настоящей карты — так её можно переиспользовать на любом маршруте, не
 * соврав про город или число точек. Порядок и число остановок гость видит в
 * списке карточек ниже, картинка их не дублирует и не противоречит им.
 *
 * Состояния: скелет той же геометрии, «не найдено» на 404 (честное «нет», не
 * ошибка сети), ошибка сети с повтором, успех.
 */
export function GuideRouteScreen({ slug }: { slug: string }) {
  const t = useT();
  const { city } = useCity();
  const query = useGuideRoute(slug);

  return (
    <SiteChrome active="guide">
      {!isApiConfigured ? (
        <Container className="py-24">
          <StateMessage
            title={t.web.states.notConfiguredTitle}
            text={t.web.states.notConfiguredText}
            tone="danger"
          />
        </Container>
      ) : query.isError ? (
        <Container className="py-24">
          {isNotFound(query.error) ? (
            <StateMessage title={t.articles.routeNotFoundTitle} text={t.articles.routeNotFoundDescription}>
              <Button size="m" variant="secondary" asLink href="/guide">
                {t.web.guide.backLink}
              </Button>
            </StateMessage>
          ) : (
            <StateMessage title={t.articles.routeErrorTitle} text={t.web.states.errorText} tone="danger">
              <Button size="m" variant="secondary" onClick={() => query.refetch()}>
                {t.web.states.retry}
              </Button>
            </StateMessage>
          )}
        </Container>
      ) : query.isPending || query.data === undefined ? (
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">{t.web.states.loading}</span>
          <RouteSkeleton />
        </div>
      ) : (
        <RouteBody route={query.data} city={city ?? t.explore.cityFallback} />
      )}
    </SiteChrome>
  );
}

function RouteBody({ route, city }: { route: GuideRouteDetail; city: string }) {
  const t = useT();
  const duration = route.durationLabel.trim() || t.articles.routePoints(route.pointCount);

  return (
    <>
      <EditorialHero
        photo={
          <RemoteImage
            src={route.coverImageUrl}
            alt=""
            sizes="100vw"
            priority
            className="absolute inset-0 h-full w-full"
          />
        }
        eyebrow={t.articles.rubricEyebrow(city)}
        headline={route.title}
        headlineClassName="break-words text-[28px] font-bold leading-8 text-ink-on-inverse lg:text-[36px] lg:leading-[40px]"
        subheadline={route.description || undefined}
      />

      <Container className="flex flex-col gap-6 py-8 lg:py-12">
        <Link
          href="/guide"
          className="inline-flex h-article-back w-fit items-center gap-1 rounded-lg bg-canvas px-3 py-2 text-[16px] font-semibold leading-[22px] text-brand shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span aria-hidden="true">←</span>
          {t.web.guide.backLink}
        </Link>

        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="break-words text-[22px] font-semibold leading-7 text-ink lg:text-[26px] lg:leading-6">
            {t.articles.routeSectionTitle}
          </h2>
          <p className="text-bodyM text-ink-secondary">{duration}</p>
        </div>

        <RouteMapIllustration />

        <ul
          className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:gap-6"
          aria-label={t.articles.routeSectionTitle}
        >
          {route.points.map((point) => (
            <li key={point.id}>
              <RouteStopCard point={point} />
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}

/**
 * Место карты — статичная картинка `public/guide/route-map-placeholder.svg`
 * (дорога и пины без подписей). Декоративная: `alt=""`, как обложка героя —
 * реальный порядок остановок читает список карточек рядом, а не эта
 * иллюстрация. Высота — `h-venue-map` (280 / `webVenuePage.map`), готовый
 * токен карты того же файла Figma, а не число на глаз.
 */
function RouteMapIllustration() {
  return (
    <div className="relative h-venue-map w-full overflow-hidden rounded-lg bg-muted">
      <Image
        src={assetUrl("/guide/route-map-placeholder.svg")}
        alt=""
        fill
        sizes="(min-width: 1024px) 1200px, 100vw"
        unoptimized
        className="object-cover"
      />
    </div>
  );
}

/** Скелет той же геометрии: герой, ссылка, заголовок секции, картинка карты,
 * две карточки. */
function RouteSkeleton() {
  return (
    <>
      <Skeleton className="h-[280px] w-full rounded-none lg:h-[360px]" />
      <Container className="flex flex-col gap-6 py-8 lg:py-12">
        <Skeleton className="h-article-back w-32 rounded-lg" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-venue-map w-full" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:gap-6">
          <RouteStopCardSkeleton />
          <RouteStopCardSkeleton />
        </div>
      </Container>
    </>
  );
}
