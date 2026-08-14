import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import type { IconProps } from "./icons";

interface ToggleRowProps {
  icon: React.ComponentType<IconProps>;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

/**
 * A settings row whose control is a switch, not a navigation chevron. Mirrors
 * SelectRow's chip layout (leading icon, label, rounded chip background) but
 * swaps the tappable value/chevron for React Native's built-in Switch on the
 * right — the whole row is a real on/off control, not a link to a screen. Used
 * for genuinely stored preferences (e.g. push notifications).
 */
export function ToggleRow({ icon: Icon, label, value, onValueChange }: ToggleRowProps) {
  return (
    <View style={styles.root}>
      <Icon size={24} color={colors.text.primary} weight="regular" />
      {/* A long Russian label ("Уведомления") wraps to two lines rather than
          shoving the switch off a 360px screen. */}
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        trackColor={{ false: colors.background.secondaryButton, true: colors.brand.primary }}
        thumbColor={colors.background.surface}
        ios_backgroundColor={colors.background.secondaryButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: hitSlop.minTouchTarget + spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    // Без подложки: единственная серая плашка на белом листе настроек читалась
    // как выделенная строка, хотя выделять её нечем — она такая же, как
    // соседние (макет 906:10384).
    backgroundColor: colors.background.surface,
  },
  label: {
    ...typography.labelMedium,
    color: colors.text.primary,
    // Takes the free space so the switch pins to the right edge.
    flex: 1,
  },
});
