"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MenuDish, MenuSection, Restaurant } from "@bookeat/api/client";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { BookingCard } from "@web/components/venue/BookingCard";
import { Chip } from "@web/components/ui/Chip";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { isNotFound } from "@web/lib/not-found";
import { formatMoneyMinor } from "@web/lib/format";
import { filterMenuSections } from "@web/lib/menu-search";
import { useMenuSections, useVenue } from "@web/lib/queries";
import { useT } from "@web/lib/locale";

/**
 * Отдельная страница «Меню {заведение}» — Figma qmMsg4jO1ggmyEHNIAD2ll, узел
 * 5115:7448. Раньше меню заведения было видно ТОЛЬКО как «Популярное в меню»
 * на самой странице заведения (максимум шесть карточек, `VenueScreen.tsx` →
 * `MenuSection`) — у заведения с полным меню в полсотни блюд остальное было
 * недостижимо ровно так же, как в приложении до `restaurant/[id]/menu.tsx`
 * (см. комментарий в том файле).
 *
 * Данные — `GET /restaurants/:id/menu`, тот же `MenuSection[]`, что и в
 * приложении (`useMenuSections`, `packages/api`); поиск и разбор по категориям
 * — ЛОКАЛЬНЫЕ (меню целиком уже в руках), тем же правилом, что мобильный
 * `apps/mobile/src/lib/menu-search.ts`.
 *
 * ЧЕГО В МАКЕТЕ ЕСТЬ, А ЗДЕСЬ НЕТ, И ПОЧЕМУ:
 *   • степпера «+» на карточке — на этой странице карточки только показывают
 *     блюдо (фото/название/описание/цена), без предзаказа; степпер остаётся
 *     только у «Популярное в меню» на самой странице заведения;
 *   • города в хлебных крошках («… / Алматы / …») — хлебные крошки здесь ЗЕРКАЛЯТ
 *     `VenueScreen.tsx` ровно затем, чтобы у сайта не было двух разных
 *     раскладок крошек одновременно. `Restaurant.city` У ЗАВЕДЕНИЯ УЖЕ ЕСТЬ
 *     (`packages/api/src/types.ts`) — старый комментарий у `VenueScreen.tsx`
 *     про «города в модели нет» устарел. Команда уже занимается разбором
 *     крошек под макет (заметка `bookeat-web.md` от 2026-09-07, «venue
 *     breadcrumb figma fix») — эта страница намеренно НЕ трогает крошки
 *     первой, чтобы не разъехаться с той правкой.
 *
 * Точные пиксельные числа узла 5115:7448 (радиусы, паддинги) НЕ сверены через
 * Figma REST — `/v1/files`, `/v1/images` и MCP по этому файлу 2026-09-07
 * отвечали 429 весь заход (см. `bookeat-mobile-figma-access.md`). Карточка
 * блюда и сетка переиспользуют уже сверенные токены `webVenuePage.dishCard` —
 * тот же узор, что у «Популярное в меню» на странице заведения, а не числа на
 * глаз по PNG-скриншоту.
 */
export function VenueMenuScreen({ id }: { id: string }) {
  const t = useT();
  const venueQuery = useVenue(id);

  return (
    <SiteChrome active="venues">
      <Container className="pb-bottom-bar-clearance pt-6 lg:pb-20">
        <nav
          aria-label={t.web.venue.breadcrumbLabel}
          className="text-[13px] leading-[18px] text-ink-tertiary"
        >
          <Link
            href="/"
            className="hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {t.web.venue.breadcrumbHome}
          </Link>
          <span aria-hidden="true"> / </span>
          <Link
            href="/venues"
            className="hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {t.web.venue.breadcrumbVenues}
          </Link>
          {venueQuery.data ? (
            <>
              <span aria-hidden="true"> / </span>
              <Link
                href={`/venues/${id}`}
                className="hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {venueQuery.data.name}
              </Link>
              <span aria-hidden="true"> / </span>
              <span className="text-ink-secondary">{t.web.venue.menuPage.breadcrumb}</span>
            </>
          ) : null}
        </nav>

        <div className="pt-4">
          {isNotFound(venueQuery.error) ? (
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
              query={venueQuery}
              emptyText={t.web.venue.notFound.text}
              isEmpty={() => false}
              skeleton={
                <div className="flex flex-col gap-8">
                  <Skeleton className="h-12 w-1/3" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              }
            >
              {(venue) => <MenuPageBody venue={venue} />}
            </AsyncBlock>
          )}
        </div>
      </Container>
    </SiteChrome>
  );
}

