"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { GuideCollection, GuideRoute, GuideRoutePoint } from "@bookeat/api/client";

import { Container } from "@web/components/layout/Container";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { Skeleton } from "@web/components/state/AsyncBlock";
import { cx } from "@web/lib/cx";
import { useT } from "@web/lib/locale";

/**
 * Карточки страницы гастрогида — Figma «WEB / 08 · Гастрогид» (5033:7096).
 * Все три — фотография с затемнением и текстом у нижнего края; отличаются
 * высотой, полями и набором строк. Числа — `webGuidePage` в токенах.
 *
 *   • плитка рубрики (5039:10258): 588×200, поле 16, золотая надпись 14 +
 *     название 20;
 *   • «Выбор редакции» (5040:10277): 1200×476, поле 24, надпись 18 +
 *     заголовок 26 + подпись 20;
 *   • гастропрогулка (5040:10283): 588×354, поле 20/27, заголовок 26 +
 *     подпись 20.
 *
 * ССЫЛКИ ЕСТЬ ТОЛЬКО У ГАСТРОПРОГУЛОК (`WalkCard`, `/routes/:slug` —
 * `GuideRouteScreen.tsx`). У рубрики и подборки страниц на сайте по-прежнему
 * нет (`/guide/<slug>` — 404 Next), и вести гостя в никуда хуже, чем показать
 * карточку без ссылки — тот же приём, что у `GuideCard` на главной за флагом
 * `SHOW_SECTION_LINKS`. Каждая карточка принимает `href`, и когда та или иная
 * страница появится, заголовок станет растянутой ссылкой без переделки
 * разметки — так уже случилось с гастропрогулкой.
 *
 * Ниже `lg` высоты — из мобильного экрана (`guideLayout`): 158 / 214 / 206.
 */

/** `sizes` для картинки в половину контейнера (две в ряд с `lg`). */
const HALF_SIZES = "(min-width: 1280px) 588px, (min-width: 768px) 50vw, 100vw";
/** `sizes` для картинки на всю ширину контейнера. */
const FULL_SIZES = "(min-width: 1280px) 1200px, 100vw";

/**
 * Шапка-«издание» гастрогида: фотография во всю ширину, тёмная плоская
 * заливка 32 % поверх, текст (золотая рубрика, заголовок, подпись) прижат к
 * низу. Ровно тот блок, что раньше жил только в `GuideScreen.tsx`
 * (`GuideHero`, узел 5033:7100) — вынесен сюда, потому что страница одного
 * маршрута (`/routes/:slug`) использует ТОТ ЖЕ визуальный приём, только с
 * фотографией из ответа сервера вместо статичного ассета. Картинку рисует
 * вызывающий (`photo`), а не сам компонент: у гастрогида это `next/image` по
 * `assetUrl`, у маршрута — `RemoteImage` с `null`-фолбэком, и превращать это
 * в третий проп-переключатель незачем.
 */
export function EditorialHero({
  photo,
  eyebrow,
  headline,
  subheadline,
  headlineClassName,
}: {
  photo: ReactNode;
  eyebrow: string;
  headline: string;
  subheadline?: string;
  /** Заголовок статьи/маршрута — обычный жирный, а не курсив Playfair
   * гастрогида; свой класс, чтобы не плодить проп на каждую деталь шрифта. */
  headlineClassName?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-black">
      {photo}
      <div aria-hidden="true" className="absolute inset-0 bg-black/[0.32]" />
      <Container className="relative z-10 flex flex-col gap-1.5 pb-8 pt-16 lg:pt-[126px]">
        <p className="text-[14px] font-semibold uppercase leading-[19px] tracking-[0.08em] text-guide-gold lg:text-[16px]">
          {eyebrow}
        </p>
        <h1
          className={
            headlineClassName ??
            "break-words font-serif text-[36px] italic leading-[1.2] text-ink-on-inverse lg:text-[48px]"
          }
        >
          {headline}
        </h1>
        {subheadline ? (
          <p className="break-words text-[18px] leading-6 text-ink-on-inverse lg:text-[20px] lg:leading-5">
            {subheadline}
          </p>
        ) : null}
      </Container>
    </section>
  );
}

/** Затемнение снизу вверх, чтобы белый текст читался на любой фотографии. */
const SCRIM = "after:absolute after:inset-0 after:bg-gradient-to-t after:from-black/80 after:via-black/35 after:to-black/5 after:content-['']";

const EYEBROW = "truncate font-semibold uppercase tracking-[0.08em] text-guide-gold";

