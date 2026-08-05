import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Segment<T> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T> {
  segments: Segment<T>[];
  /** Currently chosen segment — compared to each `segment.value` by identity. */
  value: T;
  onChange: (value: T) => void;
  /** Spoken role of the whole control (e.g. «Ценовая категория»); each segment
   * announces its own label + selected state. */
  accessibilityLabel: string;
}

/**
 * A single-select segmented control on a light track: the chosen segment
 * fills brand-red with white text, the rest stay transparent with dark text
 * (read off the Filters-sheet reference PNG — the «Все | ₸ | ₸₸ | ₸₸₸» row).
 * Segments share the width equally (`flex: 1`), so the four price steps line
 * up even on a 360px screen. Kept generic on the value type so it maps
 * straight onto `PriceLevel | undefined` without stringly-typed glue.
 */
export function SegmentedControl<T>({
  segments,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.track} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {segments.map((segment, index) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={index}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={segment.label}
            onPress={() => onChange(segment.value)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && !selected && styles.pressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.background.chip,
    borderRadius: radius.pill,
    padding: spacing.xxs,
    gap: spacing.xxs,
  },
  segment: {
    flex: 1,
    minHeight: hitSlop.minTouchTarget,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  segmentSelected: {
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
    color: colors.text.onBrand,
  },
});
