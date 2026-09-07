"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import type { MenuDish, RestaurantSummary } from "@bookeat/api/client";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Modal } from "@web/components/ui/Modal";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { formatMoneyMinor } from "@web/lib/format";
import { cx } from "@web/lib/cx";
import { useT } from "@web/lib/locale";
import {
  OCEAN_BASKET_INSTAGRAM,
  OCEAN_SIGNATURE_DISHES,
  oceanAssets,
  oceanChapterPhotos,
  oceanPointName,
  spacedOut,
} from "./ocean-basket-content";
import { useOceanBasketVenues } from "./use-ocean-basket-venues";
import { useOceanSignatureDishes, type OceanSignatureDishesState } from "./use-ocean-signature-dishes";

/**
 * Фирменная страница Ocean Basket на сайте — `/brand/ocean-basket`, Figma
 * `qmMsg4jO1ggmyEHNIAD2ll`, кадр «WEB / 14 · Ocean Basket» (узел 5115:9771).
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ЭКРАН, А НЕ ПРАВКА `ArticleScreen`. Тот экран рисует ЛЮБУЮ
 * подборку/статью гастрогида ровно тем, что отдаёт `GET /gastroguide/collections/:slug`
 * (заголовок, описание, обложка, заведения). Три четверти этой страницы —
 * фирменное содержимое одного бренда (шапка, блюда с ценами, история главами,
 * блок инстаграма), которого в ответе ручки нет и не будет, пока не сделан
 * `gastroguide_page_sections` (спека `bookeat-gastroguide-brand-pages.md`,
 * раздел 5.1 — реализация повисла на владельце). Мобильный аналог
 * (`apps/mobile/src/components/ocean/OceanBasketScreen.tsx`, PR #105, решение
 * владельца 2026-09-01) собран так же: свой маршрут, содержимое зашито,
 * живые — только точки бренда и «Фирменный улов» из настоящего меню.
 *
 * СВЕРКА С МАКЕТОМ НЕ ЗАВЕРШЕНА. Узел 5115:9771 новый (появился после
 * прежних кадров «WEB / 01…08», которых касались другие спеки в
 * `design-specs/web/`), и REST Figma по нему отвечал 429 весь заход
 * (`retry-after: 6951`, план `starter`, лимит `low`) — ни `/nodes`, ни
 * `/files/:key?ids=`, ни `/images` для ЭТОГО файла не открылись. Обещанный
 * скриншот кадра лежит не там, где указано в задаче, а в `~/.figma-refs/`
 * (1440×3249) — вёрстка построена по нему (сравнение глазами, другого пути не
 * было), точные отступы/радиусы/кегли НЕ сверены с числами узла. Цвета —
 * `webOceanBasketPage` (`packages/design-tokens/src/web.ts`), перенесены с
 * мобильного `colors.brand2` того же бренда, а не с этого узла.
 *
 * ЖИВОЕ НА СТРАНИЦЕ: карточки точек (`GET /restaurants/search?q=Ocean Basket`,
 * см. `useOceanBasketVenues`) и «Фирменный улов» — название и цена из меню
 * первой точки (`useOceanSignatureDishes`). Остальное — вёрстка и общий
 * словарь `t.oceanBasket`.
 */
