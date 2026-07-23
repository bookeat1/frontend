import type { RestaurantSummary } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Rating } from "./Rating";

const t = getDictionary();

interface RestaurantCardProps {
  restaurant: RestaurantSummary;
  onPress: (id: string) => void;
}

/**
 * Compact card used in search results / popular lists. Restaurant names are
 * clamped to 2 lines with ellipsis so a long Russian name (e.g. "Fusion
 * Rooftop на очень-очень длинной улице имени Абылай хана") never breaks the
 * row height or pushes the price/rating off screen.
 */
export function RestaurantCard({ restaurant, onPress }: RestaurantCardProps) {
  const cuisineLabel = restaurant.cuisines.map((c) => c.name).join(", ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${restaurant.name}, ${cuisineLabel}, ${restaurant.rating.toFixed(1)}`}
      onPress={() => onPress(restaurant.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Image
        source={{ uri: restaurant.coverPhoto.uri }}
        style={styles.image}
        contentFit="cover"
        accessibilityLabel={restaurant.coverPhoto.alt}
        transition={150}
      />
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>
          {restaurant.isOpenNow ? t.restaurant.openNow : t.restaurant.closedNow}
        </Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">
          {restaurant.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
          {t.restaurant.cuisineAndPrice(cuisineLabel, restaurant.priceLevel)}
        </Text>
        <View style={styles.footer}>
          <Rating value={restaurant.rating} reviewsCount={restaurant.reviewsCount} />
          {restaurant.distanceMeters !== undefined ? (
            <Text style={styles.distance}>
              {restaurant.distanceMeters < 1000
                ? `${restaurant.distanceMeters} м`
                : `${(restaurant.distanceMeters / 1000).toFixed(1)} км`}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const IMAGE_HEIGHT = 160;

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[0],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  pressed: {
    opacity: 0.9,
  },
  image: {
    width: "100%",
    height: IMAGE_HEIGHT,
    backgroundColor: colors.neutral[100],
  },
  statusBadge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.overlay.scrim,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  statusText: {
    ...typography.captionMedium,
    color: colors.neutral[0],
  },
  body: {
    padding: spacing.md,
    gap: spacing.xxs,
  },
  name: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  meta: {
    ...typography.body,
    color: colors.neutral[500],
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  distance: {
    ...typography.caption,
    color: colors.neutral[500],
  },
});
