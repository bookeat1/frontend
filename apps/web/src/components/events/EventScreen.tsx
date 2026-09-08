"use client";

import type { EventSummary } from "@bookeat/api/client";

import { EVENTS_PATH } from "@web/components/home/Cards";
import { BookCard } from "@web/components/events/BookCard";
import { VenueBlock } from "@web/components/events/EventVenueBlocks";
import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { eventDateParts, formatNumber, instantDateLabel, slotDateIso } from "@web/lib/format";
import { isNotFound } from "@web/lib/not-found";
import { useLocale, useT } from "@web/lib/locale";
import { useEvent, useVenue } from "@web/lib/queries";

/**
 * Карточка события `/events/[id]` — узел 5033:6922 (Figma
 * `qmMsg4jO1ggmyEHNIAD2ll`). Структура по спеке T1
 * (`specs/web-fixes-20260906.md`): обложка 1200×426 r24 → теги → название
 * 24/32 → строка «{заведение} · {дата} · {время}» → «Об афише» → «Место
 * проведения» → «Контакты и как добраться»; справа карточка «Записаться».
 *
 * Данные — `GET /events/:eventId` (`useEvent`), без хлебных крошек и без
 * плашки даты на обложке (в отличие от прежней версии этого экрана): макет
 * их не рисует.
 *
 * ПРАВИЛО ЗАВЕДЕНИЯ (слова Дамира): блоки «Место проведения», «Контакты…»,
 * часть «{заведение}» в строке под названием и кнопка «Записаться»
 * рисуются ТОЛЬКО когда у события есть `restaurant`. У события платформы
 * правая карточка есть, только если есть `action.target === "external"`.
 */

const COVER_SIZES = "(min-width: 1280px) 788px, 100vw";

export function EventScreen({ id }: { id: string }) {
  const t = useT();
  const query = useEvent(id);

  if (isNotFound(query.error)) {
    return (
      <SiteChrome active="events">
        <Container className="py-8">
          <StateMessage title={t.afisha.notFoundTitle} text={t.afisha.notFoundDescription}>
            <Button asLink href={EVENTS_PATH} size="m" variant="secondary">
              {t.web.events.back}
            </Button>
          </StateMessage>
        </Container>
      </SiteChrome>
    );
  }

  if (query.isError) {
    return (
      <SiteChrome active="events">
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
      <SiteChrome active="events">
        <Container className="py-8">
          <EventSkeleton />
        </Container>
      </SiteChrome>
    );
  }

  return (
    <SiteChrome active="events">
      <Container className="py-8">
        <EventBody event={query.data} />
      </Container>
    </SiteChrome>
  );
}

function EventSkeleton() {
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

function EventBody({ event }: { event: EventSummary }) {
  const t = useT();
  const { locale } = useLocale();
  // Дата и время — из ОДНОГО источника (`new Date(event.startsAt)`), см.
  // комментарий у `instantDateLabel`: смешивать литеральную дату из строки со
  // временем, посчитанным через `new Date`, нельзя — при пересечении полуночи
  // по UTC они называют разные дни.
  const date = eventDateParts(event.startsAt, locale);
  const longDate = instantDateLabel(event.startsAt, locale, "weekdayLong");
  const meta = t.afisha.subtitle([event.restaurant?.name ?? "", longDate ?? "", date?.time ?? ""]);
  const shownDate = [longDate, date?.time].filter(Boolean).join(t.web.format.metaSeparator) || null;

  const price =
    event.ticketed && event.ticketPriceMinor !== null
      ? t.web.events.ticketPrice(formatNumber(event.ticketPriceMinor / 100))
      : t.web.events.free;

  const venueQuery = useVenue(event.restaurantId ?? "");
  // Объект, а не булев флаг: так `event.restaurantId`/`event.restaurant.name`
  // остаются НЕ-null везде ниже без `as`/`!` (риск T1, требование владельца —
  // `tsc` должен пройти честно).
  const venue = event.restaurant && event.restaurantId
    ? { id: event.restaurantId, name: event.restaurant.name }
    : null;

  // Правая карточка: у события с заведением — «Записаться»; у события
  // платформы — только если есть кнопка с внешней ссылкой (`action.target
  // === "external"`, `target === "event"` — это ссылка на саму страницу,
  // кнопку тогда не рисуем вовсе).
  const externalAction =
    !venue && event.action && event.action.target === "external" && event.action.url
      ? { label: event.action.label, url: event.action.url }
      : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <article className="flex min-w-0 flex-1 flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="relative aspect-home-cover w-full overflow-hidden rounded-2xl bg-muted lg:aspect-auto lg:h-afisha-cover">
              <RemoteImage src={event.coverImageUrl} alt={event.title} sizes={COVER_SIZES} priority />
            </div>

            <div className="flex flex-col gap-4">
              {event.tags.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {event.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-sm bg-brand-subtle px-3 py-[5px] text-[12px] font-medium leading-4 text-brand-text"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
              <h1 className="break-words text-[24px] font-bold leading-8 text-ink">{event.title}</h1>
              {meta ? <p className="text-[16px] leading-6 text-ink-secondary">{meta}</p> : null}
            </div>
          </div>

          <section className="flex flex-col gap-4">
            <h2 className="text-[24px] font-semibold leading-[24px] text-ink">{t.afisha.aboutTitle}</h2>
            <p className="whitespace-pre-line break-words text-[14px] leading-5 text-ink-secondary">
              {event.description.trim() || t.web.events.noDescription}
            </p>
          </section>

          {venue ? (
            <VenueBlock
              restaurantId={venue.id}
              restaurantName={venue.name}
              roomLabel={event.venue}
              query={venueQuery}
              onVenueError="fallback"
            />
          ) : null}
        </article>

        {venue ? (
          <BookCard
            title={t.afisha.bookAction}
            subtitle={price}
            restaurantId={venue.id}
            date={slotDateIso(event.startsAt)}
            dateField={{ shown: shownDate }}
            footNote={event.capacity !== null ? t.web.events.capacity(event.capacity) : null}
          />
        ) : externalAction ? (
          <div className="flex w-full shrink-0 flex-col gap-4 rounded-xl border border-line-strong bg-canvas p-6 shadow-aside lg:sticky lg:top-6 lg:w-venue-aside">
            <Button asLink href={externalAction.url} target="_blank" rel="noopener noreferrer" block>
              {externalAction.label}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
