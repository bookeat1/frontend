import { colors, hitSlop, radius, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  /**
   * Colour of the SELECTED state. `dark` is the search-results filter row
   * (solid black pill) — the default, so every existing call site is
   * unchanged. `brand` is the brand-red pill the Filters bottom-sheet uses for
   * its occasion / cuisine chips (read off the sheet reference PNG). Same
   * component, one number — not a second chip.
   */
  selectedTone?: "dark" | "brand";
}

/**
 * Matches the search-screen filter chip: unselected chips sit on the light
 * `chipAlt` fill, the selected chip inverts to a solid pill with white text.
 * On the search-results row that pill is black (Figma nodes 347:5773–347:5778);
 * inside the Filters sheet it is brand-red (`selectedTone="brand"`).
 */
export function FilterChip({
  label,
  selected = false,
  onPress,
  selectedTone = "dark",
}: FilterChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && (selectedTone === "brand" ? styles.chipSelectedBrand : styles.chipSelected),
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: hitSlop.minTouchTarget,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.background.chipAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: {
    backgroundColor: colors.background.chipActive,
  },
  chipSelectedBrand: {
    backgroundColor: colors.brand.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  labelSelected: {
    color: colors.text.onDark,
  },
});
