import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check } from "../icons";

interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

/**
 * A label with a SQUARE checkbox pinned to the right — the «Удобства» rows in
 * the Filters sheet (Терраса / Халал / …). Distinct from `OptionRow`, which
 * draws a round `CheckCircle` for "pick one from a list": here every row is an
 * independent multi-select toggle, so it is a checkbox, and the box fills
 * brand-red with a white tick when on (read off the sheet reference PNG).
 */
export function CheckboxRow({ label, checked, onToggle }: CheckboxRowProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      {/* Long Russian labels («Молельная комната») wrap; the box stays right. */}
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Check size={16} color={colors.text.onBrand} weight="bold" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: hitSlop.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...typography.body,
    color: colors.text.primary,
    flexShrink: 1,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.media / 3,
    borderWidth: 1.5,
    borderColor: colors.border.control,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
});
