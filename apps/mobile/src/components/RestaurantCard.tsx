import type { RestaurantSummary } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const t = getDictionary();

interface RestaurantCardProps {
  restaurant: RestaurantSummary;
  onPress: (id: string) => void;
}

const IMAGE_HEIGHT = 148;

/**
 * Search-result card — matches Figma nodes 347:5716–347:5730. The design has
 * no rating/star and no status badge overlaid on the photo: open/closed is a
 * plain text line under the name, and cuisine + price render as chips below
 * the description.
 */
export function RestaurantCard({ restaurant, onPress }: RestaurantCardProps) {
  const cuisineLabel = restaurant.cuisines.map((c) => c.name).join(", ");
  // Раньше рядом со статусом стояло расстояние («Открыто · 3.4 км»),
  // посчитанное из хеша id заведения. Ни геопозиции гостя, ни расстояния в API
  // нет — строка теперь говорит только то, что мы действительно знаем.
  const statusLabel = restaurant.isOpenNow ? t.restaurant.openNow : t.restaurant.closedNow;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${restaurant.name}, ${cuisineLabel}`}
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
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {restaurant.name}
        </Text>
        <Text style={styles.status}>{statusLabel}</Text>
        <View style={styles.chipsRow}>
          {/* У части заведений в каталоге cuisine_type пустой — тогда чипа
              просто нет, вместо пустого серого прямоугольника. */}
          {cuisineLabel ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{cuisineLabel}</Text>
            </View>
          ) : null}
          <View style={styles.chip}>
            {/* NOTE: the mockup shows a tenge price range chip ("12 000-20 000 ₸");
                the schema only carries a symbolic tier, which the app now
                renders in the backend's own alphabet (₸/₸₸/₸₸₸) instead of the
                dollars it used to show. The range itself is still a schema gap. */}
            <Text style={styles.chipText}>{restaurant.priceLevel}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  pressed: {
    opacity: 0.9,
  },
  image: {
    width: "100%",
    height: IMAGE_HEIGHT,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  name: {
    ...typography.titleSm,
    color: colors.text.primary,
  },
  status: {
    ...typography.body,
    color: colors.text.primary,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  chip: {
    backgroundColor: colors.background.chipAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  chipText: {
    ...typography.captionMedium,
    color: colors.text.mutedStrong,
  },
});
