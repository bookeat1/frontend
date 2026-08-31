"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { WEEKDAY_BY_DAY_OF_WEEK, type Restaurant, type ScheduleDay } from "@bookeat/api/client";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Badge } from "@web/components/ui/Badge";
import { Button } from "@web/components/ui/Button";
import { Card } from "@web/components/ui/Card";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { repository } from "@web/lib/api";
import { cx } from "@web/lib/cx";
import { priceLabel, scheduleStatus, venueMeta } from "@web/lib/format";
import { useT } from "@web/lib/locale";
import { useVenue } from "@web/lib/queries";

/**
 * Карточка заведения — Figma 3z0f6dgev4HMwBAHPjTjPo, кадр «WEB / 03 · Карточка
 * заведения» (узел 3261:2): хлебные крошки, мозаика фотографий 788 + 2×2,
 * шапка с названием и статусом, две колонки — содержимое и липкая карточка
 * справа.
 *
 * ЧТО В МАКЕТЕ ЕСТЬ, А ЗДЕСЬ НЕТ И ПОЧЕМУ:
 *   • карточка брони справа (дата, гости, сетка времени, «Забронировать») —
 *     бронирование в эту задачу не входит, а кнопка, которая ничего не
 *     бронирует, хуже её отсутствия. На её месте — часы работы и контакты,
 *     то есть настоящие данные того же заведения;
 *   • вкладки «Обзор / Меню / Отзывы / Фото / Контакты» — это навигация по
 *     разделам, которых пока нет; секции идут подряд одной страницей;
 *   • ярлыки-удобства под названием — модель `Restaurant` в `@bookeat/api` их
 *     не содержит, и придумывать их по названию заведения нельзя;
 *   • «Отзывы · 312» — рейтинг и число отзывов в ответе есть, а самих отзывов
 *     ручка не отдаёт, поэтому показан только счётчик.
 */
