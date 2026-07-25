import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Minus, Plus } from "./icons";

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Rendered in the middle, e.g. "4 гостя". */
  valueLabel: string;
  decreaseLabel: string;
  increaseLabel: string;
}

/**
 * Numeric −/+ control for the guests picker. Both buttons are full 44pt
 * targets and go properly disabled at the bounds (not just visually dimmed),
 * so a screen reader announces "недоступно" instead of a button that does
 * nothing.
 */
export function Stepper({
  value,
  min,
  max,
  onChange,
  valueLabel,
  decreaseLabel,
  increaseLabel,
}: StepperProps) {
  const canDecrease = value > min;
  const canIncrease = value < max;
  return (
    <View style={styles.root} accessibilityRole="adjustable" accessibilityValue={{ text: valueLabel }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={decreaseLabel}
        accessibilityState={{ disabled: !canDecrease }}
        disabled={!canDecrease}
        onPress={() => onChange(value - 1)}
        style={({ pressed }) => [
          styles.button,
          !canDecrease && styles.buttonDisabled,
          pressed && canDecrease && styles.pressed,
        ]}
      >
        <Minus size={20} color={colors.text.primary} weight="bold" />
      </Pressable>
      <Text style={styles.value}>{valueLabel}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={increaseLabel}
        accessibilityState={{ disabled: !canIncrease }}
        disabled={!canIncrease}
        onPress={() => onChange(value + 1)}
        style={({ pressed }) => [
          styles.button,
          !canIncrease && styles.buttonDisabled,
          pressed && canIncrease && styles.pressed,
        ]}
      >
        <Plus size={20} color={colors.text.primary} weight="bold" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
  },
  button: {
    width: hitSlop.minTouchTarget,
    height: hitSlop.minTouchTarget,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.chip,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
  value: {
    ...typography.titleMd,
    color: colors.text.primary,
    flex: 1,
    textAlign: "center",
  },
});
