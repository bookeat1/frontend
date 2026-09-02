"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  WEEKDAY_BY_DAY_OF_WEEK,
  type Amenity,
  type Photo,
  type Restaurant,
  type ScheduleDay,
} from "@bookeat/api/client";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { HeartIcon } from "@web/components/ui/HeartIcon";
import { Modal } from "@web/components/ui/Modal";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { Tag } from "@web/components/ui/Tag";
import { repository } from "@web/lib/api";
import { useAuth } from "@web/lib/auth";
import { useLoginHref } from "@web/lib/favorites";
import { cx } from "@web/lib/cx";
import { priceLabel, scheduleStatus, venueMeta } from "@web/lib/format";
import { useT } from "@web/lib/locale";
import { useFavoriteIds, useToggleFavorite, useVenue } from "@web/lib/queries";

/**
 * Карточка заведения — Figma 3z0f6dgev4HMwBAHPjTjPo, кадр «WEB / 03 · Карточка
 * заведения» (узел 3261:2). Разметка узла дочитана из API макета 31.08.2026;
 * до этого числа снимались с отрисовки кадра, и половина из них не совпадала.
 *
 * ВЕРТИКАЛЬНЫЙ РИТМ СТРАНИЦЫ (из координат узлов, а не на глаз):
 *   хлебные крошки 24 сверху, 16 до мозаики;
 *   мозаика 460, 32 до шапки заведения;
 *   шапка, 32 до двух колонок;
 *   левая колонка: «О заведении», 24, дальше секции через 32;
 *   низ страницы 80 (узел 3262:2, `paddingBottom`).
 *
 * КОЛОНКИ: просвет 32, правая 380 фиксированная, левая тянется — при
 * контейнере 1200 это ровно 788, ширина мозаики и всех секций макета.
 *
 * ЧТО В МАКЕТЕ ЕСТЬ, А ЗДЕСЬ НЕТ И ПОЧЕМУ:
 *   • карточка брони справа (узел 3262:5: дата, гости, сетка времени,
 *     «Забронировать на 19:30») — бронирование в эту задачу не входит, а
 *     кнопка, которая ничего не бронирует, хуже её отсутствия. На её месте —
 *     часы работы, то есть настоящие данные того же заведения, в ТОЙ ЖЕ
 *     оболочке (радиус 20, обводка #DADADA, паддинг 24, тень 0 8 28);
 *   • вкладки «Обзор / Меню / Отзывы / Фото / Контакты» (узел 3263:2) — это
 *     навигация по разделам, которых пока нет; секции идут подряд одной
 *     страницей;
 *   • ссылки «Читать полностью» / «Смотреть все» справа от заголовков секций —
 *     вели бы на несуществующие страницы;
 *   • «500 м от вас» в строке под названием — расстояния сервер не считает;
 *   • город в хлебных крошках («Главная / Алматы / Рестораны / …») — города
 *     заведения в модели нет отдельным звеном навигации, а склонять названия
 *     в коде мы не будем.
 *
 * ЧТО ПОЯВИЛОСЬ: ряд ярлыков-удобств под названием (узел 3261:57) — раньше
 * считалось, что таких данных нет. Они есть: детальный ответ отдаёт
 * `features`, и теперь это `Restaurant.amenities`.
 */
export function VenueScreen({ id }: { id: string }) {
  const t = useT();
  const query = useVenue(id);

  return (
    <SiteChrome active="venues">
      {/* 24 сверху и 80 снизу — паддинги узлов 3261:30 и 3262:2. */}
      <Container className="pb-20 pt-6">
        <nav aria-label={t.web.venue.breadcrumbLabel} className="text-[13px] leading-[18px] text-ink-tertiary">
          <Link href="/" className="hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            {t.web.venue.breadcrumbHome}
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href="/venues" className="hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            {t.web.venue.breadcrumbVenues}
          </Link>
          {query.data ? (
            <>
              <span aria-hidden="true"> / </span>
              <span className="text-ink-secondary">{query.data.name}</span>
            </>
          ) : null}
        </nav>

        <div className="pt-4">
          {isNotFound(query.error) ? (
            <StateMessage title={t.web.venue.notFound.title} text={t.web.venue.notFound.text}>
              <Link
                href="/venues"
                className="text-[16px] font-semibold leading-6 text-brand-text underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {t.web.venue.notFound.back}
              </Link>
            </StateMessage>
          ) : (
            <AsyncBlock
              query={query}
              emptyText={t.web.venue.notFound.text}
              isEmpty={() => false}
              skeleton={
                <div className="flex flex-col gap-8">
                  <Skeleton className="h-[300px] rounded-xl md:h-venue-mosaic" />
                  <Skeleton className="h-12 w-1/3" />
                  <Skeleton className="h-40 w-full" />
                </div>
              }
            >
              {(venue) => <VenueBody venue={venue} />}
            </AsyncBlock>
          )}
        </div>
      </Container>
    </SiteChrome>
  );
}

