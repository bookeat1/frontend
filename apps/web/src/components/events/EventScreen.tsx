"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { EventSummary } from "@bookeat/api/client";

import { EVENTS_PATH } from "@web/components/home/Cards";
import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { Card } from "@web/components/ui/Card";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { eventDateParts, formatNumber, INTL_TAG } from "@web/lib/format";
import { useLocale, useT } from "@web/lib/locale";
import { useEventById } from "@web/lib/queries";

/**
 * Карточка события /events/[id] — узел 5033:6922.
 *
 * ВНИМАНИЕ: в кэше спек (`/home/tai/work/design-specs/web/`) узла 5033:6922
 * НЕТ — ни в `spec-afisha-web.md`, ни в `spec-afisha.md`, ни в `raw/`. Figma
 * по условию задачи не вызываем, поэтому раскладка собрана по мобильному
 * экрану `apps/mobile/app/event/[id].tsx` (обложка → название → «Заведение ·
 * дата · время» → теги → «Об афише» → «Записаться») и по общему для сайта
 * приёму страницы заведения (`VenueScreen`): слева содержимое, справа
 * прилипающая карточка с фактами и кнопкой. Числа кегля — из кита. Сверить
 * с узлом 5033:6922 — отдельный шаг, отмечен в PR.
 *
 * Данные: у публичного API нет `GET /events/:id`, событие ищется в листинге
 * (`useEventById`). Ненайденное — отдельное честное состояние с кнопкой «К
 * афише», не «Повторить».
 */

const COVER = "aspect-home-cover w-full lg:aspect-[16/9]";
const COVER_SIZES = "(min-width: 1280px) 788px, 100vw";

export function EventScreen({ id }: { id: string }) {
  const t = useT();
  const query = useEventById(id);

  return (
    <SiteChrome active="events">
      <Container className="flex flex-col gap-6 py-6 lg:py-8">
        <AsyncBlock
          query={query}
          emptyText={t.afisha.notFoundDescription}
          isEmpty={(data) => data === null}
          empty={
            <StateMessage title={t.afisha.notFoundTitle} text={t.afisha.notFoundDescription}>
              <Button asLink href={EVENTS_PATH} size="m" variant="secondary">
                {t.web.events.back}
              </Button>
            </StateMessage>
          }
          skeleton={<EventSkeleton />}
        >
          {(event) => (event ? <EventBody event={event} /> : null)}
        </AsyncBlock>
      </Container>
    </SiteChrome>
  );
}

function EventSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-5 w-64" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Skeleton className={COVER} />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-[280px] w-full shrink-0 rounded-card lg:w-[404px]" />
      </div>
    </div>
  );
}

function EventBody({ event }: { event: EventSummary }) {
  const t = useT();
  const { locale } = useLocale();
  const date = eventDateParts(event.startsAt, locale);
  const start = new Date(event.startsAt);
  const longDate = Number.isNaN(start.getTime())
    ? null
    : new Intl.DateTimeFormat(INTL_TAG[locale], { day: "numeric", month: "long", weekday: "long" }).format(start);
  const meta = t.afisha.subtitle([event.restaurant.name, longDate ?? "", date?.time ?? ""]);
  const venueHref = `/venues/${event.restaurantId}`;
  const price =
    event.ticketed && event.ticketPriceMinor !== null
      ? t.web.events.ticketPrice(formatNumber(event.ticketPriceMinor / 100))
      : t.web.events.free;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t.web.events.breadcrumbs}>
        <ol className="flex flex-wrap items-center gap-2 text-[14px] leading-5 text-ink-tertiary">
          <li>
            <Link href="/" className="hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {t.web.events.home}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={EVENTS_PATH} className="hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {t.web.events.title}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="min-w-0 truncate text-ink">
            {event.title}
          </li>
        </ol>
      </nav>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <article className="flex min-w-0 flex-1 flex-col gap-5">
          <div className={`relative overflow-hidden rounded-card bg-muted ${COVER}`}>
            <RemoteImage src={event.coverImageUrl} alt={event.title} sizes={COVER_SIZES} priority />
            {date ? (
              <span className="absolute left-4 top-4 flex h-[60px] w-[60px] flex-col items-center justify-center rounded-field bg-canvas">
                <span className="text-[22px] font-bold leading-[26px] text-ink">{date.day}</span>
                <span className="text-[11px] font-semibold leading-[14px] tracking-[0.4px] text-brand-text">
                  {date.month}
                </span>
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="break-words text-[28px] font-bold leading-9 tracking-[-0.5px] text-ink lg:text-[40px] lg:leading-[48px] lg:tracking-[-0.8px]">
              {event.title}
            </h1>
            {meta ? <p className="text-[15px] leading-[22px] text-ink-secondary lg:text-[17px] lg:leading-[26px]">{meta}</p> : null}
          </div>
          {event.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {event.tags.map((tag) => (
                <li key={tag} className="rounded-sm bg-brand-subtle px-3 py-1.5 text-[14px] font-medium leading-4 text-brand-text">
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
          <section className="flex flex-col gap-2">
            <h2 className="text-[22px] font-bold leading-[30px] text-ink">{t.afisha.aboutTitle}</h2>
            <p className="whitespace-pre-line break-words text-bodyM text-ink-secondary">
              {event.description.trim() || t.web.events.noDescription}
            </p>
          </section>
        </article>

        <Card className="flex w-full shrink-0 flex-col gap-4 p-5 lg:sticky lg:top-6 lg:w-[404px] lg:p-6">
          <dl className="flex flex-col gap-3">
            <Fact label={t.web.events.when} value={[longDate, date?.time].filter(Boolean).join(t.web.format.metaSeparator)} />
            <Fact
              label={t.web.events.where}
              value={
                <Link href={venueHref} className="text-brand-text underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                  {[event.restaurant.name, event.venue].filter(Boolean).join(t.web.format.metaSeparator)}
                </Link>
              }
            />
            <Fact label={t.web.events.price} value={price} />
            {event.capacity !== null ? <Fact label="" value={t.web.events.capacity(event.capacity)} /> : null}
            {event.ticketed ? (
              <Fact label="" value={event.ticketsRefundable ? t.web.events.refundable : t.web.events.nonRefundable} />
            ) : null}
          </dl>
          <Button asLink href={`${venueHref}/book`} block>
            {t.afisha.bookAction}
          </Button>
          <Link href={venueHref} className="text-center text-[14px] font-medium leading-5 text-ink-secondary hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            {t.web.events.venuePage}
          </Link>
        </Card>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {label ? <dt className="text-[13px] leading-[18px] text-ink-tertiary">{label}</dt> : null}
      <dd className="break-words text-[16px] font-medium leading-6 text-ink">{value}</dd>
    </div>
  );
}
