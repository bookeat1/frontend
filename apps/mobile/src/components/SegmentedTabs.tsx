import { colors, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface SegmentedTabsProps {
  labels: string[];
  activeIndex: number;
  onChange: (index: number) => void;
}

/**
 * Underlined tab row — used both for "Обзор / Фото" on the restaurant card
 * (Figma 340:2569–340:2572) and "Все / Еда / Интерьер" on the photo gallery
 * (Figma 340:2373–340:2379).
 */
export function SegmentedTabs({ labels, activeIndex, onChange }: SegmentedTabsProps) {
  return (
    <View style={styles.row}>
      {labels.map((label, index) => {
        const active = index === activeIndex;
        return (
          <Pressable
            key={label}
            onPress={() => onChange(index)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  tab: {
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.text.primary,
  },
  label: {
    ...typography.body,
    color: colors.text.muted,
  },
  labelActive: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
});