/** 404 — это ответ сервера «такого заведения нет», а не сбой связи, и экран
 * говорит об этом другими словами. */
function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === 404
  );
}

function VenueBody({ venue }: { venue: Restaurant }) {
  const t = useT();
  const status = scheduleStatus(venue.schedule, t);
  const photos = venue.coverPhoto
    ? [venue.coverPhoto, ...venue.photos.filter((photo) => photo.id !== venue.coverPhoto?.id)]
    : venue.photos;
  const hasPromos = venue.promoBanners.length > 0;
  /** Окно со всеми снимками открывают ДВА элемента — кнопка на мозаике и
   * вкладка «Фото · N», — поэтому его состояние живёт здесь, а не в галерее. */
  const [galleryOpen, setGalleryOpen] = useState(false);

  /** Вкладки собираются из ТОГО, ЧТО НА СТРАНИЦЕ ЕСТЬ: нет акций — нет и
   * вкладки. `useMemo` здесь не украшение: список уходит в зависимость
   * наблюдателя прокрутки, и новый массив на каждый кадр пересоздавал бы его. */
  const tabs = useMemo<SectionTab[]>(() => {
    const all: (SectionTab | null)[] = [
      { id: SECTION_ID.about, label: t.web.venue.tabs.overview },
      venue.menuHighlights.length > 0
        ? { id: SECTION_ID.menu, label: t.web.venue.tabs.menu }
        : null,
      photos.length > 0
        ? {
            id: SECTION_ID.photos,
            label: t.web.venue.tabs.photos(photos.length),
            // Мозаика стоит ВЫШЕ вкладок, и прокрутка к ней уводила бы вверх,
            // за пределы страницы, которую гость читает. Вкладка делает то же,
            // что кнопка «Все фото», — открывает все снимки.
            onSelect: () => setGalleryOpen(true),
          }
        : null,
      hasPromos ? { id: SECTION_ID.promos, label: t.web.venue.tabs.promos } : null,
      { id: SECTION_ID.contacts, label: t.web.venue.tabs.contacts },
    ];
    return all.filter((tab): tab is SectionTab => tab !== null);
  }, [t, venue.menuHighlights.length, photos.length, hasPromos]);

  return (
    <div className="flex flex-col gap-8">
      <Gallery photos={photos} name={venue.name} open={galleryOpen} onOpenChange={setGalleryOpen} />

      <VenueHeader venue={venue} status={status} />

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Левая колонка: вкладки, «О заведении» и дальше 24, потом секции
            через 32 (узлы 3525:14612 и 3525:14639). */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <SectionTabs tabs={tabs} />

          <section id={SECTION_ID.about} className="flex scroll-mt-6 flex-col gap-3">
            <h2 className="text-h3 tracking-[-0.4px] text-ink">{t.web.venue.about.title}</h2>
            <p className="whitespace-pre-line break-words text-[16px] leading-[26px] text-ink-secondary">
              {venue.description.trim() || t.web.venue.about.empty}
            </p>
          </section>

          <div className="flex flex-col gap-8">
            <MenuSection venue={venue} />
            {hasPromos ? <PromoSection venue={venue} /> : null}
            <Contacts venue={venue} />
          </div>
        </div>

        <aside className="w-full lg:w-venue-aside lg:shrink-0">
          {/* Липкая колонка: на длинной странице часы работы должны оставаться
              перед глазами, как карточка брони в макете (узел 3262:4). */}
          <div className="lg:sticky lg:top-6">
            <Hours venue={venue} />
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Подпись вкладки с полосой под ней: одна разметка на ссылку и на кнопку,
 * чтобы они не разошлись видом. */
function TabLabel({ label, current }: { label: string; current: boolean }) {
  return (
    <>
      <span
        className={cx(
          "text-[16px] leading-6",
          current ? "font-semibold text-ink" : "font-medium text-ink-secondary",
        )}
      >
        {label}
      </span>
      <span
        aria-hidden="true"
        className={cx(
          "h-venue-tabs-underline w-full rounded-nav-underline",
          current ? "bg-brand" : "bg-transparent",
        )}
      />
    </>
  );
}

/** Ссылка-якорь или кнопка-действие — снаружи они выглядят одинаково. */
function TabShell({ tab, current }: { tab: SectionTab; current: boolean }) {
  const shell =
    "flex flex-col items-center gap-venue-tabs-label-gap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

  if (tab.onSelect) {
    return (
      <button type="button" onClick={tab.onSelect} className={shell}>
        <TabLabel label={tab.label} current={current} />
      </button>
    );
  }

  return (
    <a href={`#${tab.id}`} aria-current={current ? "true" : undefined} className={shell}>
      <TabLabel label={tab.label} current={current} />
    </a>
  );
}

/**
 * Идентификаторы секций страницы. Одни и те же в разметке секции и в ссылке
 * вкладки: разъехались бы — вкладка молча вела бы в никуда.
 */
const SECTION_ID = {
  about: "venue-about",
  menu: "venue-menu",
  photos: "venue-photos",
  promos: "venue-promos",
  contacts: "venue-contacts",
} as const;

interface SectionTab {
  id: string;
  label: string;
  /** Вкладка не якорь, а действие (так устроено «Фото»): тогда она рисуется
   * кнопкой и в подсветке по прокрутке не участвует — прокручивать нечего. */
  onSelect?: () => void;
}

/**
 * Вкладки страницы — узел 3525:14613: ряд через 32, подпись 16/24 (активная
 * SemiBold основным цветом, остальные Medium вторичным), под подписью полоса 2
 * через 12; у неактивной вкладки полоса прозрачная, поэтому строка не прыгает.
 *
 * ЭТО ССЫЛКИ НА ЯКОРЯ, А НЕ ВКЛАДКИ-ПЕРЕКЛЮЧАТЕЛИ. Разделов «Меню», «Фото» и
 * «Контакты» отдельными страницами у сайта нет, а всё их содержимое уже лежит
 * на этой странице ниже. Поэтому нажатие прокручивает к секции — и работает
 * без JavaScript, средним кликом и с клавиатуры.
 *
 * Вкладки «Отзывы · 312» из макета здесь НЕТ: отзывов на сайте не существует
 * ни секцией, ни страницей, и вкладка вела бы в пустоту.
 *
 * Активная вкладка вычисляется наблюдателем прокрутки. Наблюдателя нет
 * (старый браузер) — активной остаётся первая: это хуже подсветки, но не
 * ломает переходы.
 */
function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const t = useT();
  const [active, setActive] = useState<string | undefined>(tabs[0]?.id);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      // Полоса «сейчас читают»: верхние 30% окна. Без неё активной становилась
      // бы любая секция, краем попавшая в экран, и подсветка дрожала бы.
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );
    for (const tab of tabs) {
      if (tab.onSelect) continue;
      const element = document.getElementById(tab.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [tabs]);

  if (tabs.length < 2) return null;

  return (
    <nav aria-label={t.web.venue.tabs.label}>
      <ul className="flex flex-wrap gap-venue-tabs-gap">
        {tabs.map((tab) => {
          const current = tab.id === active;
          return (
            <li key={tab.id}>
              <TabShell tab={tab} current={current} />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Шапка заведения — узел 3525:14582.
 *
 * Название 40/48 Bold с трекингом −0.8, рядом ярлык статуса через 14; строка
 * свойств 16/24; ряд ярлыков-удобств через 12 от неё, ярлыки через 8.
 * Действия справа — обводочные кнопки 46 высотой (размер `action`).
 */
function VenueHeader({
  venue,
  status,
}: {
  venue: Restaurant;
  status: ReturnType<typeof scheduleStatus>;
}) {
  const t = useT();
  const amenities = venue.amenities ?? [];

  return (
    <header className="flex flex-wrap items-start justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-venue-name-gap">
          <h1 className="text-h1 tracking-[-0.8px] text-ink">{venue.name}</h1>
          {/* Ярлык «Открыто до 23:00» — с точкой только когда заведение
              действительно открыто: у «часы не указаны» точке нечего значить. */}
          <Tag tone={status.tone === "success" ? "success" : "neutral"} dot={status.tone === "success"}>
            {status.label}
          </Tag>
        </div>
        <p className="text-[16px] leading-6 text-ink-secondary">{venueMeta(venue, t)}</p>
        {amenities.length > 0 ? <AmenityRow amenities={amenities} /> : null}
        {venue.reviewsCount > 0 ? (
          <p className="text-bodyM text-ink-tertiary">
            {venue.rating.toFixed(1)}
            {t.web.format.metaSeparator}
            {t.web.venue.reviews(venue.reviewsCount)}
          </p>
        ) : null}
      </div>
      {/* Две кнопки, как в макете (узел 3525:14601), просвет 10. Обе делают
          то, что обещают: «Сохранить» ходит в `PUT/DELETE /favorites/:id`,
          «Поделиться» открывает системное окно или копирует адрес. */}
      <div className="flex items-center gap-2.5">
        <SaveButton id={venue.id} />
        <ShareButton name={venue.name} />
      </div>
    </header>
  );
}

/** Ряд удобств — узел 3261:57: ярлыки через 8, подписи приходят с сервера
 * уже переведёнными, своего словаря у них нет и быть не должно. */
function AmenityRow({ amenities }: { amenities: Amenity[] }) {
  const t = useT();
  return (
    <ul aria-label={t.web.venue.amenitiesLabel} className="flex flex-wrap gap-2">
      {amenities.map((amenity) => (
        <li key={amenity.id}>
          <Tag>{amenity.name}</Tag>
        </li>
      ))}
    </ul>
  );
}

/**
 * Мозаика фотографий — узел 3261:33.
 *
 * ТРИ ЧИСЛА, КОТОРЫХ НЕ БЫЛО РАНЬШЕ:
 *   • деление 788 к 404 при просвете 8, а не «две трети к одной» — разница
 *     двенадцать пикселей, и она видна;
 *   • радиус 20 лежит на КОНТЕЙНЕРЕ, который обрезает содержимое: у самих
 *     фотографий радиуса нет, внутренние углы мозаики прямые. Раньше каждая
 *     плитка скруглялась отдельно, и мозаика читалась как пять карточек;
 *   • «Все фото · N» — БЕЛАЯ кнопка 48 высотой с радиусом 12 и тенью,
 *     прижатая к правому нижнему углу всей мозаики (16/16), а не тёмная
 *     таблетка поверх последней плитки (узел 3261:42).
 *
 * Фотографий может быть меньше четырёх и может не быть вовсе: тогда правая
 * колонка не рисуется, а не оставляет серые дыры.
 *   1 — одна плитка во всю высоту большого снимка;
 *   2 — колонка из двух по 226 (226 + 8 + 226 = 460, ровно в высоту);
 *   3 — 2×2, где третья растянута на обе колонки;
 *   4 — сетка макета.
 */
function Gallery({
  photos,
  name,
  open,
  onOpenChange,
}: {
  photos: Photo[];
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();

  if (photos.length === 0) {
    return <StateMessage text={t.web.venue.gallery.empty} />;
  }

  const [main, ...rest] = photos;
  const grid = rest.slice(0, 4);

  return (
    <section id={SECTION_ID.photos} aria-label={t.web.venue.gallery.label} className="relative scroll-mt-6">
      <div
        className={cx(
          "grid gap-venue-mosaic-gap overflow-hidden rounded-xl md:h-venue-mosaic",
          grid.length > 0 ? "md:grid-cols-mosaic" : "md:grid-cols-1",
        )}
      >
        <div className="relative h-[300px] bg-muted md:h-full">
          <RemoteImage
            src={main.uri}
            alt={main.alt || name}
            sizes="(min-width: 1280px) 788px, 100vw"
            priority
          />
        </div>
        {grid.length > 0 ? (
          <div
            className={cx(
              "grid gap-venue-mosaic-gap",
              grid.length >= 3 ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            {grid.map((photo, index) => (
              <div
                key={photo.id}
                className={cx(
                  "relative bg-muted",
                  grid.length === 1 ? "h-[200px] md:h-full" : "h-[110px] md:h-venue-tile",
                  grid.length === 3 && index === 2 ? "col-span-2" : "",
                )}
              >
                <RemoteImage src={photo.uri} alt={photo.alt || name} sizes="198px" />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Кнопка настоящая: открывает все снимки. Раньше на этом месте стояла
          неинтерактивная плашка, то есть элемент, который выглядит кнопкой и
          ничего не делает. */}
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="absolute bottom-venue-mosaic-inset-b right-venue-mosaic-inset inline-flex h-venue-gallery-btn items-center gap-1.5 rounded-md bg-photo-action px-4 text-[14px] font-semibold leading-5 text-ink shadow-photo-action transition-colors hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <GridIcon />
        {t.web.venue.gallery.count(photos.length)}
      </button>

      {open ? (
        <Modal
          title={t.web.venue.gallery.label}
          onClose={() => onOpenChange(false)}
          // Окно кита узкое (380) — это ширина модалки входа. Для сетки
          // снимков нужна вся полоса контента; `!` здесь обязателен, потому
          // что `max-w-modal` стоит в самом компоненте.
          className="!max-w-[960px]"
        >
          <ul className="grid max-h-[70vh] grid-cols-2 gap-venue-mosaic-gap overflow-y-auto md:grid-cols-3">
            {photos.map((photo) => (
              <li key={photo.id} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                <RemoteImage src={photo.uri} alt={photo.alt || name} sizes="300px" />
              </li>
            ))}
          </ul>
        </Modal>
      ) : null}
    </section>
  );
}

/**
 * «Популярное в меню» — узел 3263:89: просвет секции 20, сетка 16, в строке
 * три карточки по 252 при колонке 788. Карточка (узел 3263:95): радиус 16,
 * картинка 150, тело паддинг 12/16 с просветом 6, цена прижата к низу
 * (16/24 Bold).
 */
function MenuSection({ venue }: { venue: Restaurant }) {
  const t = useT();
  return (
    <section id={SECTION_ID.menu} className="flex scroll-mt-6 flex-col gap-5">
      <h2 className="text-h3 tracking-[-0.4px] text-ink">{t.web.venue.menu.title}</h2>
      {venue.menuHighlights.length === 0 ? (
        <StateMessage text={t.web.venue.menu.empty} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {venue.menuHighlights.slice(0, 6).map((dish) => (
            <li key={dish.id}>
              {/* Не `Card`: у той радиус 24 и тень карточки заведения
                  (узел 3280:5482). Карточка блюда — свой узел 3263:95 с
                  радиусом 16 и той же двойной тенью. */}
              <div className="flex h-full flex-col overflow-hidden rounded-lg bg-canvas shadow-card">
                <div className="relative h-venue-dish-image w-full bg-muted">
                  <RemoteImage
                    src={dish.photo?.uri}
                    alt={dish.name}
                    sizes="(min-width: 1280px) 252px, 33vw"
                  />
                </div>
                {/* Тело карточки: название с описанием сверху, цена прижата к
                    низу (`justify-between`, узел 3525:14648), а не отодвинута
                    произвольным отступом. */}
                <div className="flex flex-1 flex-col justify-between gap-4 px-venue-dish-x py-venue-dish-y">
                  <div className="flex flex-col gap-1.5">
                    <p className="break-words text-[15px] font-semibold leading-[22px] text-ink">
                      {dish.name}
                    </p>
                    {dish.description ? (
                      <p className="line-clamp-2 break-words text-[13px] leading-[18px] text-ink-tertiary">
                        {dish.description}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-[16px] font-bold leading-6 text-ink">
                    {dish.price || t.web.venue.menu.noPrice}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * «Акции заведения» — узел 3264:2, карточка 3379:11497: 262 высотой, радиус
 * 18, паддинг 20, фотография с вертикальным затемнением, заголовок 22/30 Bold
 * прижат к низу.
 *
 * ЧЕГО НЕТ В ДАННЫХ: бейдж «−25%» и вторая строка «Flour Demi · будни до
 * 18:00». `GET /restaurants/:id/promos` отдаёт заголовок и всё; поля скидки и
 * условий у сущности акции нет вовсе (`PromoBanner` в `@bookeat/api`).
 * Фотография у настоящей акции тоже отсутствует — тогда вместо снимка
 * фирменная заливка, и затемнение поверх неё не рисуется, чтобы белый текст
 * не темнел дважды.
 */
function PromoSection({ venue }: { venue: Restaurant }) {
  const t = useT();
  return (
    <section id={SECTION_ID.promos} className="flex scroll-mt-6 flex-col gap-5">
      <h2 className="text-h3 tracking-[-0.4px] text-ink">{t.web.venue.promos.title}</h2>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {venue.promoBanners.map((promo) => (
          <li
            key={promo.id}
            className={cx(
              "relative flex min-h-venue-promo items-end overflow-hidden rounded-promo p-venue-promo-p",
              promo.photo?.uri ? "bg-muted" : "bg-brand",
            )}
          >
            {promo.photo?.uri ? (
              <>
                <RemoteImage src={promo.photo.uri} alt="" sizes="(min-width: 1280px) 384px, 50vw" />
                <span aria-hidden="true" className="absolute inset-0 bg-promo-scrim" />
              </>
            ) : null}
            <p className="relative break-words text-[22px] font-bold leading-[30px] tracking-[-0.3px] text-ink-on-brand">
              {promo.title}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * «Контакты и как добраться» — узел 3264:66: просвет 20, карта 788×280 с
 * радиусом 16 (пропорция, а не высота — колонка уже 788 не на всех
 * брейкпоинтах), под ней три плашки через 16.
 */
function Contacts({ venue }: { venue: Restaurant }) {
  const t = useT();
  const mapUrl =
    venue.latitude !== undefined && venue.longitude !== undefined
      ? repository.getMapPreviewUrl(venue.id, { size: "detail" })
      : undefined;
  const links = [
    venue.social?.website
      ? { key: "website", label: venue.social.website, href: venue.social.website }
      : null,
    venue.social?.instagram
      ? { key: "instagram", label: venue.social.instagram, href: venue.social.instagram }
      : null,
    venue.social?.whatsapp
      ? { key: "whatsapp", label: venue.social.whatsapp, href: venue.social.whatsapp }
      : null,
  ].filter((item): item is { key: string; label: string; href: string } => item !== null);

  const hasAnything = venue.address.trim() || venue.phone || links.length > 0;

  return (
    <section id={SECTION_ID.contacts} className="flex scroll-mt-6 flex-col gap-5">
      <h2 className="text-h3 tracking-[-0.4px] text-ink">{t.web.venue.contacts.title}</h2>

      {mapUrl ? (
        <div className="relative h-venue-map w-full overflow-hidden rounded-lg bg-muted">
          <RemoteImage
            src={mapUrl}
            alt={t.web.venue.contacts.mapAlt(venue.name)}
            sizes="788px"
            // Координаты есть, а карта не пришла — это НЕ то же самое, что
            // «координат нет». На тестовом стенде провайдер карт не настроен
            // (`map_not_configured`, 503), и без подписи здесь оставался
            // серый прямоугольник 788×280.
            fallback={
              <span className="text-bodyM text-ink-tertiary">
                {t.web.venue.contacts.mapUnavailable}
              </span>
            }
          />
        </div>
      ) : (
        <p className="text-bodyM text-ink-tertiary">{t.web.venue.contacts.noMap}</p>
      )}

      {hasAnything ? (
        // Три плашки со значком слева — узел 3264:73. Значок несёт
        // `aria-hidden`: смысл уже сказан подписью строки.
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {venue.address.trim() ? (
            <ContactCard icon={<PinIcon />} title={venue.address} note={venue.addressNote} />
          ) : null}
          {venue.phone ? (
            <ContactCard
              icon={<PhoneIcon />}
              title={venue.phone}
              href={`tel:${venue.phone.replace(/[^\d+]/g, "")}`}
              note={t.web.venue.contacts.phone}
            />
          ) : null}
          {links.length > 0 ? (
            <ContactCard
              icon={<LinkIcon />}
              title={links[0].label}
              href={links[0].href}
              external
              note={t.web.venue.contacts.social}
            />
          ) : null}
        </ul>
      ) : (
        <p className="text-bodyM text-ink-tertiary">{t.web.venue.contacts.empty}</p>
      )}
    </section>
  );
}

/**
 * Плашка контакта — узел 3264:74: 72 высотой, радиус 14, паддинг 16/18,
 * просвет 14, белый кружок значка 40, строка 14/20 SemiBold и подпись 12/16.
 */
function ContactCard({
  icon,
  title,
  note,
  href,
  external = false,
}: {
  icon: ReactNode;
  title: string;
  note?: string;
  href?: string;
  external?: boolean;
}) {
  const body = (
    <>
      <span
        aria-hidden="true"
        className="flex h-venue-contact-icon w-venue-contact-icon shrink-0 items-center justify-center rounded-full bg-canvas text-ink-secondary"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="break-words text-[14px] font-semibold leading-5 text-ink">{title}</span>
        {note ? (
          <span className="break-words text-[12px] leading-4 text-ink-tertiary">{note}</span>
        ) : null}
      </span>
    </>
  );

  const inner = "flex items-center gap-venue-contact-gap px-venue-contact-x py-4";

  return (
    <li className="rounded-field bg-subtle">
      {href ? (
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer nofollow" } : {})}
          className={cx(
            inner,
            "rounded-field focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          )}
        >
          {body}
        </a>
      ) : (
        <span className={inner}>{body}</span>
      )}
    </li>
  );
}

/**
 * «Поделиться» (узел 3261:72). Делает ровно то, что обещает: системное окно
 * там, где оно есть (`navigator.share` — мобильные браузеры и Safari), иначе
 * копирование адреса в буфер с подтверждением. Молчаливой кнопки нет: если
 * не сработало ни то, ни другое, ничего не показываем как «скопировано».
 */
function ShareButton({ name }: { name: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch {
        // Гость закрыл системное окно — это не ошибка и не повод копировать.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер недоступен (не-https, запрет политикой). Обещать «скопировано»
      // в этом случае нельзя.
    }
  }

  return (
    <>
      {copied ? (
        <span role="status" className="text-[13px] leading-[18px] text-ink-secondary">
          {t.web.venue.shareCopied}
        </span>
      ) : null}
      <Button size="action" variant="secondary" onClick={() => void share()}>
        <ShareIcon />
        {t.web.venue.share}
      </Button>
    </>
  );
}

/**
 * «Сохранить» (узел 3525:14602). Раньше кнопки здесь не было вовсе: считалось,
 * что избранного у сайта нет. Оно есть — `GET /favorites`, `PUT /favorites/:id`
 * и `DELETE /favorites/:id`, те же ручки, что у приложения.
 *
 * ЧЕТЫРЕ СОСТОЯНИЯ, а не два:
 *   • гость не вошёл — кнопка ведёт на вход, а не притворяется работающей;
 *   • список избранного ещё едет — подпись «Сохранить», а не мигание;
 *   • полёт запроса — кнопка заблокирована, повторное нажатие безвредно
 *     (ручки идемпотентные);
 *   • отказ сервера — состояние откатывается и появляется текст ошибки, а не
 *     ложное «сохранено».
 */
function SaveButton({ id }: { id: string }) {
  const t = useT();
  const { signedIn } = useAuth();
  const favorites = useFavoriteIds();
  const toggle = useToggleFavorite();
  const loginTarget = useLoginHref();
  const saved = favorites.data?.has(id) ?? false;

  if (!signedIn) {
    // Ссылка ПОМНИТ, откуда гость ушёл: без этого он вводит код и попадает на
    // главную, а заведение, ради которого всё затевалось, остаётся позади.
    return (
      <Button size="action" variant="secondary" asLink href={loginTarget}>
        <HeartIcon filled={false} size={24} />
        {t.web.venue.save}
      </Button>
    );
  }

  return (
    <>
      {toggle.isError ? (
        <span role="alert" className="text-[13px] leading-[18px] text-danger">
          {t.web.venue.saveFailed}
        </span>
      ) : null}
      <Button
        size="action"
        variant="secondary"
        aria-pressed={saved}
        loading={toggle.isPending}
        onClick={() => toggle.mutate({ id, next: !saved })}
      >
        <HeartIcon filled={saved} size={24} />
        {saved ? t.web.venue.saved : t.web.venue.save}
      </Button>
    </>
  );
}

/** Значок сетки на кнопке «Все фото» (узел 3367:11311) — четыре квадрата. */
function GridIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path
        d="M5 4h3.2l1.4 3.5-2 1.3a12 12 0 0 0 5.6 5.6l1.3-2L18 13.8V17a2 2 0 0 1-2.2 2A14.5 14.5 0 0 1 5 6.2 2 2 0 0 1 7 4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2" strokeLinecap="round" />
      <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2" strokeLinecap="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Часы работы. Стоит на месте карточки брони (узел 3262:5) и носит ЕЁ
 * оболочку: радиус 20, обводка #DADADA, паддинг 24, просвет 24, тень
 * 0 8 28 rgba(0,0,0,.08), заголовок 21/28 Bold с трекингом −0.2.
 *
 * Показываем СТРУКТУРНЫЙ график, когда он есть; иначе — то, что заведение
 * написало о себе само (`opening_hours`), подписанное как его собственные
 * слова. Разбирать эту строку на часы нельзя — на этом уже стоял баг в
 * мобильном приложении.
 */
function Hours({ venue }: { venue: Restaurant }) {
  const t = useT();
  const days = venue.schedule?.days ?? [];

  return (
    // Оболочка карточки брони (узел 3262:5), а не `Card` кита: радиус 20
    // против 24 и своя тень.
    <div className="flex flex-col gap-6 overflow-hidden rounded-xl border border-line bg-canvas p-6 shadow-aside">
      <h2 className="text-[21px] font-bold leading-7 tracking-[-0.2px] text-ink">
        {t.web.venue.hours.title}
      </h2>
      {days.length > 0 ? (
        <dl className="flex flex-col gap-2">
          {days.map((day) => (
            <div key={day.dayOfWeek} className="flex items-baseline justify-between gap-4">
              <dt className="text-[14px] leading-5 text-ink-secondary">
                {t.weekdays[WEEKDAY_BY_DAY_OF_WEEK[day.dayOfWeek]]}
              </dt>
              <dd className="text-right text-[14px] font-medium leading-5 text-ink">
                {dayHours(day, t)}
              </dd>
            </div>
          ))}
        </dl>
      ) : venue.openingHoursText.trim() ? (
        <p className="whitespace-pre-line text-bodyM text-ink-secondary">
          {venue.openingHoursText}
        </p>
      ) : (
        <p className="text-bodyM text-ink-tertiary">{t.web.venue.hours.unknown}</p>
      )}
      {venue.priceRange ? (
        <p className="text-bodyM text-ink-secondary">
          {priceLabel(venue.priceLevel, venue.priceRange, t)}
        </p>
      ) : null}
    </div>
  );
}

function dayHours(day: ScheduleDay, t: ReturnType<typeof useT>): string {
  if (!day.isOpen) return t.web.venue.hours.dayOff;
  if (!day.opensAt || !day.closesAt) return t.web.venue.hours.unknown;
  return day.closesNextDay
    ? t.web.venue.hours.untilNextDay(day.opensAt, day.closesAt)
    : t.web.venue.hours.range(day.opensAt, day.closesAt);
}