export function VenueScreen({ id }: { id: string }) {
  const t = useT();
  const query = useVenue(id);

  return (
    <SiteChrome active="venues">
      <Container className="flex flex-col gap-6 py-6">
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
              <div className="flex flex-col gap-6">
                <Skeleton className="h-[460px] rounded-xl" />
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-40 w-full" />
              </div>
            }
          >
            {(venue) => <VenueBody venue={venue} />}
          </AsyncBlock>
        )}
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

  return (
    <div className="flex flex-col gap-8">
      <Gallery photos={photos} name={venue.name} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3.5">
            <h1 className="text-h1 tracking-[-0.8px] text-ink">{venue.name}</h1>
            <Badge tone={status.tone === "success" ? "success" : "neutral"}>{status.label}</Badge>
          </div>
          <p className="text-[16px] leading-6 text-ink-secondary">{venueMeta(venue, t)}</p>
          {venue.reviewsCount > 0 ? (
            <p className="text-bodyM text-ink-tertiary">
              {venue.rating.toFixed(1)}
              {t.web.format.metaSeparator}
              {t.web.venue.reviews(venue.reviewsCount)}
            </p>
          ) : null}
        </div>
        {/* В макете рядом стоят «Сохранить» и «Поделиться». «Сохранить» —
            избранное, а этого у сайта нет ни в модели заведения
            (`Restaurant` без `isFavorite`), ни в экранах; кнопка-обманка хуже
            её отсутствия. «Поделиться» работает по-настоящему. */}
        <ShareButton name={venue.name} />
      </header>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <section className="flex flex-col gap-3">
            <h2 className="text-h3 tracking-[-0.4px] text-ink">{t.web.venue.about.title}</h2>
            <p className="whitespace-pre-line break-words text-[16px] leading-[26px] text-ink-secondary">
              {venue.description.trim() || t.web.venue.about.empty}
            </p>
          </section>

          <section className="flex flex-col gap-5">
            <h2 className="text-h3 tracking-[-0.4px] text-ink">{t.web.venue.menu.title}</h2>
            {venue.menuHighlights.length === 0 ? (
              <StateMessage text={t.web.venue.menu.empty} />
            ) : (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {venue.menuHighlights.slice(0, 6).map((dish) => (
                  <li key={dish.id}>
                    <Card className="flex h-full flex-col">
                      <div className="relative h-[150px] w-full bg-muted">
                        <RemoteImage
                          src={dish.photo?.uri}
                          alt={dish.name}
                          sizes="(min-width: 1280px) 252px, 33vw"
                        />
                      </div>
                      <div className="flex flex-1 flex-col gap-1.5 p-4">
                        <p className="break-words text-[15px] font-semibold leading-[22px] text-ink">
                          {dish.name}
                        </p>
                        {dish.description ? (
                          <p className="line-clamp-2 break-words text-[13px] leading-[18px] text-ink-tertiary">
                            {dish.description}
                          </p>
                        ) : null}
                        <p className="mt-auto pt-2 text-[16px] font-bold leading-6 text-ink">
                          {dish.price || t.web.venue.menu.noPrice}
                        </p>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {venue.promoBanners.length > 0 ? (
            <section className="flex flex-col gap-5">
              <h2 className="text-h3 tracking-[-0.4px] text-ink">{t.web.venue.promos.title}</h2>
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {venue.promoBanners.map((promo) => (
                  <li
                    key={promo.id}
                    className="flex min-h-[120px] items-end rounded-card bg-brand-subtle p-5 text-[20px] font-bold leading-[30px] tracking-[-0.3px] text-brand-text"
                  >
                    {promo.title}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Contacts venue={venue} />
        </div>

        <aside className="flex w-full flex-col gap-4 lg:w-[380px] lg:shrink-0">
          {/* Липкая колонка: на длинной странице часы работы и телефон должны
              оставаться перед глазами, как карточка брони в макете. */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            <Hours venue={venue} />
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * Мозаика фотографий — Figma 3261:2: большая слева (788×460) и четыре по
 * 198×226 справа сеткой 2×2. Счётчик «Все фото · 48» в макете лежит ПЛАШКОЙ
 * поверх последнего снимка, а не строкой под мозаикой (как было раньше).
 *
 * Фотографий может быть меньше четырёх и может не быть вовсе: тогда правая
 * колонка сжимается, а не оставляет серые дыры. Плашка появляется только
 * когда есть на чём её рисовать.
 */
function Gallery({
  photos,
  name,
}: {
  photos: { id: string; uri: string; alt: string }[];
  name: string;
}) {
  const t = useT();
  if (photos.length === 0) {
    return <StateMessage text={t.web.venue.gallery.empty} />;
  }

  const [main, ...rest] = photos;
  const grid = rest.slice(0, 4);

  return (
    <section aria-label={t.web.venue.gallery.label} className="flex flex-col gap-2 md:flex-row">
      <div
        className={cx(
          "relative h-[300px] overflow-hidden rounded-xl bg-muted md:h-[460px]",
          grid.length > 0 ? "md:w-2/3" : "md:w-full",
        )}
      >
        <RemoteImage
          src={main.uri}
          alt={main.alt || name}
          sizes="(min-width: 1280px) 788px, 100vw"
          priority
        />
      </div>
      {grid.length > 0 ? (
        // Правая колонка ОБЯЗАНА заполняться целиком. В макете снимков ровно
        // четыре и сетка 2×2, а у настоящего заведения их бывает один, два или
        // три — и «2×2 всегда» оставляло бы рядом с большим фото серую дыру
        // в половину колонки (увидено на стенде). Поэтому число колонок и
        // высота плитки считаются от количества:
        //   1 — одна плитка во всю высоту большого снимка;
        //   2 — колонка из двух по 226 (226 + 8 + 226 = 460, ровно в высоту);
        //   3 — 2×2, где третья растянута на обе колонки;
        //   4 — сетка макета.
        <div
          className={cx(
            "grid gap-2 md:w-1/3",
            grid.length >= 3 ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          {grid.map((photo, index) => (
            <div
              key={photo.id}
              className={cx(
                "relative overflow-hidden rounded-lg bg-muted",
                grid.length === 1 ? "h-[200px] md:h-[460px]" : "h-[110px] md:h-[226px]",
                grid.length === 3 && index === 2 ? "col-span-2" : "",
              )}
            >
              <RemoteImage src={photo.uri} alt={photo.alt || name} sizes="198px" />
              {index === grid.length - 1 ? (
                <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center rounded-full bg-photo-badge px-3 py-1.5 text-[13px] font-medium leading-[18px] text-ink-on-inverse">
                  {t.web.venue.gallery.count(photos.length)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

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
    <section className="flex flex-col gap-5">
      <h2 className="text-h3 tracking-[-0.4px] text-ink">{t.web.venue.contacts.title}</h2>

      {mapUrl ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-muted">
          <RemoteImage src={mapUrl} alt={t.web.venue.contacts.mapAlt(venue.name)} sizes="788px" />
        </div>
      ) : (
        <p className="text-bodyM text-ink-tertiary">{t.web.venue.contacts.noMap}</p>
      )}

      {hasAnything ? (
        // Три плашки со значком слева — раскладка макета 3261:2. Значок несёт
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

/** Плашка контакта (узел 3261:2): круглый значок, крупная строка и подпись. */
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
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-secondary"
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

  return (
    <li className="rounded-field bg-subtle">
      {href ? (
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer nofollow" } : {})}
          className="flex items-center gap-3 rounded-field p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {body}
        </a>
      ) : (
        <span className="flex items-center gap-3 p-4">{body}</span>
      )}
    </li>
  );
}

/**
 * «Поделиться» (узел 3261:2). Делает ровно то, что обещает: системное окно
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
    <div className="flex items-center gap-2">
      {copied ? (
        <span role="status" className="text-[13px] leading-[18px] text-ink-secondary">
          {t.web.venue.shareCopied}
        </span>
      ) : null}
      <Button size="m" variant="secondary" onClick={() => void share()}>
        <ShareIcon />
        {t.web.venue.share}
      </Button>
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path
        d="M5 4h3.2l1.4 3.5-2 1.3a12 12 0 0 0 5.6 5.6l1.3-2L18 13.8V17a2 2 0 0 1-2.2 2A14.5 14.5 0 0 1 5 6.2 2 2 0 0 1 7 4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2" strokeLinecap="round" />
      <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2" strokeLinecap="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Часы работы. Показываем СТРУКТУРНЫЙ график, когда он есть; иначе — то, что
 * заведение написало о себе само (`opening_hours`), подписанное как его
 * собственные слова. Разбирать эту строку на часы нельзя — на этом уже стоял
 * баг в мобильном приложении.
 */
function Hours({ venue }: { venue: Restaurant }) {
  const t = useT();
  const days = venue.schedule?.days ?? [];

  return (
    <Card className="flex flex-col gap-4 border border-line p-6 shadow-none">
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
              <dd className="text-[14px] font-medium leading-5 text-ink">{dayHours(day, t)}</dd>
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
    </Card>
  );
}

function dayHours(day: ScheduleDay, t: ReturnType<typeof useT>): string {
  if (!day.isOpen) return t.web.venue.hours.dayOff;
  if (!day.opensAt || !day.closesAt) return t.web.venue.hours.unknown;
  return day.closesNextDay
    ? t.web.venue.hours.untilNextDay(day.opensAt, day.closesAt)
    : t.web.venue.hours.range(day.opensAt, day.closesAt);
}
