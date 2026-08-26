import type { Restaurant } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
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
export function hasAnyContact(restaurant: Restaurant): boolean {
  return Boolean(
    restaurant.social?.website ||
      restaurant.social?.whatsapp ||
      restaurant.social?.instagram ||
      restaurant.address ||
      restaurant.phone ||
      (restaurant.latitude !== undefined && restaurant.longitude !== undefined),
  );
}

export function ContactsCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <BookingCard title={t.booking.contactsTitle}>
      <VenueContactIcons phone={restaurant.phone} social={restaurant.social} />
      <VenueAddressRow restaurant={restaurant} />
      <MapPreview restaurant={restaurant} />
    </BookingCard>
  );
}
