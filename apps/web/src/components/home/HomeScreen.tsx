"use client";

import Link from "next/link";

import { Section, SectionHeader } from "@web/components/home/SectionHeader";
import { EventCard, GuideCard, PromoCard } from "@web/components/home/Cards";
import { SearchPanel } from "@web/components/home/SearchPanel";
import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { VenueCard } from "@web/components/ui/VenueCard";
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
 *   • фотография-подложка героя — своего файла у неё нет ни в макете (там
 *     стоковый кадр), ни в каталоге; вместо неё фирменная заливка;
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
      {/* Герой. Заливка вместо фотографии — см. комментарий выше. */}
      <section className="w-full bg-brand bg-gradient-to-br from-brand to-[#7E1F24] py-16">
        <Container className="flex flex-col gap-8">
          <div className="flex max-w-[640px] flex-col gap-3">
            <h1 className="text-[48px] font-bold leading-[52px] text-ink-on-inverse">
              {t.web.home.hero.title}
            </h1>
            <p className="text-bodyL text-ink-on-inverse">{t.web.home.hero.subtitle}</p>
          </div>
          <SearchPanel state={EMPTY_CATALOG_STATE} />
          <QuickFilters />
        </Container>
      </section>

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
              <ul className="flex flex-wrap gap-6">
                {PLACEHOLDERS.slice(0, 8).map((key) => (
                  <li key={key} className="flex w-[104px] flex-col items-center gap-3">
                    <Skeleton className="h-[104px] w-[104px] rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </li>
                ))}
              </ul>
            }
          >
            {(items) => (
              <ul className="flex flex-wrap gap-6">
                {items.map((cuisine) => (
                  <li key={cuisine.id}>
                    <Link
                      href={`/venues?cuisine=${encodeURIComponent(cuisine.id)}`}
                      className="flex w-[104px] flex-col items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      <span className="relative h-[104px] w-[104px] overflow-hidden rounded-full bg-muted">
                        <RemoteImage src={cuisine.imageUrl} alt="" sizes="104px" />
                      </span>
                      <span className="text-center text-[16px] font-medium leading-[18px] text-ink">
                        {cuisine.name}
                      </span>
                    </Link>
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
 * Быстрые фильтры под панелью поиска. В макете это придуманные ярлыки
 * («Романтический ужин», «24/7»), которых в данных нет вовсе. Вместо них —
 * справочник удобств: те же по виду чипы, но каждый действительно сужает
 * выдачу параметром `?features=`.
 */
function QuickFilters() {
  const t = useT();
  const query = useAmenities();
  const amenities = (query.data ?? []).slice(0, 6);

  if (amenities.length === 0) return null;

  return (
    <ul aria-label={t.web.home.hero.quickFilters} className="flex flex-wrap gap-2.5">
      {amenities.map((amenity) => (
        <li key={amenity.id}>
          <Link
            href={`/venues?features=${encodeURIComponent(amenity.id)}`}
            className="inline-flex h-chip items-center rounded-full border border-ink-on-inverse px-chip-x text-[14px] font-medium leading-5 text-ink-on-inverse hover:bg-on-inverse-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {amenity.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Секция «Приложение» (узел 3253:2, «Section / Приложение»).
 *
 * Кнопок магазинов в макете две, а рабочих ссылок на них у нас нет: приложение
 * в сторах ещё не опубликовано, и придумать адрес значит отправить гостя в
 * никуда. Ссылки берутся из окружения сборки и появляются вместе со
 * значениями — пока их нет, секция остаётся текстовой.
 */
function AppSection() {
  const t = useT();
  const appStore = process.env.NEXT_PUBLIC_APP_STORE_URL;
  const googlePlay = process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL;

  return (
    <section className="w-full bg-brand bg-gradient-to-br from-brand to-[#7E1F24] py-16">
      <Container className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-[38px] font-bold leading-[46px] tracking-[-0.6px] text-ink-on-inverse">
            {t.web.home.app.title}
          </h2>
          <p className="text-bodyL text-ink-on-inverse">{t.web.home.app.text}</p>
        </div>
        {appStore || googlePlay ? (
          <div className="flex flex-wrap gap-3">
            {appStore ? (
              <a href={appStore} className={storeLinkClass}>
                {t.web.home.app.appStore}
              </a>
            ) : null}
            {googlePlay ? (
              <a href={googlePlay} className={storeLinkClass}>
                {t.web.home.app.googlePlay}
              </a>
            ) : null}
          </div>
        ) : null}
      </Container>
    </section>
  );
}

const storeLinkClass =
  "inline-flex h-btn-l items-center rounded-md border border-ink-on-inverse px-btn-l-x text-[16px] font-semibold leading-6 text-ink-on-inverse hover:bg-on-inverse-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
