import { colors, hitSlop, radius, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
}

/**
 * Matches the search-screen filter chip: unselected chips sit on the light
 * `chipAlt` fill, the selected chip inverts to a solid black pill with white
 * text (Figma nodes 347:5773–347:5778) — there is no brand-red selected
 * state on this screen.
 */
export function FilterChip({ label, selected = false, onPress }: FilterChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
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
