import { colors, controlHeight, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import type { IconProps } from "./icons";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  /** Optional glyph rendered before the label, e.g. the circled X on the
   * Reservation screen's "Отменить бронь" (node 488:9876). Decorative — the
   * label already carries the meaning, so it is never announced separately. */
  icon?: React.ComponentType<IconProps>;
  /** `md` is the 44pt accessibility minimum used across the catalog screens;
   * `lg` is the 48pt height the booking flow's sticky CTA has in the design
   * (Figma node 471:3967). Not a new component — same pill, one number. */
  size?: "md" | "lg";
  accessibilityLabel?: string;
  /**
   * Уточнение, которое скринридер зачитывает ПОСЛЕ подписи, — «почему сейчас
   * нельзя нажать» и тому подобное. Заведено для неактивной «Продолжить» на
   * экране брони: зрячий гость видит причину строкой над кнопкой, незрячий
   * должен получить её вместе с самой кнопкой, а не только отдельным текстом
   * рядом. Смысл кнопки по-прежнему несёт `label` — подсказка его не заменяет.
   */
  accessibilityHint?: string;
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
  size = "md",
  icon: Icon,
  accessibilityLabel,
  accessibilityHint,
}: PrimaryButtonProps) {
  const isSecondary = variant === "secondary";
  const labelColor = isSecondary ? colors.text.primary : colors.text.onBrand;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === "lg" && styles.large,
        isSecondary ? styles.secondary : styles.primary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {Icon ? <Icon size={20} color={labelColor} weight="regular" /> : null}
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
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    // Gap is 0 without an icon, so this is safe for every existing caller.
    gap: spacing.sm,
  },
  large: {
    height: controlHeight.pill,
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
