"use client";

import type { Promo } from "@bookeat/api/client";

import { BookCard } from "@web/components/events/BookCard";
import { VenueBlock } from "@web/components/events/EventVenueBlocks";
import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { instantDateLabel } from "@web/lib/format";
import { isNotFound } from "@web/lib/not-found";
import { useLocale, useT } from "@web/lib/locale";
import { usePromo, useVenue } from "@web/lib/queries";

/**
 * Карточка акции `/promos/[id]` — T1b, решение владельца от 2026-09-06:
 * отдельная страница по шаблону события `EventScreen`, а не редирект на
 * заведение. Секции, мини-карточка заведения, контакты и правая карточка —
 * ОБЩИЕ компоненты с `EventScreen` (`components/events/{EventVenueBlocks,
 * BookCard}.tsx`); отличия только в данных: нет тегов, вместо даты события —
 * «до {ends_at}», бейдж «−N%», секция «Об акции» вместо «Об афише», секция
 * «Условия» при непустом `terms`.
 *
 * ОБЛОЖКА — по узлу 5115:7645 («WEB / 11 · Акции заведения», Figma
 * `qmMsg4jO1ggmyEHNIAD2ll`, снят 2026-09-07): название и подпись лежат
 * ПОВЕРХ фотографии на затемнении снизу вверх, тем же приёмом, что у
 * `PromoCard` в ленте на главной (`home/Cards.tsx`) — а не отдельным белым
 * блоком под кадром, как было и как до сих пор рисует `EventScreen` (там
 * макет другой, трогать не нужно). Цвета и кегль названия/подписи — те же
 * токены, что уже стояли под кадром (`text-[24px]`/`text-[16px]`), просто
 * на `text-ink-on-inverse`/`text-ink-on-inverse-muted`: точные px из узла
 * снять не удалось, `/v1/files` весь заход отвечал 429 (см.
 * `conventions/bookeat-mobile-figma-access.md`), `/v1/images` дал только
 * рендер кадра.
 *
 * ПРАВИЛО ЗАВЕДЕНИЯ У АКЦИИ (слова Дамира, отличается от события): если
 * заведение есть в самой акции, но `GET /restaurants/:id` не находит его или
 * падает — блок заведения СКРЫВАЕТСЯ ЦЕЛИКОМ (`onVenueError="hide"`), без
 * заглушки с именем: у акции, в отличие от события, нет отдельного экрана
 * «место проведения не то же самое, что заведение», денормализованного имени
 * для заглушки в контракте нет.
 */

const COVER_SIZES = "(min-width: 1280px) 788px, 100vw";

export function PromoScreen({ id }: { id: string }) {
  const t = useT();
  const query = usePromo(id);

  if (isNotFound(query.error)) {
    return (
      <SiteChrome>
        <Container className="py-8">
          <StateMessage title={t.promotions.notFoundTitle} text={t.promotions.notFoundDescription}>
            <Button asLink href="/" size="m" variant="secondary">
              {t.web.events.home}
            </Button>
          </StateMessage>
        </Container>
      </SiteChrome>
    );
  }

  if (query.isError) {
    return (
      <SiteChrome>
        <Container className="py-8">
          <StateMessage title={t.web.states.errorTitle} text={t.web.states.errorText} tone="danger">
            <Button size="m" variant="secondary" onClick={() => query.refetch()}>
              {t.web.states.retry}
            </Button>
          </StateMessage>
        </Container>
      </SiteChrome>
    );
  }

  if (query.isPending || query.data === undefined) {
    return (
      <SiteChrome>
        <Container className="py-8">
          <PromoSkeleton />
        </Container>
      </SiteChrome>
    );
  }

  return (
    <SiteChrome>
      <Container className="py-8">
        <PromoBody promo={query.data} />
      </Container>
    </SiteChrome>
  );
}

function PromoSkeleton() {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <Skeleton className="h-afisha-cover w-full rounded-2xl" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-[280px] w-full shrink-0 rounded-xl lg:w-venue-aside" />
    </div>
  );
}

function PromoBody({ promo }: { promo: Promo }) {
  const t = useT();
  const { locale } = useLocale();
  // `promo.endsAt` — настоящий момент (сервер отдаёт UTC `...Z`), а не
  // литеральная дата без времени: `instantDateLabel`, не `slotDateIso` +
  // `bookingDateLabel` (тот же анти-паттерн, что чинили в `EventScreen`).
  const untilDate = instantDateLabel(promo.endsAt, locale);
  const meta = t.afisha.subtitle([
    promo.restaurant?.name ?? "",
    untilDate ? t.promotions.until(untilDate) : "",
  ]);

  const venueQuery = useVenue(promo.restaurantId ?? "");
  const venue = promo.restaurant && promo.restaurantId
    ? { id: promo.restaurantId, name: promo.restaurant.name }
    : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <article className="flex min-w-0 flex-1 flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="relative aspect-home-cover w-full overflow-hidden rounded-2xl bg-muted lg:aspect-auto lg:h-afisha-cover">
              <RemoteImage src={promo.coverImageUrl} alt={promo.title} sizes={COVER_SIZES} priority />
              {/* Затемнение снизу вверх — тот же приём, что у карточки акции на
                  главной (`PromoCard`, `home/Cards.tsx`): название и подпись
                  лежат ПОВЕРХ фотографии, а не отдельным блоком под ней (узел
                  5115:7645, «WEB / 11 · Акции заведения»). */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.72)] via-[rgba(0,0,0,0.25)] to-transparent"
              />
              {promo.discountPercent !== null && promo.discountPercent > 0 ? (
                <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-brand px-3 py-1.5 text-[13px] font-bold leading-[18px] text-ink-on-brand">
                  {t.web.format.discount(promo.discountPercent)}
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-6">
                <h1 className="break-words text-[24px] font-bold leading-8 text-ink-on-inverse">
                  {promo.title}
                </h1>
                {meta ? <p className="text-[16px] leading-6 text-ink-on-inverse-muted">{meta}</p> : null}
              </div>
            </div>
          </div>

          <section className="flex flex-col gap-4">
            <h2 className="text-[24px] font-semibold leading-[24px] text-ink">{t.promotions.aboutTitle}</h2>
            <p className="whitespace-pre-line break-words text-[14px] leading-5 text-ink-secondary">
              {promo.description.trim() || t.web.events.noDescription}
            </p>
          </section>

          {promo.terms.trim() ? (
            <section className="flex flex-col gap-4">
              <h2 className="text-[24px] font-semibold leading-[24px] text-ink">{t.promotions.termsTitle}</h2>
              <p className="whitespace-pre-line break-words text-[14px] leading-5 text-ink-secondary">
                {promo.terms}
              </p>
            </section>
          ) : null}

          {venue ? (
            <VenueBlock
              restaurantId={venue.id}
              restaurantName={venue.name}
              query={venueQuery}
              onVenueError="hide"
            />
          ) : null}
        </article>

        {venue ? (
          <BookCard title={t.web.venue.booking.title} restaurantId={venue.id} />
        ) : null}
      </div>
    </div>
  );
}
