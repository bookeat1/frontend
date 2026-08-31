"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Section, SectionHeader } from "@web/components/home/SectionHeader";
import { EventCard, GuideCard, PromoCard } from "@web/components/home/Cards";
import { CuisineTile } from "@web/components/home/CuisineTile";
import { SearchPanel } from "@web/components/home/SearchPanel";
import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { VenueCard } from "@web/components/ui/VenueCard";
import { assetUrl } from "@web/lib/asset";
import { useCity } from "@web/lib/city";
import { EMPTY_CATALOG_STATE, buildSearchQuery } from "@web/lib/catalog-params";
import { venueMeta } from "@web/lib/format";
import { useT } from "@web/lib/locale";
import {
  useAmenities,
  useCatalog,
  useCuisines,
  useEvents,
  useGuideCollections,
  usePicks,
  usePromotions,
} from "@web/lib/queries";

/**
 * Главная — Figma 3z0f6dgev4HMwBAHPjTjPo, кадр «WEB / 01 · Главная + каталог»
 * (узел 3253:2).
 *
 * Порядок секций и их отступы — из макета. Каждая секция ходит за своими
 * данными отдельным запросом и падает отдельно: сломавшаяся афиша не должна
 * уносить с собой каталог. Поэтому «загрузка/ошибка/пусто» живут внутри
 * секции, а не одним состоянием на всю страницу.
 *
 * Чего в макете есть, а здесь нет и почему:
 *   • быстрые фильтры героя («Сегодня вечером», «Романтический ужин») —
 *     таких значений API не знает; в этой роли стоят настоящие удобства из
 *     `GET /venue-features`, которые реально сужают выдачу;
 *   • слоты свободного времени на карточках — это запрос доступности на
 *     КАЖДУЮ карточку; на плохой связи это двадцать запросов ради подсказки,
 *     поэтому свободное время показывает только страница заведения.
 */