export function CoverFrame({
  src,
  alt,
  sizes,
  className,
  fill,
  badge,
  children,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  className: string;
  fill?: string;
  /** Пилюля в левом верхнем углу поверх фотографии (номер остановки маршрута
   * «№1 · Ресторан») — единственный потребитель, у остальных карточек её
   * нет. Отдельный слот, а не часть `children`: `children` лежит внизу
   * карточки (`justify-end`), бейджу туда нельзя. */
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article
      className={cx(
        "relative flex w-full flex-col justify-end overflow-hidden rounded-card",
        fill ?? "bg-black",
        SCRIM,
        className,
      )}
    >
      {/* Картинка — фон карточки; `alt` пустой, потому что название написано
          рядом текстом и читалка не должна слышать его дважды. */}
      <div className="absolute inset-0" aria-hidden="true">
        <RemoteImage src={src} alt="" sizes={sizes} fallback={<span />} className="h-full w-full object-cover" />
      </div>
      {badge ? <div className="absolute left-3 top-3 z-20">{badge}</div> : null}
      {/* z поверх затемнения (`after:` псевдоэлемент лежит над фоном). */}
      <div className="relative z-10 flex min-w-0 flex-col">{children}</div>
    </article>
  );
}

/**
 * `eyebrow` — название рубрики из справочника (`GET /gastroguide/categories`,
 * `rubricEyebrow` в `lib/guide-collections.ts`); экран решает, показывать ли
 * его (пусто, когда рубрика совпадает с названием подборки без учёта
 * регистра). Карточка сама ничего не считает — источника рубрик у неё нет.
 */
export function RubricTile({
  collection,
  eyebrow,
  href,
}: {
  collection: GuideCollection;
  eyebrow?: string;
  href?: string;
}) {
  return (
    <CoverFrame
      src={collection.coverImageUrl}
      alt={collection.title}
      sizes={HALF_SIZES}
      className="h-guide-rubric-m p-4 lg:h-guide-rubric"
    >
      <div className="flex flex-col gap-0.5">
        {eyebrow ? <p className={cx(EYEBROW, "text-[14px] leading-[17px]")}>{eyebrow}</p> : null}
        <h3 className="break-words text-[20px] font-semibold leading-6 text-ink-on-inverse">
          <Title href={href}>{collection.title}</Title>
        </h3>
      </div>
    </CoverFrame>
  );
}

/**
 * Поля карточки — БЫЛИ перепутаны (Figma 5040:10277…10281): надпись «OCEAN
 * BASKET» заглавными это НАЗВАНИЕ БРЕНДА (`title`), крупная строка
 * «Средиземноморье в Алматы» — ПОДЗАГОЛОВОК (`subtitle`), а не `title`;
 * подпись «5 ресторанов · история бренда» — счётчик заведений, а не
 * `description` (абзац на карточке вообще не рисуем — в макете его нет).
 *
 * Пустой `subtitle` — заголовок держит сам `title`, и тогда надпись сверху
 * не рисуем (иначе он повторился бы дважды подряд).
 */
export function EditorPickCard({ collection, href }: { collection: GuideCollection; href?: string }) {
  const t = useT();
  const subtitle = collection.subtitle.trim();
  const heading = subtitle || collection.title;
  const eyebrow = subtitle ? collection.title.trim().toUpperCase() : "";
  const summary = t.web.home.guide.venues(collection.venueCount);

  return (
    <CoverFrame
      src={collection.coverImageUrl}
      alt={collection.title}
      sizes={FULL_SIZES}
      fill="bg-guide-pick"
      className="h-guide-pick-m p-4 lg:h-guide-pick lg:p-6"
    >
      <div className="flex flex-col gap-2">
        {eyebrow ? <p className={cx(EYEBROW, "text-[16px] leading-[21px] lg:text-[18px]")}>{eyebrow}</p> : null}
        <h3 className="break-words text-[22px] font-bold leading-7 text-ink-on-inverse lg:text-[26px] lg:leading-8">
          <Title href={href}>{heading}</Title>
        </h3>
        <p className="line-clamp-2 break-words text-[16px] leading-6 text-guide-pick-subtitle lg:text-[20px]">
          {summary}
        </p>
      </div>
    </CoverFrame>
  );
}

