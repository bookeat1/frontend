import { colors, hitSlop, radius, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  accessibilityLabel?: string;
}

/**
 * The single button primitive for the app. Never build a bespoke
 * TouchableOpacity+Text button in a screen — extend this component instead.
 * `primary` matches "Забронировать стол" (brand red pill, white label);
 * `secondary` matches "Посмотреть меню" (neutral grey pill, dark label).
 */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  variant = "primary",
  accessibilityLabel,
}: PrimaryButtonProps) {
  const isSecondary = variant === "secondary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isSecondary ? styles.secondary : styles.primary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.label, isSecondary && styles.labelSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: hitSlop.minTouchTarget,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    flexDirection: "row",
  },
  primary: {
    backgroundColor: colors.brand.primary,
  },
  secondary: {
    backgroundColor: colors.background.secondaryButton,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    ...typography.labelSemiBold,
    color: colors.text.onBrand,
  },
  labelSecondary: {
    color: colors.text.primary,
  },
});
