"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { GuideCollection, GuideRoute } from "@bookeat/api/client";

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
 * ССЫЛОК НА КАРТОЧКАХ НЕТ. Страниц рубрики, подборки и маршрута на сайте ещё
 * нет (`/guide/<slug>` — 404 Next), и вести гостя в никуда хуже, чем показать
 * карточку без ссылки — тот же приём, что у `GuideCard` на главной за флагом
 * `SHOW_SECTION_LINKS`. Каждая карточка принимает `href`, и когда роуты
 * появятся, заголовок станет растянутой ссылкой без переделки разметки.
 *
 * Ниже `lg` высоты — из мобильного экрана (`guideLayout`): 158 / 214 / 206.
 */

/** `sizes` для картинки в половину контейнера (две в ряд с `lg`). */
const HALF_SIZES = "(min-width: 1280px) 588px, (min-width: 768px) 50vw, 100vw";
/** `sizes` для картинки на всю ширину контейнера. */
const FULL_SIZES = "(min-width: 1280px) 1200px, 100vw";

/** Затемнение снизу вверх, чтобы белый текст читался на любой фотографии. */
const SCRIM = "after:absolute after:inset-0 after:bg-gradient-to-t after:from-black/80 after:via-black/35 after:to-black/5 after:content-['']";

const EYEBROW = "truncate font-semibold uppercase tracking-[0.08em] text-guide-gold";

function CoverFrame({
  src,
  alt,
  sizes,
  className,
  fill,
  children,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  className: string;
  fill?: string;
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