export function WalkCard({ route, href }: { route: GuideRoute; href?: string }) {
  const t = useT();
  // Строку под названием пишет редакция («1 день · 4 точки»); счёт точек —
  // запасной вариант, как в приложении.
  const summary = route.durationLabel.trim() || t.articles.routePoints(route.pointCount);

  return (
    <CoverFrame
      src={route.coverImageUrl}
      alt={route.title}
      sizes={HALF_SIZES}
      className="h-guide-walk-m px-4 py-4 lg:h-guide-walk lg:px-[27px] lg:py-5"
    >
      <div className="flex flex-col gap-[7px]">
        <h3 className="break-words text-[22px] font-bold leading-7 text-ink-on-inverse lg:text-[26px] lg:leading-8">
          <Title href={href}>{route.title}</Title>
        </h3>
        <p className="line-clamp-2 break-words text-[16px] leading-6 text-ink-on-inverse lg:text-[20px]">
          {summary}
        </p>
      </div>
    </CoverFrame>
  );
}

/** `sizes` для карточки остановки маршрута — одна в ряд на телефоне, две на
 * планшете и десктопе (`RouteStopCard` ниже). */
const STOP_SIZES = "(min-width: 1024px) 588px, (min-width: 768px) 50vw, 100vw";

/**
 * Одна остановка гастропрогулки (`/routes/:slug`, Figma `qmMsg4jO1ggmyEHNIAD2ll`,
 * узел 5078:5976) — фото с затемнением, номер остановки и её замысел бейджем
 * в углу («№1 · Ресторан»), заголовок и текст остановки внизу. Тот же приём,
 * что у `WalkCard`/`EditorPickCard`, размер карточки переиспользован у
 * `webGuidePage.walk` — точных чисел этой конкретной страницы Figma REST не
 * отдал (429 по файлу), а карточка того же смыслового ряда «фото + текст
 * гастрогида», так что чужие подтверждённые токены точнее, чем цифры на
 * глаз.
 *
 * ВЕТВИМСЯ ПО `venue`, А НЕ ПО `kind` — как в мобильном
 * `GuideRouteStopBlock`: `kind` это замысел редакции, а открыть можно только
 * то, у чего реально есть живое заведение.
 */
export function RouteStopCard({ point }: { point: GuideRoutePoint }) {
  const t = useT();
  const venue = point.venue;
  const photo = point.photoUrl ?? venue?.imageUrl ?? null;
  const kindLabel = t.articles.routeStopKind[point.kind];
  const address = point.address || venue?.address || "";

  return (
    <CoverFrame
      src={photo}
      alt={point.title}
      sizes={STOP_SIZES}
      className="h-guide-walk-m px-4 py-4 lg:h-guide-walk lg:px-[27px] lg:py-5"
      badge={
        <span className="truncate rounded-full bg-canvas/70 px-3 py-1 text-[12px] font-semibold leading-4 text-brand backdrop-blur-sm">
          {t.articles.routeStopBadge(point.position, kindLabel)}
        </span>
      }
    >
      <div className="flex flex-col gap-1">
        <h3 className="break-words font-serif text-[18px] italic leading-6 text-ink-on-inverse lg:text-[20px]">
          {venue ? (
            <Link
              href={`/venues/${encodeURIComponent(venue.id)}`}
              aria-label={t.articles.openVenue(venue.name)}
              className="after:absolute after:inset-0 after:z-20 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guide-gold"
            >
              {point.title}
            </Link>
          ) : (
            point.title
          )}
        </h3>
        {point.description ? (
          <p className="line-clamp-2 break-words text-[14px] leading-5 text-on-inverse-muted">
            {point.description}
          </p>
        ) : null}
        {address ? (
          <p className="truncate text-[12px] leading-4 text-on-inverse-muted">{address}</p>
        ) : null}
      </div>
    </CoverFrame>
  );
}

export function RouteStopCardSkeleton() {
  return <Skeleton className="h-guide-walk-m w-full rounded-card lg:h-guide-walk" />;
}

function Title({ href, children }: { href?: string; children: string }) {
  if (!href) return <>{children}</>;
  return (
    <Link
      href={href}
      className="after:absolute after:inset-0 after:z-20 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guide-gold"
    >
      {children}
    </Link>
  );
}

/** Заглушки ровно тех же высот, чтобы страница не прыгала после загрузки. */
export function RubricTileSkeleton() {
  return <Skeleton className="h-guide-rubric-m w-full rounded-card lg:h-guide-rubric" />;
}
export function EditorPickSkeleton() {
  return <Skeleton className="h-guide-pick-m w-full rounded-card lg:h-guide-pick" />;
}
export function WalkCardSkeleton() {
  return <Skeleton className="h-guide-walk-m w-full rounded-card lg:h-guide-walk" />;
}
