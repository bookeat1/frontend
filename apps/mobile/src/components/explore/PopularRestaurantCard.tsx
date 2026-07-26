import type { AvailabilitySlot, RestaurantSummary } from "@bookeat/api";
import {
  colors,
  controlHeight,
  exploreLayout,
  radius,
  spacing,
  typography,
} from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRestaurantFavorite } from "../../hooks/useFavorites";
import { formatTime } from "../../lib/format";
import { FavoriteButton } from "./FavoriteButton";
import { EXPLORE_DEFAULT_GUESTS, useTodaySlots } from "./use-explore-data";

const t = getDictionary();

/** How many time pills fit in a 256-wide card without truncating a time. */
const VISIBLE_SLOTS = 2;

/**
 * Popular Restaurants card — REAL DATA.
 *
 * Two live sources: the venue itself (GET /restaurants?is_popular=true) and
 * today's slots for a party of two (GET /restaurants/:id/availability), one
 * request per card because the backend has no batch availability route.
 *
 * The slot row has its own four states (loading / failed / nothing free /
 * pills): the card must stay readable when availability fails, since the venue
 * data next to it is perfectly fine.
 */
export function PopularRestaurantCard({
  restaurant,
  onOpenRestaurant,
  onPickSlot,
}: {
  restaurant: RestaurantSummary;
  onOpenRestaurant: (id: string) => void;
  onPickSlot: (restaurant: RestaurantSummary, slot: AvailabilitySlot) => void;
}) {
  const slotsQuery = useTodaySlots(restaurant.id, true);
  const favorite = useRestaurantFavorite(restaurant.id);
  const cuisineLabel = restaurant.cuisines.map((cuisine) => cuisine.name).join(", ");
  const availableSlots = (slotsQuery.data?.slots ?? [])
    .filter((slot) => slot.available)
    .slice(0, VISIBLE_SLOTS);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cuisineLabel ? `${restaurant.name}, ${cuisineLabel}` : restaurant.name}
        onPress={() => onOpenRestaurant(restaurant.id)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View>
          <Image
            source={{ uri: restaurant.coverPhoto.uri }}
            style={styles.photo}
            contentFit="cover"
            transition={150}
            accessibilityLabel={restaurant.coverPhoto.alt}
          />
          <FavoriteButton
            itemName={restaurant.name}
            isFavorite={favorite.isFavorite}
            onToggle={favorite.toggle}
          />
        </View>

        <View style={styles.text}>
          {/* Длинные русские названия обрезаем, а не ломаем карточку. */}
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {restaurant.name}
          </Text>
          {cuisineLabel ? (
            <Text style={styles.cuisine} numberOfLines={1} ellipsizeMode="tail">
              {cuisineLabel}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {/* Одна и та же строка: обычно это «Сегодня · 2 гостя», а если запрос в
          избранное упал — сообщение об этом. Отдельная строка под ошибку
          меняла бы высоту карточки в горизонтальной ленте. */}
      {favorite.failed ? (
        <Text style={styles.metaError} accessibilityRole="alert" numberOfLines={2}>
          {t.favorites.toggleFailed}
        </Text>
      ) : (
        <Text style={styles.meta}>{t.explore.todayGuests(EXPLORE_DEFAULT_GUESTS)}</Text>
      )}

      <SlotRow
        isLoading={slotsQuery.isLoading}
        isError={slotsQuery.isError}
        slots={availableSlots}
        restaurantName={restaurant.name}
        onRetry={() => slotsQuery.refetch()}
        onPick={(slot) => onPickSlot(restaurant, slot)}
      />
    </View>
  );
}

function SlotRow({
  isLoading,
  isError,
  slots,
  restaurantName,
  onRetry,
  onPick,
}: {
  isLoading: boolean;
  isError: boolean;
  slots: AvailabilitySlot[];
  restaurantName: string;
  onRetry: () => void;
  onPick: (slot: AvailabilitySlot) => void;
}) {
  if (isLoading) {
    // Skeleton pills, not a spinner: the row keeps its height so the card
    // below does not jump when the answer arrives.
    return (
      <View style={styles.slotRow} accessibilityRole="progressbar">
        <View style={styles.slotSkeleton} />
        <View style={styles.slotSkeleton} />
      </View>
    );
  }

  if (isError) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.explore.slotsFailed}
        onPress={onRetry}
        style={styles.slotRow}
        hitSlop={10}
      >
        <Text style={styles.slotFallback}>{t.explore.slotsFailed}</Text>
      </Pressable>
    );
  }

  if (slots.length === 0) {
    return (
      <View style={styles.slotRow}>
        <Text style={styles.slotFallback}>{t.explore.slotsUnavailable}</Text>
      </View>
    );
  }

  return (
    <View style={styles.slotRow}>
      {slots.map((slot) => {
        const label = formatTime(slot.startsAt);
        return (
          <Pressable
            key={slot.startsAt}
            accessibilityRole="button"
            accessibilityLabel={t.explore.bookAt(restaurantName, label)}
            onPress={() => onPick(slot)}
            // 28pt pill + 8pt slop each side clears the 44pt target rule.
            hitSlop={8}
            style={({ pressed }) => [styles.slot, pressed && styles.pressed]}
          >
            <Text style={styles.slotLabel}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: exploreLayout.cardWidth,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
  },
  photo: {
    width: exploreLayout.cardWidth,
    height: exploreLayout.cardPhotoHeight,
    borderRadius: radius.media,
    backgroundColor: colors.background.bannerPlaceholder,
  },
  text: {
    gap: spacing.xxs,
    paddingTop: spacing.sm,
  },
  name: {
    ...typography.titleSm,
    color: colors.text.primary,
  },
  cuisine: {
    ...typography.body,
    color: colors.text.primary,
  },
  meta: {
    ...typography.body,
    color: colors.text.muted,
  },
  metaError: {
    ...typography.body,
    color: colors.status.negativeText,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: controlHeight.compactPill,
  },
  slot: {
    height: controlHeight.compactPill,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
  },
  slotLabel: {
    ...typography.labelSemiBold,
    color: colors.text.onBrand,
  },
  slotSkeleton: {
    height: controlHeight.compactPill,
    width: 76,
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
  slotFallback: {
    ...typography.body,
    color: colors.text.muted,
    flexShrink: 1,
  },
});
