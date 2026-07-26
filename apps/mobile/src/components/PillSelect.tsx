import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CaretDown, type IconProps } from "./icons";

interface PillSelectProps {
  icon: React.ComponentType<IconProps>;
  /** The current choice, e.g. "Сегодня" or "2 гостя". */
  value: string;
  /** Spoken label — the pill itself only shows the value, so the role of the
   * control ("Дата", "Гости") has to be announced separately. */
  accessibilityLabel: string;
  onPress: () => void;
}

/**
 * The 48pt grey pill that opens the date / guests picker on the Reservation
 * screen — Figma node 471:3899. Two of them sit in a `flex: 1` row, so both
 * halves stay equal even when the Russian value is long ("28 июля", "12 гостей");
 * the value itself shrinks to one line rather than pushing the caret out.
 */
export function PillSelect({ icon: Icon, value, accessibilityLabel, onPress }: PillSelectProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <Icon size={24} color={colors.text.primary} weight="regular" />
      <View style={styles.valueBox}>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {value}
        </Text>
      </View>
      <CaretDown size={16} color={colors.text.primary} weight="regular" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: controlHeight.pill,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.background.screen,
  },
  pressed: {
    opacity: 0.7,
  },
  valueBox: {
    flex: 1,
  },
  value: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
});
