import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CheckCircle, type IconProps } from "./icons";

interface OptionRowProps {
  label: string;
  /** Currently chosen — draws the check on the right. */
  selected: boolean;
  onPress: () => void;
  /** Optional muted second line (e.g. the locale code, a region). */
  caption?: string;
  /** Optional leading glyph. Omitted for a bare "pick one from a list" row. */
  icon?: React.ComponentType<IconProps>;
  /**
   * ARIA role. `radio` for a mutually-exclusive list (one language, one city);
   * `checkbox` for an independent toggle (the delete-account confirmation).
   * Defaults to `radio` — the list case this row exists for.
   */
  role?: "radio" | "checkbox";
  /**
   * Оформление строки:
   *   "card"  — серая плашка (город, подтверждение удаления) — как было;
   *   "plain" — строка на белом с радио-кнопкой справа и красным названием
   *             выбранного, как в макете экрана языка.
   * Новый вариант введён отдельным значением, а не заменой: этой строкой
   * пользуются три экрана, и менять вид всем ради одного — это чинить один
   * экран и ломать два.
   */
  variant?: "card" | "plain";
}

/**
 * A tappable "pick from a list" row: optional icon, label, and a check on the
 * right when it is the chosen one. Distinct from `SelectRow`, which is a
 * NAVIGATION row (chevron, "opens another screen") — this one is a terminal
 * SELECTION and announces its state to a screen reader.
 *
 * Reused by the language picker, the city picker and the delete-account
 * confirmation, so there is exactly one selectable-row primitive rather than
 * three bespoke Pressables.
 */
export function OptionRow({
  label,
  selected,
  onPress,
  caption,
  icon: Icon,
  role = "radio",
  variant = "card",
}: OptionRowProps) {
  const plain = variant === "plain";
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.root, plain && styles.rootPlain, pressed && styles.pressed]}
    >
      {Icon ? <Icon size={24} color={colors.text.primary} weight="regular" /> : null}
      <View style={styles.text}>
        {/* Long Russian / non-Latin names wrap rather than clip; the check
            stays pinned to the right and the row grows. */}
        <Text style={[styles.label, plain && selected && styles.labelSelected]}>{label}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
      {plain ? (
        // Радио-кнопка: пустой кружок, у выбранного — с точкой. Рисуется
        // вьюшками, а не иконкой, чтобы состояние «выбрано» читалось формой, а
        // не только цветом — иначе для человека, не различающего красный, все
        // строки выглядят одинаково.
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      ) : selected ? (
        <CheckCircle size={24} color={colors.brand.primary} weight="fill" />
      ) : (
        // Reserve the space so labels line up whether or not a row is checked.
        <View style={styles.checkSlot} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: hitSlop.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  rootPlain: {
    backgroundColor: "transparent",
    borderRadius: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  label: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
  caption: {
    ...typography.caption,
    color: colors.text.muted,
  },
  labelSelected: {
    color: colors.brand.primary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.text.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: colors.brand.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
  },
  checkSlot: {
    width: 24,
    height: 24,
  },
});
