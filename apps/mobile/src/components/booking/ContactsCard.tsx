import type { Restaurant } from "@bookeat/api";
import { spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { MAP_PREVIEW_ENABLED } from "../../lib/feature-flags";
import { VenueAddressRow, VenueContactIcons } from "../contacts/VenueContactLinks";
import { BookingCard } from "./BookingCard";
import { MapPreview } from "./MapPreview";

const t = getDictionary();

/**
 * "Контакты" on the Reservation detail screen (Figma node 488:9876): a row of
 * circular icon buttons (звонок, сайт, WhatsApp, Instagram), then the address
 * row and the map preview. Отдельной строки телефона больше нет — номер
 * свёрнут в первую иконку ряда (правка владельца 2026-08-26).
 *
 * The rows themselves live in `contacts/VenueContactLinks` — the same
 * implementation the event and promo cards use, so a venue's phone behaves
 * identically wherever it is shown. Nothing here is rendered as a dead
 * control: a venue with no website gets no globe button at all rather than a
 * button that does nothing (on the live catalog `social_links` is frequently
 * null, so this is the common case). If the venue has no contacts whatsoever
 * the card itself is not rendered (decided by the caller via `hasAnyContact`).
 */
/**
 * Координаты входят в признак ТОЛЬКО пока карта показывается: с выключенным
 * `MAP_PREVIEW_ENABLED` заведение, у которого нет ничего кроме точки на карте,
 * дало бы карточку «Контакты» с одним заголовком и пустотой под ним.
 */
export function hasAnyContact(restaurant: Restaurant): boolean {
  return Boolean(
    restaurant.social?.website ||
      restaurant.social?.whatsapp ||
      restaurant.social?.instagram ||
      restaurant.address ||
      restaurant.phone ||
      (MAP_PREVIEW_ENABLED &&
        restaurant.latitude !== undefined &&
        restaurant.longitude !== undefined),
  );
}

export function ContactsCard({ restaurant }: { restaurant: Restaurant }) {
  // Заголовок 20/28 (node 5504:7567); просвет между блоками в макете (node
  // 5504:7565) — 24 между иконками/адресом/картой, а между заголовком и
  // иконками — 16 (node 5504:7566). BookingCard даёт один общий просвет на
  // всех детей — здесь взят больший (24), чтобы карта и адрес не читались
  // слипшимися; заголовок садится чуть просторнее, чем в макете, — разница
  // в 8pt, которую не стоило тащить отдельной обёрткой ради одной карточки.
  return (
    <BookingCard title={t.booking.contactsTitle} titleSize="section" gap={spacing.xxl}>
      <VenueContactIcons phone={restaurant.phone} social={restaurant.social} />
      <VenueAddressRow restaurant={restaurant} />
      <MapPreview restaurant={restaurant} />
    </BookingCard>
  );
}
