"use client";

import Link from "next/link";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Restaurant } from "@bookeat/api/client";

import { Skeleton } from "@web/components/state/AsyncBlock";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import {
  ContactCard,
  ContactLink,
  InstagramIcon,
  LinkIcon,
  MapPreview,
  PhoneIcon,
  PinIcon,
} from "@web/components/venue/VenueContacts";
import { instagramHandle, websiteHost } from "@web/lib/format";
import { phoneHoursNote } from "@web/lib/schedule";
import { useT } from "@web/lib/locale";
import { Fragment } from "react";

/**
 * «Место проведения» + «Контакты и как добраться» на странице события/акции
 * (T1, узел 5033:6922). Общий модуль для `EventScreen` и `PromoScreen`: те же
 * примитивы, что у `VenueScreen.tsx` (`components/venue/VenueContacts.tsx`),
 * своя геометрия мини-карточки (788×120, фото 88) и карточек контактов
 * (252×86, три РАВНЫЕ, а не как у заведения) — `webEventDetail`.
 *
 * ПРАВИЛО ОТКАЗА (слова Дамира, разные для события и акции):
 *   • событие — `onVenueError="fallback"`: заведение не загрузилось
 *     (сеть/500), но его ИМЯ уже есть в самом событии — мини-карточка рисует
 *     имя и ссылку, секции контактов нет (критерий 9 T1);
 *   • акция — `onVenueError="hide"`: владелец 2026-09-06 велел «если
 *     заведения нет или оно не найдено у нас — просто не показывай блок»,
 *     без имени-заглушки — на акции денормализованного имени в контракте нет
 *     вовсе (`Promo.restaurant` либо есть целиком, либо null).
 */