export function OceanBasketScreen() {
  const t = useT();
  const venuesQuery = useOceanBasketVenues();
  const dishes = useOceanSignatureDishes(venuesQuery);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const pointsRef = useRef<HTMLDivElement>(null);

  // «Забронировать» / «Выбрать ресторан» прокручивают к списку точек —
  // бронировать за гостя одну из трёх точек страница не вправе (то же
  // решение, что на мобильном экране).
  const scrollToPoints = () => {
    pointsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const heroPhoto = venuesQuery.data?.[0]?.coverPhoto?.uri;

  return (
    <SiteChrome>
      <OceanHero
        heroPhoto={heroPhoto}
        onBook={scrollToPoints}
        onWelcomeDrink={() => setWelcomeOpen(true)}
      />

      <div className="bg-ocean-sheet">
        <Container className="flex flex-col gap-12 py-10 lg:gap-16 lg:py-16">
          <div ref={pointsRef} className="scroll-mt-6">
            <OceanMapAndPoints query={venuesQuery} />
          </div>

          <OceanDishesSection state={dishes.state} />

          <OceanStorySection />

          <OceanSign />

          <OceanInstagramCard />
        </Container>
      </div>

      <OceanClosingCta onBook={scrollToPoints} />

      {welcomeOpen ? <OceanWelcomeModal onClose={() => setWelcomeOpen(false)} /> : null}
    </SiteChrome>
  );
}

/* ------------------------------------------------------------------------ *
 * Шапка
 * ------------------------------------------------------------------------ */

function OceanHero({
  heroPhoto,
  onBook,
  onWelcomeDrink,
}: {
  heroPhoto: string | undefined;
  onBook: () => void;
  onWelcomeDrink: () => void;
}) {
  const t = useT();
  return (
    <section
      className="relative overflow-hidden bg-ocean-navy"
      style={{
        backgroundImage: `linear-gradient(115deg, ${webOceanGradient.join(", ")})`,
      }}
    >
      <Container className="relative grid grid-cols-1 items-center gap-8 py-12 lg:grid-cols-2 lg:gap-12 lg:py-20">
        <div className="flex flex-col gap-6">
          <p className="inline-flex w-fit items-center gap-2 text-[14px] font-semibold uppercase leading-5 tracking-[0.08em] text-ocean-gold">
            <AnchorIcon size={16} />
            {t.oceanBasket.webHeroEyebrow}
          </p>
          <h1 className="break-words font-serif text-[44px] italic leading-[1.08] lg:text-[64px]">
            <span className="block text-ocean-on-navy">Seafood</span>
            <span className="block text-ocean-gold">Expedition</span>
          </h1>
          <p className="max-w-[420px] break-words text-[18px] leading-6 text-ocean-on-navy">
            {t.oceanBasket.webHeroSubtitle}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onBook}
              className="inline-flex h-12 items-center rounded-full bg-ocean-gold px-6 text-[15px] font-semibold leading-5 text-ocean-navy transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-gold"
            >
              {t.oceanBasket.webHeroCta}
            </button>
          </div>
          <button
            type="button"
            onClick={onWelcomeDrink}
            aria-label={t.oceanBasket.welcomeDrinkA11y}
            className="inline-flex h-12 w-fit items-center gap-2 rounded-full border border-ocean-accent-border bg-ocean-welcome-surface pl-2 pr-4 text-[13px] font-semibold leading-4 text-ocean-gold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-gold"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ocean-gold text-ocean-navy">
              <GiftIcon size={14} />
            </span>
            <span className="uppercase tracking-[0.04em]">{t.oceanBasket.welcomeDrink}</span>
            <span aria-hidden="true" className="h-4 w-px bg-ocean-welcome-divider" />
            <span className="font-medium normal-case text-ocean-on-navy">
              {t.oceanBasket.welcomeDrinkAction}
            </span>
            <ChevronIcon direction="right" size={12} />
          </button>
        </div>

        <div className="relative h-[240px] overflow-hidden rounded-2xl bg-ocean-navy-deep lg:h-[340px]">
          <RemoteImage
            src={heroPhoto}
            alt=""
            sizes="(min-width: 1024px) 560px, 100vw"
            priority
          />
        </div>
      </Container>
    </section>
  );
}

/** Три точки градиента шапки — те же, что у мобильной версии того же бренда. */
const webOceanGradient = ["#05182D", "#052747 56%", "#033C61"];

/* ------------------------------------------------------------------------ *
 * «Найдите свой улов» — карта и список точек
 * ------------------------------------------------------------------------ */

