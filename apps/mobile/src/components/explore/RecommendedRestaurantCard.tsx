import type { RestaurantSummary } from "@bookeat/api";
import { colors, exploreLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRestaurantFavorite } from "../../hooks/useFavorites";
import { cuisineLine } from "../../lib/cuisine-display";
import { PhotoView } from "../PhotoView";
import { FavoriteButton } from "./FavoriteButton";

/**
 * «Выбрали для вас» card — REAL DATA (GET /restaurants?is_popular=true).
 *
 * The rebuilt home design draws this section as plain photo + name + cuisine
 * cards, with NO availability time pills — firing one availability request per
 * visible card on the very first screen after a cold start was a cost the new
 * design doesn't ask for. The favourite heart IS in the reference here, so it
 * sits on the photo's top-right, wired the SAME way as every other venue card
 * (useRestaurantFavorite → real `/favorites` endpoint, optimistic in-flight
 * state, sign-in gate for guests). The rest of the card opens the venue.
 */
export function RecommendedRestaurantCard({
  restaurant,
  onOpenRestaurant,
}: {
  restaurant: RestaurantSummary;
  onOpenRestaurant: (id: string) => void;
}) {
  // Карточка шириной в 160 — чипам тут места нет, поэтому набор кухонь
  // остаётся одной строкой в порядке заведения (главная первой) и обрезается
  // по ширине. Полный набор виден в списке поиска и на карточке заведения.
  const cuisineLabel = cuisineLine(restaurant.cuisines);
  const favorite = useRestaurantFavorite(restaurant.id);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cuisineLabel ? `${restaurant.name}, ${cuisineLabel}` : restaurant.name}
      onPress={() => onOpenRestaurant(restaurant.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View>
        <PhotoView
          uri={restaurant.coverPhoto?.uri}
          style={styles.photo}
          size="tile"
          decorative
          placeholderIconSize={32}
        />
        {/* Heart lives on top of the photo, not inside the card Pressable's
            press area: a tap on it toggles the favourite instead of opening
            the venue. */}
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
  },
  name: {
    ...typography.titleSm,
    color: colors.text.primary,
  },
  cuisine: {
    ...typography.body,
    color: colors.text.muted,
  },
});
