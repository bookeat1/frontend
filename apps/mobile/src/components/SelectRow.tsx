import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CaretRight, type IconProps } from "./icons";

interface SelectRowProps {
  icon: React.ComponentType<IconProps>;
  label: string;
  /** The chosen value. Falls back to `placeholder` styling when empty. */
  value: string;
  placeholder?: string;
  onPress: () => void;
  /** Optional muted second line, e.g. the pre-order total. */
  caption?: string;
}

/**
 * A tappable settings-style row: icon, label, current value, chevron. Used for
 * "Дата", "Гости" and "Предзаказ" on the reservation screen — each opens its
 * own screen rather than expanding inline, which keeps the reservation screen
 * short enough to fit a 360x640 device without scrolling past the CTA.
 */
export function SelectRow({ icon: Icon, label, value, placeholder, onPress, caption }: SelectRowProps) {
  const hasValue = value.trim().length > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${hasValue ? value : (placeholder ?? "")}`}
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <Icon size={24} color={colors.text.primary} weight="regular" />
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {/* Long Russian values ("Понедельник, 28 июля") wrap to two lines
            rather than being clipped — the row grows, the chevron stays put. */}
        <Text style={hasValue ? styles.value : styles.placeholder}>
          {hasValue ? value : (placeholder ?? "")}
        </Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
      <CaretRight size={20} color={colors.text.muted} weight="regular" />
    </Pressable>
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
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  label: {
    ...typography.caption,
    color: colors.text.mutedStrong,
  },
  value: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
  placeholder: {
    ...typography.labelMedium,
    color: colors.text.muted,
  },
  caption: {
    ...typography.caption,
    color: colors.text.muted,
  },
});