function OceanMapAndPoints({ query }: { query: ReturnType<typeof useOceanBasketVenues> }) {
  const t = useT();
  const venues = query.data ?? [];
  const city = venues[0]?.city || t.explore.cityFallback;

  return (
    <section className="flex flex-col gap-6">
      <h2 className="font-serif text-[28px] italic leading-8 text-ocean-navy lg:text-[34px]">
        {t.oceanBasket.mapTitle}
      </h2>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-ocean-card-border shadow-[0_14px_28px_-8px_rgba(5,39,71,0.25)] lg:aspect-square">
          <Image
            src={oceanAssets.map}
            alt={t.oceanBasket.mapAlt}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
            unoptimized
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-[20px] font-bold leading-6 text-ocean-navy">
              {t.oceanBasket.webPointsTitle}
            </h3>
            {venues.length > 0 ? (
              <p className="text-[14px] leading-5 text-ocean-muted">
                {t.oceanBasket.webPointsSubtitle(city, venues.length)}
              </p>
            ) : null}
          </div>

          {/* Свои четыре состояния, а не общий `AsyncBlock`: у мобильного
              экрана этот блок — «единственный, кто ходит в сеть», и у него
              своя формулировка на каждое состояние (`t.oceanBasket.points*`),
              а не общее «Не удалось загрузить». Веб держит ту же формулу. */}
          {query.isPending ? (
            <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-3">
              <span className="sr-only">{t.oceanBasket.pointsLoading}</span>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : query.isError ? (
            <StateMessage title={t.oceanBasket.pointsErrorTitle} text={t.oceanBasket.pointsErrorDescription} tone="danger">
              <button
                type="button"
                onClick={() => query.refetch()}
                className="text-[14px] font-semibold text-ocean-gold-muted underline underline-offset-4"
              >
                {t.common.retry}
              </button>
            </StateMessage>
          ) : venues.length === 0 ? (
            <StateMessage title={t.oceanBasket.pointsEmptyTitle} text={t.oceanBasket.pointsEmptyDescription} />
          ) : (
            <ul className="flex flex-col gap-3">
              {venues.map((venue, index) => (
                <li key={venue.id}>
                  <OceanPointRow venue={venue} index={index} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function OceanPointRow({ venue, index }: { venue: RestaurantSummary; index: number }) {
  const t = useT();
  return (
    <Link
      href={`/venues/${encodeURIComponent(venue.id)}`}
      className="flex items-center justify-between gap-4 rounded-xl bg-canvas px-5 py-4 shadow-card transition-colors hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-gold"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="text-[13px] font-bold leading-4 text-ocean-gold-muted">
          {t.oceanBasket.pointNumber(index)}
        </span>
        <span className="truncate text-[16px] font-semibold leading-6 text-ocean-navy">
          {oceanPointName(venue.name)}
        </span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-ocean-navy">
        <ChevronIcon direction="right" size={16} />
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------------ *
 * «Фирменный улов»
 * ------------------------------------------------------------------------ */

function OceanDishesSection({ state }: { state: OceanSignatureDishesState }) {
  const t = useT();
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-[26px] font-bold leading-8 text-ocean-navy">{t.oceanBasket.dishesTitle}</h2>
        <p className="text-[15px] leading-5 text-ocean-muted">{t.oceanBasket.webDishesSubtitle}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {OCEAN_SIGNATURE_DISHES.map((signature, index) => (
          <OceanDishCard key={signature.menuName} photo={signature.photo} state={state} index={index} />
        ))}
      </div>
    </section>
  );
}

function OceanDishCard({
  photo,
  state,
  index,
}: {
  photo: string;
  state: OceanSignatureDishesState;
  index: number;
}) {
  const t = useT();
  const dish: MenuDish | undefined = state.status === "ready" ? state.dishes[index] : undefined;

  const picture = (
    <div className="relative h-[220px] w-full bg-ocean-navy-deep">
      <Image src={photo} alt="" fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" unoptimized />
    </div>
  );

  let caption: ReactNode;
  if (state.status === "loading") {
    caption = <p className="text-[14px] leading-5 text-ocean-muted">{t.oceanBasket.dishesLoading}</p>;
  } else if (state.status === "error") {
    caption = (
      <button type="button" onClick={state.retry} className="text-left">
        <p className="text-[14px] leading-5 text-ocean-muted">{t.oceanBasket.dishesError}</p>
        <p className="text-[14px] font-semibold leading-5 text-ocean-gold-muted">{t.common.retry}</p>
      </button>
    );
  } else if (!dish) {
    caption = <p className="text-[14px] leading-5 text-ocean-muted">{t.oceanBasket.dishMissing}</p>;
  } else {
    const price = dish.priceMinor === null ? t.restaurant.menuDishNoPrice : formatMoneyMinor(dish.priceMinor);
    caption = (
      <div className="flex flex-col gap-1">
        <p className="break-words text-[18px] font-bold leading-6 text-ocean-navy">{dish.name}</p>
        <p className="text-[15px] leading-5 text-ocean-muted">{price}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-canvas shadow-card">
      {picture}
      <div className="flex flex-col gap-1 px-5 py-4">{caption}</div>
    </div>
  );
}

/* ------------------------------------------------------------------------ *
 * «История бренда» — гармошка, раскрыта не больше одной главы
 * ------------------------------------------------------------------------ */

function OceanStorySection() {
  const t = useT();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  return (
    <section className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <p
          className="text-[13px] font-semibold uppercase leading-4 tracking-[0.08em] text-ocean-gold-muted"
          aria-label={t.oceanBasket.storyEyebrow}
        >
          {`—  ${spacedOut(t.oceanBasket.storyEyebrow)}  —`}
        </p>
        <h2 className="break-words text-[28px] font-bold leading-9 lg:text-[32px]">
          <span className="text-ocean-navy">{t.oceanBasket.storyTitleLead} </span>
          <span className="text-ocean-gold-muted">{t.oceanBasket.storyTitleTail}</span>
        </h2>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
        {t.oceanBasket.chapters.map((chapter, index) => (
          <OceanStoryChapter
            key={chapter.label}
            label={chapter.label}
            title={chapter.title}
            body={chapter.body}
            photo={oceanChapterPhotos[index]}
            expanded={expandedIndex === index}
            onToggle={() => setExpandedIndex((current) => (current === index ? null : index))}
          />
        ))}
      </div>
    </section>
  );
}

function OceanStoryChapter({
  label,
  title,
  body,
  photo,
  expanded,
  onToggle,
}: {
  label: string;
  title: string;
  body: string;
  photo?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <div className="overflow-hidden rounded-2xl border border-ocean-card-border bg-canvas">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? t.oceanBasket.chapterCollapse(title) : t.oceanBasket.chapterExpand(title)}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-gold"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ocean-gold-ring">
            <AnchorIcon size={16} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[12px] font-semibold uppercase leading-4 tracking-[0.04em] text-ocean-gold-muted">
              {label}
            </span>
            <span className="truncate text-[16px] font-bold leading-6 text-ocean-navy">{title}</span>
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-ocean-gold-chevron">
          <ChevronIcon direction={expanded ? "up" : "down"} size={14} />
        </span>
      </button>

      {expanded ? (
        <div className="flex flex-col">
          {photo ? (
            <div className="relative h-[200px] w-full bg-ocean-navy-deep">
              <Image src={photo} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" unoptimized />
            </div>
          ) : null}
          <p className="break-words px-5 py-4 text-[15px] leading-6 text-ocean-navy">{body}</p>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------ *
 * Замыкающая связка: якорь-подпись, блок инстаграма, CTA
 * ------------------------------------------------------------------------ */

function OceanSign() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-ocean-gold-ring bg-ocean-navy text-ocean-gold">
        <AnchorIcon size={26} />
      </span>
      <p
        className="text-[13px] font-semibold uppercase leading-4 tracking-[0.08em] text-ocean-gold"
        aria-label={t.oceanBasket.closingEyebrow}
      >
        {spacedOut(t.oceanBasket.closingEyebrow)}
      </p>
      <p className="text-[22px] font-bold leading-7 text-ocean-navy">{t.oceanBasket.closingTitle}</p>
    </div>
  );
}

function OceanInstagramCard() {
  const t = useT();
  return (
    <a
      href={`https://instagram.com/${OCEAN_BASKET_INSTAGRAM}`}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={t.oceanBasket.instagramA11y}
      className="mx-auto flex w-full max-w-[520px] items-center gap-4 rounded-2xl bg-ocean-accent-surface px-6 py-4 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-gold"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean-navy">
        <InstagramIcon size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-bold leading-5 text-ocean-navy">
          {t.oceanBasket.instagramHandle}
        </span>
        <span className="truncate text-[13px] leading-4 text-ocean-muted">{t.oceanBasket.instagramNote}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-ocean-gold-chevron">
        <ChevronIcon direction="right" size={16} />
      </span>
    </a>
  );
}

function OceanClosingCta({ onBook }: { onBook: () => void }) {
  const t = useT();
  return (
    <section className="bg-ocean-navy-deep py-12 lg:py-16">
      <Container className="flex flex-col items-center gap-3 text-center">
        <p
          className="text-[13px] font-semibold uppercase leading-4 tracking-[0.08em] text-ocean-gold"
          aria-label={t.oceanBasket.ctaEyebrow}
        >
          {spacedOut(t.oceanBasket.ctaEyebrow)}
        </p>
        <h2 className="text-[26px] font-bold leading-8 text-ocean-on-navy lg:text-[32px]">
          {t.oceanBasket.ctaTitle}
        </h2>
        <button
          type="button"
          onClick={onBook}
          aria-label={t.oceanBasket.ctaA11y}
          className="mt-2 inline-flex h-12 items-center rounded-full bg-ocean-gold px-8 text-[15px] font-semibold leading-5 text-ocean-navy transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-on-navy"
        >
          {t.oceanBasket.ctaAction}
        </button>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------ *
 * Шторка «Welcome drink» — тот же текст, что в мобильном приложении, но
 * рисуется общим веб-компонентом `Modal` вместо RN bottom sheet.
 * ------------------------------------------------------------------------ */

function OceanWelcomeModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const sheet = t.oceanBasket.welcomeSheet;

  return (
    <Modal title={sheet.title} description={sheet.subtitle} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="mb-2 text-[16px] font-semibold leading-6 text-ink">{sheet.includesTitle}</h3>
          <ul className="flex flex-col gap-2">
            {sheet.includes.map((line) => (
              <li key={line} className="flex items-start gap-2 text-bodyM text-ink-secondary">
                <CheckIcon size={16} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-[16px] font-semibold leading-6 text-ink">{sheet.stepsTitle}</h3>
          <ol className="flex flex-col gap-1 text-bodyM text-ink-secondary">
            {sheet.steps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>

        <div className="rounded-lg bg-subtle px-4 py-3">
          <h3 className="mb-1 text-[14px] font-semibold leading-5 text-ink">{sheet.termsTitle}</h3>
          <p className="whitespace-pre-line text-[13px] leading-5 text-ink-tertiary">
            {sheet.terms.map((line) => `· ${line}`).join("\n")}
          </p>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------------ *
 * Значки — те же инлайновые SVG, что у остальных страниц сайта
 * (`VenueScreen.tsx`), а не Phosphor из мобилки.
 * ------------------------------------------------------------------------ */

function AnchorIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke={color} strokeWidth="1.6">
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v14M6 12H4a8 8 0 0 0 8 9 8 8 0 0 0 8-9h-2" strokeLinecap="round" />
      <path d="M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

function GiftIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke={color} strokeWidth="1.8">
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M4 13h16M12 9v11" />
      <path d="M12 9c-1.5 0-4-1-4-3a2 2 0 0 1 4 0 2 2 0 0 1 4 0c0 2-2.5 3-4 3Z" />
    </svg>
  );
}

function ChevronIcon({ direction, size = 12 }: { direction: "up" | "down" | "right"; size?: number }) {
  const rotation = direction === "up" ? "-rotate-90" : direction === "right" ? "rotate-0" : "rotate-90";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      className={cx("inline-block", rotation)}
    >
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="mt-0.5 shrink-0">
      <circle cx="8" cy="8" r="8" fill="#D2C159" />
      <path d="M4.5 8.2l2.2 2.2 4.5-4.8" stroke="#052747" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
