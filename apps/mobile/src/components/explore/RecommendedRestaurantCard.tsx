import type { RestaurantSummary } from "@bookeat/api";
import { colors, exploreLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PhotoView } from "../PhotoView";

/**
 * «Выбрали для вас» card — REAL DATA (GET /restaurants?is_popular=true).
 *
 * The rebuilt home design draws this section as plain photo + name + cuisine
 * cards, with NO availability time pills and NO favourite heart (unlike the old
 * PopularRestaurantCard). Removed, not hidden: firing one availability request
 * per visible card on the very first screen after a cold start was a cost the
 * new design doesn't ask for, and the heart is absent from the reference here.
 * The whole card opens the venue, where booking and favouriting live.
 */
export function RecommendedRestaurantCard({
  restaurant,
  onOpenRestaurant,
}: {
  restaurant: RestaurantSummary;
  onOpenRestaurant: (id: string) => void;
}) {
  const cuisineLabel = restaurant.cuisines.map((cuisine) => cuisine.name).join(", ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cuisineLabel ? `${restaurant.name}, ${cuisineLabel}` : restaurant.name}
      onPress={() => onOpenRestaurant(restaurant.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <PhotoView
        uri={restaurant.coverPhoto?.uri}
        style={styles.photo}
        size="tile"
        decorative
        placeholderIconSize={32}
      />
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
