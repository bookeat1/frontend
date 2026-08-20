import type { Booking } from "@bookeat/api";
import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRestaurantSummary } from "../../hooks/useRestaurant";
import { formatRelativeDateTime } from "../../lib/format";
import { MapPin, User } from "../icons";
import { PhotoView } from "../PhotoView";
import { BookingStatusPill } from "./BookingStatusPill";

const t = getDictionary();

/**
 * One row of «Мои брони» (Figma dVjT37j984ErvOmzxlx29p, node 3004:6807).
 *
 * Серая карточка со скруглением 24: квадратная фотография заведения 64x64
 * слева, название над КРУПНОЙ строкой «когда», пилюля статуса в правом
 * верхнем углу, ниже две строки с иконками — число гостей и адрес.
 *
 * Ни названия, ни фотографии, ни адреса в ответе `GET /bookings` нет — он
 * несёт только `restaurant_id` (см. комментарий к `BookingPage` в
 * `packages/api`). Всё это читается тем же запросом-сводкой
 * `["restaurant-summary", id]`, что и раньше — один дешёвый `GET
 * /restaurants/:id` на КАЖДОЕ РАЗНОЕ заведение на экране (React Query
 * дедуплицирует и кэширует, а FlatList монтирует только видимые строки).
 * Нового запроса ради адреса не заводили: адрес приезжает тем же ответом,
 * что и название.
 *
 * Пока сводка не пришла (или упала), название честно подменяется служебной
 * строкой, а строка адреса и фотография просто не рисуются: бронь, показанная
 * с чужим адресом, хуже брони без адреса.
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
  const address = restaurant.data?.address;

  const when = formatRelativeDateTime(booking.startsAt);
  const guests = t.booking.guestsCount(booking.guests);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.myBookings.openBooking(venueLabel, when)}
      onPress={() => onPress(booking.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.headerRow}>
        <View style={styles.identity}>
          <PhotoView
            uri={restaurant.data?.coverPhoto?.uri}
            style={styles.thumb}
            size="tile"
            decorative
            placeholderIconSize={24}
          />
          <View style={styles.titles}>
            {/* Длинное русское название обрезается, а не выдавливает пилюлю
                статуса за край экрана на 360 px. */}
            <Text
              style={[styles.name, !venueName && styles.namePending]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {venueLabel}
            </Text>
            {/* Дата переносится на вторую строку, а не обрезается: по-русски
                «29 июля, 20:30» в 20 pt шире колонки, которую макет отводит
                под английское «July 29, 20:30». Обрезанная дата бесполезна,
                карточка на 28 px выше — терпимо. */}
            <Text style={styles.when} numberOfLines={2}>
              {when}
            </Text>
          </View>
        </View>
        <BookingStatusPill status={booking.status} size="compact" />
      </View>

      <View style={styles.facts}>
        <View style={styles.fact}>
          <User size={FACT_ICON_SIZE} color={FACT_ICON_COLOR} weight="regular" />
          <Text style={styles.factText} numberOfLines={1}>
            {guests}
          </Text>
        </View>
        {address ? (
          <View style={styles.fact}>
            <MapPin size={FACT_ICON_SIZE} color={FACT_ICON_COLOR} weight="regular" />
            {/* Адрес — единственная строка карточки, которой позволено занять
                две: в Алматы это «проспект Аль-Фараби, 128В, БЦ Esentai». */}
            <Text style={styles.factText} numberOfLines={2}>
              {address}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Глифы строк «гости» и «адрес» — 20x20 (node 3004:6818 / 3004:6821). */
const FACT_ICON_SIZE = 20;
/** Сам глиф в макете светлее подписи рядом: #A5A5A5 против #1B1B1B (снято
 * пипеткой с рендера узла 3004:6781). Иконка тут помощник, а не смысл —
 * смысл несёт текст, и он остаётся тёмным. */
const FACT_ICON_COLOR = colors.text.muted;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.screen,
    borderRadius: radius.bookingCard,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  pressed: {
    opacity: 0.9,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  identity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  thumb: {
    width: controlHeight.bookingVenueThumb,
    height: controlHeight.bookingVenueThumb,
    borderRadius: radius.card,
  },
  titles: {
    flex: 1,
  },
  name: {
    ...typography.titleMd,
    color: colors.text.strong,
  },
  // Служебная подмена («Загружаем название…») приглушена, чтобы её нельзя
  // было прочитать как настоящее название заведения.
  namePending: {
    color: colors.text.muted,
  },
  when: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  facts: {
    gap: spacing.sm,
  },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  factText: {
    ...typography.body,
    color: colors.text.primary,
    flexShrink: 1,
  },
});
