import type { Cuisine } from "@bookeat/api";
import { colors, exploreLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { PhotoView } from "../PhotoView";
import { cuisinePhoto } from "./cuisine-photos";

const t = getDictionary();

/**
 * One circular cuisine chip in the «Выберите кухню» rail. Tapping it opens the
 * catalog filtered to that cuisine (see the home screen's onPickCuisine).
 *
 * The picture is a BUNDLED asset (see cuisine-photos.ts), not a remote url —
 * there is still no per-cuisine image endpoint, and a local file needs no
 * caching, resizing or 404 handling, which is what PhotoView exists for. A
 * cuisine we have no picture for keeps that neutral placeholder circle.
 *
 * TODO(backend): when an image endpoint lands, drop the bundle and pass the
 * url to PhotoView instead.
 */
export function CuisineChip({
  cuisine,
  onSelect,
}: {
  cuisine: Cuisine;
  onSelect: (cuisine: Cuisine) => void;
}) {
  const photo = cuisinePhoto(cuisine.id);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.explore.cuisineFilter(cuisine.name)}
      onPress={() => onSelect(cuisine)}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      {photo ? (
        <Image
          source={photo}
          style={styles.circle}
          contentFit="cover"
          // Decorative: the label under the circle already names the cuisine,
          // and the pressable carries the full accessibility label.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : (
        <PhotoView
          uri={undefined}
          style={styles.circle}
          decorative
          placeholderIconSize={28}
        />
      )}
      <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
        {cuisine.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: exploreLayout.cuisineChip,
    alignItems: "center",
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  circle: {
    width: exploreLayout.cuisineChip,
    height: exploreLayout.cuisineChip,
    borderRadius: radius.pill,
    backgroundColor: colors.background.bannerPlaceholder,
  },
  label: {
    ...typography.caption,
    color: colors.text.primary,
    textAlign: "center",
    width: "100%",
  },
});
