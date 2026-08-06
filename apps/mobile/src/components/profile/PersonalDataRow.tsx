import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CaretRight } from "../icons";

/**
 * A single row of the «Персональные данные» list: a small caption label OVER
 * the current value, with a chevron when the row opens an editor.
 *
 * Same label-over-value shape as `SelectRow`, but WITHOUT a leading icon — the
 * personal-data list draws none (Figma), and SelectRow's icon is mandatory
 * because it sits in the reservation flow where every row has one. Rather than
 * loosen a shared primitive used elsewhere, this is the icon-less sibling.
 *
 * A row with no `onPress` is drawn NON-interactive (no chevron) and can carry a
 * muted `hint` explaining why — the phone row uses it: the number is the login
 * and cannot be changed here. A tappable-looking row that leads to a dead end
 * is the same lie as a fake value, so it stays a plain, honest read-out.
 */
export function PersonalDataRow({
  label,
  value,
  placeholder,
  hint,
  onPress,
  editA11y,
}: {
  label: string;
  value: string;
  /** Shown, muted, when `value` is empty. */
  placeholder?: string;
  /** Muted second line under the value — e.g. why the phone is not editable. */
  hint?: string;
  /** Omit for a read-only row (renders non-interactive, no chevron). */
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Spoken label for the tappable variant, e.g. «Изменить имя». */
  editA11y?: string;
}) {
  const hasValue = value.trim().length > 0;
  const shown = hasValue ? value : (placeholder ?? "");

  const content = (
    <>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={hasValue ? styles.value : styles.placeholder}>{shown}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {onPress ? <CaretRight size={20} color={colors.text.muted} weight="regular" /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.root} accessibilityRole="text" accessibilityLabel={`${label}: ${shown}`}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={editA11y ?? `${label}: ${shown}`}
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      {content}
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
  hint: {
    ...typography.caption,
    color: colors.text.muted,
  },
});
