import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { MagnifyingGlass } from "../icons";
import { exploreCopy } from "./copy";

/**
 * The search pill on Explore. It LOOKS like the shared `SearchBar` but is a
 * button, not an input: on this screen tapping it opens the catalog/search
 * screen, which owns the real `TextInput` and its keyboard. Rendering a second
 * live input here would mean two components fighting over focus after
 * navigation, and a keyboard that pops up over the hero for nothing.
 *
 * Announced as a button with the placeholder as its label, so a screen reader
 * says "Заведение, кухня или блюдо, кнопка" instead of pretending to be a
 * text field.
 */
export function ExploreSearchField({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={exploreCopy.searchPlaceholder}
      onPress={onPress}
      style={({ pressed }) => [styles.field, pressed && styles.pressed]}
    >
      <MagnifyingGlass size={24} color={colors.text.muted} weight="regular" />
      <Text style={styles.placeholder} numberOfLines={1}>
        {exploreCopy.searchPlaceholder}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: controlHeight.pill,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.chipAlt,
    borderRadius: radius.pill,
  },
  placeholder: {
    ...typography.body,
    color: colors.text.muted,
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
