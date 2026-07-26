import { colors, exploreLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { InertFavoriteHeart } from "./FavoriteButton";
import type { DishCardData } from "./placeholder";

/**
 * Dish card used by BOTH "Chef's Picks" and "Gastroguide" — the reference
 * draws them identically, so they share one component and differ only in the
 * data they are handed.
 *
 * DATA IS PLACEHOLDER (no cross-venue dish endpoint) — see ./placeholder.ts.
 * The card is otherwise final: when a real endpoint lands, only the mapper
 * changes.
 *
 * The whole card is a button only when the dish knows its venue; a placeholder
 * dish has `restaurantId: null`, and a card that navigates nowhere must not
 * pretend to be tappable.
 */
export function DishCard({
  dish,
  onOpenRestaurant,
}: {
  dish: DishCardData;
  onOpenRestaurant: (restaurantId: string) => void;
}) {
  const body = (
    <>
      <View>
        <Image
          source={{ uri: dish.imageUrl }}
          style={styles.photo}
          contentFit="cover"
          transition={150}
          accessibilityLabel={dish.name}
        />
        <InertFavoriteHeart />
      </View>

      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {dish.name}
        </Text>
        {/* Ровно две строки описания, как в макете: третья строка ломает
            высоту ряда, а обрезка по слову оставляет карточку читаемой. */}
        <Text style={styles.description} numberOfLines={2} ellipsizeMode="tail">
          {dish.description}
        </Text>
        <Text style={styles.price}>{dish.price}</Text>
      </View>
    </>
  );

  if (!dish.restaurantId) {
    return <View style={styles.card}>{body}</View>;
  }

  const restaurantId = dish.restaurantId;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${dish.name}, ${dish.price}`}
      onPress={() => onOpenRestaurant(restaurantId)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {body}
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
  description: {
    ...typography.body,
    color: colors.text.primary,
  },
  price: {
    ...typography.titleSm,
    color: colors.text.primary,
    paddingTop: spacing.xs,
  },
});
