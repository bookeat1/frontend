import type { Booking } from "@bookeat/api";
import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRestaurantSummary } from "../../hooks/useRestaurant";
import { formatRelativeDateTime } from "../../lib/format";
import { BookingCard } from "./BookingCard";
import { BookingStatusPill } from "./BookingStatusPill";

const t = getDictionary();

/**
 * One row of «Мои брони».
 *
 * The venue NAME is not in the list payload — `GET /bookings` returns only
 * `restaurant_id` — so it is read per card through the shared
 * `["restaurant-summary", id]` query — the ONE-request read, not the detail
 * one that also pulls reviews, menu and promos. That means one request per
 * distinct venue on screen (React Query dedupes and caches, and a FlatList
 * only mounts the visible rows), and three honest states for the name —
 * loading, failed, loaded. It is never replaced by a made-up placeholder: a booking shown
 * against the wrong venue is worse than a booking shown without one.
 */
export function BookingListCard({
  booking,
  onPress,
}: {
  booking: Booking;
  onPress: (bookingId: string) => void;
}) {
  const restaurant = useRestaurantSummary(booking.restaurantId);

  const venueName = restaurant.data?.name;
  const venueLabel = venueName
    ? venueName
    : restaurant.isError
      ? t.myBookings.venueUnavailable
      : t.myBookings.venueLoading;

  const when = formatRelativeDateTime(booking.startsAt);
  const summary = t.myBookings.summary(when, t.booking.guestsCount(booking.guests));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.myBookings.openBooking(venueLabel, when)}
      onPress={() => onPress(booking.id)}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <BookingCard>
        <View style={styles.row}>
          {/* Длинные названия обрезаются, а не выдавливают пилюлю статуса
              за край экрана на 360 px. */}
          <Text
            style={[styles.name, !venueName && styles.namePending]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {venueLabel}
          </Text>
          <BookingStatusPill status={booking.status} />
        </View>
        <Text style={styles.summary}>{summary}</Text>
      </BookingCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.9,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  name: {
    ...typography.titleSm,
    color: colors.text.primary,
    flexShrink: 1,
  },
  // The stand-in text ("Загружаем название…") is muted so it never reads as
  // the venue's actual name.
  namePending: {
    color: colors.text.muted,
  },
  summary: {
    ...typography.body,
    color: colors.text.primary,
  },
});