function MenuPageBody({ venue }: { venue: Restaurant }) {
  const t = useT();
  const menuQuery = useMenuSections(venue.id);

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <h1 className="text-h1 tracking-[-0.8px] text-ink">{t.web.venue.menuPage.title(venue.name)}</h1>

        <AsyncBlock
          query={menuQuery}
          emptyText={t.web.venue.menu.empty}
          isEmpty={(sections) => sections.length === 0}
          skeleton={
            <div className="flex flex-col gap-6">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-9 w-2/3" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-venue-dish-image w-full" />
                ))}
              </div>
            </div>
          }
        >
          {(sections) => <MenuBrowser sections={sections} />}
        </AsyncBlock>
      </div>

      <aside className="hidden lg:block lg:w-venue-aside lg:shrink-0">
        <div className="lg:sticky lg:top-6">
          <BookingCard venue={venue} />
        </div>
      </aside>
    </div>
  );
}

/**
 * Поиск + чипы категорий + сетка блюд. Отбор ДВУХСТУПЕНЧАТЫЙ: чип категории
 * сужает список разделов, поиск — сужает блюда внутри уже выбранных разделов.
 * Список самих чипов строится по ПОЛНОМУ меню (`sections`, не по результату
 * поиска) — иначе набор чипов прыгал бы при каждой напечатанной букве.
 */
function MenuBrowser({ sections }: { sections: MenuSection[] }) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const searched = useMemo(() => filterMenuSections(sections, search), [sections, search]);
  const visibleSections = activeCategory
    ? searched.filter((section) => section.title === activeCategory)
    : searched;
  const dishes = useMemo(
    () => visibleSections.flatMap((section) => section.dishes),
    [visibleSections],
  );

  return (
    <div className="flex flex-col gap-5">
      <label className="flex h-12 items-center gap-3 rounded-lg bg-subtle px-4">
        <span className="sr-only">{t.web.venue.menuPage.searchLabel}</span>
        <SearchIcon />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.web.venue.menuPage.searchPlaceholder}
          className="w-full min-w-0 bg-transparent text-[16px] leading-6 text-ink outline-none placeholder:text-ink-tertiary"
        />
      </label>

      {sections.length > 1 ? (
        <ul
          aria-label={t.web.venue.menuPage.categoriesLabel}
          className="flex flex-wrap gap-2"
        >
          <li>
            <Chip
              state={activeCategory === null ? "selected" : "default"}
              onClick={() => setActiveCategory(null)}
            >
              {t.web.venue.menuPage.allCategory}
            </Chip>
          </li>
          {sections.map((section) => (
            <li key={section.title}>
              <Chip
                state={activeCategory === section.title ? "selected" : "default"}
                onClick={() =>
                  setActiveCategory((current) => (current === section.title ? null : section.title))
                }
              >
                {section.title}
              </Chip>
            </li>
          ))}
        </ul>
      ) : null}

      {dishes.length === 0 ? (
        <StateMessage
          title={t.web.venue.menuPage.searchEmptyTitle}
          text={t.web.venue.menuPage.searchEmptyDescription}
        />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dishes.map((dish) => (
              <li key={dish.id}>
                <DishCard dish={dish} />
              </li>
            ))}
          </ul>
          <p className="text-[13px] leading-[18px] text-ink-tertiary">
            {t.web.venue.menuPage.footerNote}
          </p>
        </>
      )}
    </div>
  );
}

/** Карточка блюда — тот же узор, что «Популярное в меню» на странице
 * заведения (`VenueScreen.tsx` → `MenuSection`), без степпера предзаказа: в
 * макете этой страницы (5115:7448) карточка только показывает блюдо. */
function DishCard({ dish }: { dish: MenuDish }) {
  const t = useT();
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-canvas shadow-card">
      <div className="relative h-venue-dish-image w-full bg-muted">
        <RemoteImage src={dish.imageUrl} alt={dish.name} sizes="(min-width: 1280px) 252px, 33vw" />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 px-venue-dish-x py-venue-dish-y">
        <div className="flex flex-col gap-1.5">
          <p className="break-words text-[15px] font-semibold leading-[22px] text-ink">{dish.name}</p>
          {dish.description ? (
            <p className="line-clamp-2 break-words text-[13px] leading-[18px] text-ink-tertiary">
              {dish.description}
            </p>
          ) : null}
        </div>
        <p className="break-words text-[16px] font-bold leading-6 text-ink">
          {dish.priceMinor === null ? t.web.venue.menu.noPrice : formatMoneyMinor(dish.priceMinor)}
        </p>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="shrink-0 text-ink-tertiary"
    >
      <circle cx="9" cy="9" r="6" />
      <path d="M17 17l-3.8-3.8" strokeLinecap="round" />
    </svg>
  );
}
