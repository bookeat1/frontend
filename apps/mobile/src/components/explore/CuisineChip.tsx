import type { Cuisine } from "@bookeat/api";
import { colors, exploreLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * One circular cuisine chip in the «Выберите кухню» rail. Tapping it opens the
 * catalog filtered to that cuisine (see the home screen's onPickCuisine).
 *
 * TODO(backend): the circle is the app's neutral photo placeholder for now —
 * there is no per-cuisine image endpoint. When one lands, pass its url as the
 * PhotoView `uri` and this component is unchanged otherwise.
 */
export function CuisineChip({
  cuisine,
  onSelect,
}: {
  cuisine: Cuisine;
  onSelect: (cuisine: Cuisine) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.explore.cuisineFilter(cuisine.name)}
      onPress={() => onSelect(cuisine)}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <PhotoView
        uri={undefined}
        style={styles.circle}
        decorative
        placeholderIconSize={28}
      />
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
