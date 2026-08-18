import type { Booking, Restaurant } from "@bookeat/api";
import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { formatRelativeDay, formatTime } from "../../lib/format";
import { PhotoView } from "../PhotoView";
import { BookingCard } from "./BookingCard";
import { BookingStatusPill } from "./BookingStatusPill";

const t = getDictionary();

/**
 * Top card of the Reservation detail screen (Figma node 488:9876): the venue
 * photo as a 72x72 rounded square, the venue name, the one-line summary
 * ("Сегодня · 14:00 · 2 гостя") and the status pill — all centred, all flush
 * with the top bar (only the bottom corners are rounded).
 *
 * `restaurant` is optional: the booking loads from its own endpoint and the
 * venue from another, so the header must still be truthful while the venue
 * request is in flight or has failed. In that case the photo slot renders as
 * a neutral placeholder and the name falls back to the name ON THE BOOKING's
 * own venue id being unknown — see the caller, which passes the venue name
 * only when it has one.
 */
export function ReservationHeaderCard({
  booking,
  restaurant,
  actions,
}: {
  booking: Booking;
  restaurant?: Restaurant;
  /** Ряд кнопок под статусом. Их рисует экран: он знает, можно ли отменить. */
  actions?: React.ReactNode;
}) {
  const photoUri = restaurant?.coverPhoto?.uri;
  const summary = t.booking.reservationSummary(
    formatRelativeDay(booking.startsAt),
    formatTime(booking.startsAt),
    t.booking.guestsCount(booking.guests),
  );

  return (
    <BookingCard corners="bottom" align="center" style={styles.card}>
      {/* 72pt — слишком мало для иконки, поэтому «фото нет» и «фото не
          загрузилось» здесь одинаково выглядят как ровный нейтральный
          квадрат, ровно как выглядели раньше. Название заведения стоит
          прямо под ним. */}
      <PhotoView uri={photoUri} style={styles.avatar} size="tile" decorative placeholderIcon={false} />

      {restaurant?.name ? (
        // Long RU venue names are real ("Fusion Rooftop на очень-очень длинной
        // улице"); two lines then ellipsis keeps the pill on screen.
        <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">
          {restaurant.name.trim()}
        </Text>
      ) : null}

      <Text style={styles.summary}>{summary}</Text>

      <BookingStatusPill status={booking.status} />

      {/* Действия над бронью стоят ЗДЕСЬ, внутри той же карточки под статусом
          (макет 918:12776), а не отдельным блоком: это действия над этой
          бронью, и просвет между статусом и ними разрывал бы одну мысль. */}
      {actions}
    </BookingCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  avatar: {
    width: controlHeight.venueAvatar,
    height: controlHeight.venueAvatar,
    borderRadius: radius.avatar,
    backgroundColor: colors.background.bannerPlaceholder,
    marginBottom: spacing.xs,
  },
  name: {
    ...typography.titleXl,
    color: colors.text.primary,
    textAlign: "center",
  },
  summary: {
    ...typography.body,
    color: colors.text.mutedStrong,
    textAlign: "center",
  },
});