export function HomeScreen() {
  const t = useT();
  const { city, isError: cityFailed } = useCity();

  const cuisines = useCuisines();
  const picks = usePicks(city);
  const promos = usePromotions(city);
  const events = useEvents(city);
  const guide = useGuideCollections();
  const catalog = useCatalog(buildSearchQuery(EMPTY_CATALOG_STATE, city));

  return (
    <SiteChrome active="home">
      <Hero />

      {cityFailed ? (
        <Container className="py-10">
          <StateMessage
            title={t.web.states.errorTitle}
            text={t.web.states.errorText}
            tone="danger"
          />
        </Container>
      ) : null}

      <Section>
        <Container className="flex flex-col gap-6">
          <SectionHeader title={t.web.home.cuisines.title} />
          <AsyncBlock
            query={cuisines}
            emptyText={t.web.home.cuisines.empty}
            skeleton={
              <ul className={CUISINE_ROW}>
                {PLACEHOLDERS.slice(0, 8).map((key) => (
                  <li key={key} className="flex min-w-cuisine shrink-0 flex-col items-center gap-cuisine-gap">
                    <Skeleton className="h-cuisine w-cuisine rounded-full" />
                    <Skeleton className="h-[18px] w-20" />
                  </li>
                ))}
              </ul>
            }
          >
            {(items) => (
              <ul className={CUISINE_ROW}>
                {items.map((cuisine) => (
                  <li key={cuisine.id} className="shrink-0">
                    <CuisineTile cuisine={cuisine} />
                  </li>
                ))}
              </ul>
            )}
          </AsyncBlock>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-7">
          <SectionHeader
            title={t.web.home.picks.title}
            subtitle={t.web.home.picks.subtitle}
            linkHref="/venues"
            linkLabel={t.web.home.picks.all}
          />
          <AsyncBlock
            query={picks}
            emptyText={t.web.home.picks.empty}
            skeleton={<VenueGridSkeleton />}
          >
            {(items) => (
              <ul className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-4">
                {items.map((venue) => (
                  <li key={venue.id}>
                    <VenueCard
                      name={venue.name}
                      meta={venueMeta(venue, t)}
                      imageUrl={venue.coverPhoto?.uri}
                      href={`/venues/${venue.id}`}
                      tag={venue.acceptsOnlineBookings ? t.web.catalog.card.bookable : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}
          </AsyncBlock>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-7">
          <SectionHeader
            title={t.web.home.promos.title}
            subtitle={t.web.home.promos.subtitle}
          />
          <AsyncBlock
            query={promos}
            emptyText={t.web.home.promos.empty}
            skeleton={
              <div className="grid grid-cols-1 gap-gutter md:grid-cols-3">
                {PLACEHOLDERS.slice(0, 3).map((key) => (
                  <Skeleton key={key} className="h-[260px] rounded-card" />
                ))}
              </div>
            }
          >
            {(items) => (
              <ul className="grid grid-cols-1 gap-gutter md:grid-cols-3">
                {items.slice(0, 3).map((promo) => (
                  <li key={promo.id}>
                    <PromoCard promo={promo} />
                  </li>
                ))}
              </ul>
            )}
          </AsyncBlock>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-7">
          <SectionHeader
            title={t.web.home.catalog.title}
            subtitle={city}
            linkHref="/venues"
            linkLabel={t.web.home.catalog.all}
          />
          <AsyncBlock
            query={catalog}
            emptyText={t.web.home.catalog.empty}
            isEmpty={(result) => result.items.length === 0}
            skeleton={<VenueGridSkeleton />}
          >
            {(result) => (
              <ul className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-4">
                {result.items.slice(0, 8).map((venue) => (
                  <li key={venue.id}>
                    <VenueCard
                      name={venue.name}
                      meta={venueMeta(venue, t)}
                      imageUrl={venue.coverPhoto?.uri}
                      href={`/venues/${venue.id}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </AsyncBlock>
        </Container>
      </Section>

      <Section tone="subtle">
        <Container className="flex flex-col gap-7">
          <SectionHeader title={t.web.home.events.title} subtitle={t.web.home.events.subtitle} />
          <AsyncBlock
            query={events}
            emptyText={t.web.home.events.empty}
            skeleton={
              <div className="grid grid-cols-1 gap-gutter md:grid-cols-3">
                {PLACEHOLDERS.slice(0, 3).map((key) => (
                  <Skeleton key={key} className="h-[324px] rounded-card" />
                ))}
              </div>
            }
          >
            {(items) => (
              <ul className="grid grid-cols-1 gap-gutter md:grid-cols-3">
                {items.map((event) => (
                  <li key={event.id}>
                    <EventCard event={event} />
                  </li>
                ))}
              </ul>
            )}
          </AsyncBlock>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-7">
          <SectionHeader title={t.web.home.guide.title} subtitle={t.web.home.guide.subtitle} />
          <AsyncBlock
            query={guide}
            emptyText={t.web.home.guide.empty}
            skeleton={
              <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
                {PLACEHOLDERS.slice(0, 2).map((key) => (
                  <Skeleton key={key} className="h-[464px] rounded-card" />
                ))}
              </div>
            }
          >
            {(items) => (
              <ul className="grid grid-cols-1 gap-gutter md:grid-cols-2">
                {items.slice(0, 2).map((collection) => (
                  <li key={collection.slug}>
                    <GuideCard collection={collection} />
                  </li>
                ))}
              </ul>
            )}
          </AsyncBlock>
        </Container>
      </Section>

      <AppSection />
    </SiteChrome>
  );
}

/** Ключи для скелетов: индекс массива в `key` линтер справедливо не любит. */
const PLACEHOLDERS = ["a", "b", "c", "d", "e", "f", "g", "h"];

/**
 * Ряд кухонь (Figma 3254:6) — ОДНА строка с горизонтальной прокруткой.
 *
 * В макете ячеек десять и они умещаются в 1200 `space-between`; просвет из
 * координат — 14,89, округлённый до 15 в токене `webCuisineTile.rowGapX`.
 * Справочник отдаёт ЧЕТЫРНАДЦАТЬ, и раньше ряд переносился на вторую строку —
 * замечание владельца 31.08.2026: переноса быть не должно, лишнее уезжает
 * вбок. Отсюда `flex-nowrap` + `overflow-x-auto`.
 *
 * Полоса прокрутки НЕ прячется: это единственный признак, что вправо есть ещё
 * кухни (кнопок-стрелок макет не рисует, придумывать их не стали). `pb-2` —
 * место под неё, чтобы полоса не наезжала на подписи.
 */
const CUISINE_ROW =
  "flex flex-nowrap gap-x-cuisine-row-x overflow-x-auto pb-2 [scrollbar-width:thin]";

function VenueGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-4">
      {PLACEHOLDERS.slice(0, 4).map((key) => (
        <Skeleton key={key} className="h-[318px] rounded-card" />
      ))}
    </div>
  );
}

/**
 * Герой — Figma 3253:30.
 *
 * Подложка это ФОТОГРАФИЯ (`scaleMode: FILL`) плюс вертикальный градиент
 * затемнения тремя стопами (`webHero.scrim`). Раньше здесь стояла фирменная
 * заливка, потому что файла снимка не было; теперь он экспортирован из
 * макета в `public/brand/hero.webp` (1440 px, webp, 107 КБ).
 *
 * `priority` у картинки не украшение: это самое крупное изображение первого
 * экрана, то есть LCP страницы. `alt=""` — снимок декоративный, содержания в
 * нём нет, и озвучивать его скринридеру нечем.
 */
function Hero() {
  const t = useT();

  return (
    <section className="relative w-full overflow-hidden bg-inverse">
      <Image
        src={assetUrl("/brand/hero.webp")}
        alt=""
        fill
        sizes="100vw"
        priority
        // Наш загрузчик отдаёт адрес как есть — см. lib/image-loader.ts.
        unoptimized
        className="object-cover"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-hero-scrim" />
      <Container className="relative flex flex-col gap-hero-gap py-hero-y">
        <div className="flex max-w-[640px] flex-col gap-3">
          <h1 className="text-[48px] font-bold leading-[52px] text-ink-on-inverse">
            {t.web.home.hero.title}
          </h1>
          <p className="text-[18px] leading-7 text-ink-on-inverse">{t.web.home.hero.subtitle}</p>
        </div>
        <SearchPanel state={EMPTY_CATALOG_STATE} />
        <QuickFilters />
      </Container>
    </section>
  );
}

/**
 * Быстрые фильтры под панелью поиска. В макете это придуманные ярлыки
 * («Романтический ужин», «24/7»), которых в данных нет вовсе. Вместо них —
 * справочник удобств: те же по виду чипы, но каждый действительно сужает
 * выдачу параметром `?features=`.
 *
 * Вид чипа взят из макета (узел 3253:55): заливка белым 14% и обводка белым
 * 30%, а не прозрачный фон со сплошной белой рамкой — на светлой части
 * фотографии такой чип пропадал бы.
 */
function QuickFilters() {
  const t = useT();
  const query = useAmenities();
  const amenities = (query.data ?? []).slice(0, 6);

  if (amenities.length === 0) return null;

  return (
    <ul aria-label={t.web.home.hero.quickFilters} className="flex flex-wrap gap-quick-gap">
      {amenities.map((amenity) => (
        <li key={amenity.id}>
          <Link
            href={`/venues?features=${encodeURIComponent(amenity.id)}`}
            className="inline-flex h-chip items-center rounded-full border border-on-photo-chip-border bg-on-photo-chip px-chip-x text-[14px] font-medium leading-5 text-ink-on-inverse backdrop-blur-sm hover:bg-on-inverse-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {amenity.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Секция «Приложение» перед подвалом — Figma 3256:62.
 *
 * Из макета: вертикальный градиент #B23036 → #631F21, паддинг 72/120,
 * заголовок 38/46 с трекингом −0.6, текст 17/26 белым 85%, кнопки магазинов
 * 46 высотой с радиусом 12 и белой рамкой, снимок телефона справа, который
 * ВЫСТУПАЕТ за секцию сверху и снизу и ею обрезается.
 *
 * ССЫЛКИ. iOS-приложение опубликовано — адрес проверен 31.08.2026 запросом к
 * `itunes.apple.com/lookup?bundleId=com.bookeat.app` и лежит здесь значением
 * по умолчанию (это публичный адрес витрины, не секрет). Android В МАГАЗИНЕ
 * НЕТ: `play.google.com/store/apps/details?id=com.bookeatteam.bookeatapp`
 * отвечает 404, поэтому кнопки Google Play нет вовсе — придуманный адрес
 * отправил бы гостя в никуда. Появится приложение — достаточно задать
 * `NEXT_PUBLIC_GOOGLE_PLAY_URL` при сборке, разметка уже готова.
 */
const APP_STORE_URL_DEFAULT = "https://apps.apple.com/app/id6757542577";

function AppSection() {
  const t = useT();
  const appStore = process.env.NEXT_PUBLIC_APP_STORE_URL || APP_STORE_URL_DEFAULT;
  const googlePlay = process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL;

  return (
    <section className="relative w-full overflow-hidden bg-app-section">
      <Container className="relative flex flex-col gap-6 py-app-y">
        <div className="flex max-w-[720px] flex-col gap-2">
          <h2 className="text-[38px] font-bold leading-[46px] tracking-[-0.6px] text-ink-on-inverse">
            {t.web.home.app.title}
          </h2>
          <p className="text-[17px] leading-[26px] text-on-brand-muted">{t.web.home.app.text}</p>
        </div>
        <ul className="flex flex-wrap gap-3">
          <li>
            <StoreLink
              href={appStore}
              label={t.web.home.app.appStore}
              eyebrow={t.web.home.app.appStoreEyebrow}
              name={t.web.home.app.appStoreName}
              icon={<AppleMark />}
            />
          </li>
          {googlePlay ? (
            <li>
              <StoreLink
                href={googlePlay}
                label={t.web.home.app.googlePlay}
                eyebrow={t.web.home.app.googlePlayEyebrow}
                name={t.web.home.app.googlePlayName}
                icon={<PlayMark />}
              />
            </li>
          ) : null}
        </ul>
      </Container>
      {/* Снимок телефона. `aria-hidden` и пустой alt: это иллюстрация, весь
          смысл секции уже сказан текстом. На экранах уже 1024 он прячется —
          иначе он налезает на заголовок. */}
      <Image
        src={assetUrl("/brand/app-phone.webp")}
        alt=""
        aria-hidden="true"
        width={568}
        height={835}
        unoptimized
        loading="lazy"
        // Положение из макета: левый край снимка на 821 при ширине кадра 1440,
        // то есть на 101 правее центра. Через `calc(50% + 101px)`, а не
        // абсолютным `left`, — иначе на экране шире 1440 телефон уезжал бы от
        // центрального контейнера влево.
        //
        // `object-contain`, а НЕ `object-cover`: прямоугольник 568×835 в макете
        // вписывает снимок целиком (`scaleMode: FIT`), а не обрезает его.
        // Проверено по отрисовке кадра — тёмная рамка телефона начинается на
        // x≈990; `cover` дал бы 960, то есть аппарат заметно крупнее макета.
        className="pointer-events-none absolute -top-[199px] left-[calc(50%+101px)] hidden h-[835px] w-[568px] max-w-none select-none object-contain lg:block"
      />
    </section>
  );
}

/** Кнопка магазина (узлы 3280:4095 и 3280:4251): 46 высотой, радиус 12,
 * белая рамка 1, значок слева и две строки подписи. */
function StoreLink({
  href,
  label,
  eyebrow,
  name,
  icon,
}: {
  href: string;
  label: string;
  eyebrow: string;
  name: string;
  icon: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="inline-flex h-store items-center gap-3 rounded-store border border-ink-on-inverse px-3 text-ink-on-inverse hover:bg-on-inverse-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {icon}
      <span aria-hidden="true" className="flex flex-col items-start leading-none">
        <span className="text-[10px] font-medium uppercase tracking-[0.4px]">{eyebrow}</span>
        <span className="text-[17px] font-semibold leading-[22px]">{name}</span>
      </span>
    </a>
  );
}

function AppleMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M17.05 12.54c.02 2.4 2.1 3.2 2.13 3.21-.02.06-.34 1.15-1.1 2.27-.66.98-1.35 1.95-2.43 1.97-1.07.02-1.41-.63-2.63-.63-1.22 0-1.6.61-2.61.65-1.05.04-1.84-1.06-2.5-2.03-1.37-1.98-2.41-5.59-1.01-8.03.7-1.21 1.94-1.98 3.29-2 1.03-.02 2 .69 2.63.69.63 0 1.81-.86 3.05-.73.52.02 1.98.21 2.91 1.58-.08.05-1.74 1.02-1.72 3.05M15.15 5.7c.56-.68.93-1.62.83-2.56-.8.03-1.78.54-2.35 1.21-.52.6-.98 1.57-.85 2.48.9.07 1.81-.46 2.37-1.13" />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M3.6 2.1c-.24.25-.38.64-.38 1.15v17.5c0 .51.14.9.38 1.15l.06.06 9.8-9.8v-.23l-9.8-9.8-.06.07Z" />
      <path d="m16.7 15.46-3.24-3.25v-.23l3.24-3.25.07.04 3.84 2.18c1.1.62 1.1 1.64 0 2.27l-3.84 2.18-.07.06Z" />
      <path d="m16.77 15.4-3.31-3.31-9.86 9.86c.36.39.96.43 1.64.05l11.53-6.6" />
      <path d="M16.77 8.78 5.24 2.18c-.68-.38-1.28-.34-1.64.05l9.86 9.86 3.31-3.31Z" />
    </svg>
  );
}