export function VenueBlock({
  restaurantId,
  restaurantName,
  roomLabel,
  query,
  onVenueError,
}: {
  restaurantId: string;
  /** Имя из самого события/акции (денормализовано) — запасной вариант, пока
   * `query` летит или если она упала (только для `onVenueError="fallback"`). */
  restaurantName: string;
  /** «Терраса» — комната/зона события. У акции такого поля нет. */
  roomLabel?: string;
  query: UseQueryResult<Restaurant>;
  onVenueError: "fallback" | "hide";
}) {
  const t = useT();

  if (query.isError) {
    if (onVenueError === "hide") return null;
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-[24px] font-semibold leading-[24px] text-ink">
          {t.web.events.venueSectionTitle}
        </h2>
        <div className="flex min-h-afisha-venue w-full flex-wrap items-center gap-4 rounded-lg bg-subtle p-4">
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-5 text-ink">
            {restaurantName}
          </span>
          <Link
            href={`/venues/${encodeURIComponent(restaurantId)}`}
            className="shrink-0 text-[16px] font-semibold leading-[22px] text-brand-text hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {t.web.events.openVenuePage} →
          </Link>
        </div>
      </section>
    );
  }

  if (query.isPending || query.data === undefined) {
    return <VenueBlockSkeleton />;
  }

  const venue = query.data;
  const photo = venue.coverPhoto ?? venue.photos[0];
  const addressLine = [roomLabel, venue.address.trim()].filter(Boolean).join(t.web.format.metaSeparator);
  const hasCoords = venue.latitude !== undefined && venue.longitude !== undefined;

  const channels: { key: "instagram" | "whatsapp" | "website"; href: string; label: string }[] = [];
  for (const key of ["instagram", "whatsapp", "website"] as const) {
    const href = venue.social?.[key];
    if (href) channels.push({ key, href, label: t.web.venue.contacts.channel[key] });
  }
  const primary = channels[0];
  const primaryTitle = primary
    ? primary.key === "instagram"
      ? (instagramHandle(primary.href) ?? primary.label)
      : primary.key === "website"
        ? (websiteHost(primary.href) ?? primary.label)
        : primary.label
    : null;
  const phoneNote = venue.phone ? phoneHoursNote(venue.schedule, t) : null;
  const hasContacts = venue.address.trim() || venue.phone || channels.length > 0 || hasCoords;

  return (
    <>
      <section className="flex flex-col gap-4">
        <h2 className="text-[24px] font-semibold leading-[24px] text-ink">
          {t.web.events.venueSectionTitle}
        </h2>
        {/* Мини-карточка заведения (Figma 5033:6948, "Mini venue card"):
            HORIZONTAL, itemSpacing 16, padding 16, radius 16 (`rounded-lg` в
            этой теме = 16, см. `webRadius.lg`), фото и Info выровнены по
            центру. НИКАКОГО `flex-wrap` на внешнем контейнере: фото
            фиксированной ширины 88 и Info на всю оставшуюся ширину — перенос
            строк живёт ВНУТРИ Info, а не между ним и фото. */}
        <div className="flex h-auto min-h-afisha-venue w-full items-center gap-4 rounded-lg bg-subtle p-4">
          <div className="relative h-afisha-photo w-afisha-photo shrink-0 overflow-hidden rounded-md bg-muted">
            <RemoteImage src={photo?.uri} alt={photo?.alt || venue.name} sizes="88px" />
          </div>
          {/* Info (Figma "Info"): VERTICAL, itemSpacing 6, выравнивание MIN —
              три строки ОДНА ПОД ДРУГОЙ: имя+рейтинг, адрес, ссылка. Ссылка
              «Открыть страницу заведения» — ТРЕТЬЯ строка этой колонки, а не
              сосед на уровне внешнего flex-контейнера (иначе на узких
              ширинах её сносило в непредсказуемое место). */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 truncate text-[14px] font-semibold leading-5 text-ink">
                {venue.name}
              </span>
              {venue.rating > 0 ? (
                <span className="inline-flex items-center rounded-[6px] bg-canvas px-2 py-[3px] text-[10px] font-medium leading-[14px] text-ink">
                  ★ {venue.rating.toFixed(1)}
                </span>
              ) : null}
            </div>
            {addressLine ? (
              // `text-ink-secondary` (#595959, `webColors.text.secondary`) —
              // спека 5033:6948 просит text/secondary, не text/tertiary.
              <p className="truncate text-[12px] leading-4 text-ink-secondary">{addressLine}</p>
            ) : null}
            <Link
              href={`/venues/${encodeURIComponent(venue.id)}`}
              className="w-fit shrink-0 text-[16px] font-semibold leading-[22px] text-brand-text hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {t.web.events.openVenuePage} →
            </Link>
          </div>
        </div>
      </section>

      {hasContacts ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-[26px] font-semibold leading-[34px] text-ink">
            {t.web.venue.contacts.title}
          </h2>
          <MapPreview
            venueId={venue.id}
            hasCoords={hasCoords}
            alt={t.web.venue.contacts.mapAlt(venue.name)}
            unavailableText={t.web.venue.contacts.mapUnavailable}
          />
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {venue.address.trim() ? (
              <ContactCard
                className="h-afisha-contact w-full"
                icon={<PinIcon />}
                title={venue.address}
                note={venue.addressNote}
              />
            ) : null}
            {venue.phone ? (
              <ContactCard
                className="h-afisha-contact w-full"
                icon={<PhoneIcon />}
                title={venue.phone}
                href={`tel:${venue.phone.replace(/[^\d+]/g, "")}`}
                note={phoneNote ?? t.web.venue.contacts.phone}
              />
            ) : null}
            {primary && primaryTitle ? (
              <ContactCard
                className="h-afisha-contact w-full"
                icon={primary.key === "instagram" ? <InstagramIcon /> : <LinkIcon />}
                title={<ContactLink href={primary.href}>{primaryTitle}</ContactLink>}
                note={channels.map((channel, index) => (
                  <Fragment key={channel.key}>
                    {index > 0 ? t.web.format.metaSeparator : null}
                    <ContactLink href={channel.href}>{channel.label}</ContactLink>
                  </Fragment>
                ))}
              />
            ) : null}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function VenueBlockSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-afisha-venue w-full rounded-lg" />
      <Skeleton className="h-venue-map w-full rounded-lg" />
    </div>
  );
}
