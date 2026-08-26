import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useId, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDateKeyDayFirst } from "../../lib/format";
import { CalendarBlank } from "../icons";
import { BirthDatePickerDialog } from "./BirthDatePickerDialog";

const t = getDictionary();
const copy = t.profile.edit;

/**
 * «Дата рождения» — a field the guest TAPS, never types into.
 *
 * Why a picker at all: the old field was free text, so the guest had to guess
 * the separator and the field order, and every wrong guess ("04.05.1990") came
 * back as a red line after a round of typing. A calendar cannot produce an
 * invalid date, cannot produce a future one, and cannot produce a year the
 * server will refuse — the rule is expressed as the range of the control
 * instead of as an error message about the control.
 *
 * TWO FORMATS, AND THEY ARE NOT THE SAME ONE:
 *   - what the guest reads is ДД.ММ.ГГГГ ("04.05.1990");
 *   - what is held in the draft and sent to the API is the date key
 *     "YYYY-MM-DD", because `birth_date` is parsed server-side with
 *     time.Parse("2006-01-02") and nothing else is accepted.
 * `value`/`onChange` speak the WIRE format. The day-first string exists only
 * between `formatDateKeyDayFirst` and the `<Text>`.
 *
 * The bounds come from `birthDateBounds` in lib/profile-edit — the same
 * function the validator uses — so the calendar cannot offer a day that the
 * form would then reject.
 *
 * The calendar itself lives in `BirthDatePickerDialog`: «Персональные данные»
 * opens the very same dialog from its «День рождения» row, and two copies of
 * one calendar would be free to disagree about bounds and behaviour.
 */
export function BirthDateField({
  label,
  value,
  onChange,
  earliest,
  latest,
  error,
  hint,
  disabled = false,
}: {
  label: string;
  /** Date key "YYYY-MM-DD", or "" when the guest has no birth date stored. */
  value: string;
  onChange: (dateKey: string) => void;
  /** Earliest selectable day, inclusive, as a date key. */
  earliest: string;
  /** Latest selectable day, inclusive, as a date key. */
  latest: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const errorId = useId();

  const shown = value ? formatDateKeyDayFirst(value) : "";

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        // The spoken value is the day-first one, i.e. what is on screen — a
        // screen reader must not be the only place the wire format leaks out.
        accessibilityLabel={`${label}: ${shown || copy.birthDateEmpty}`}
        accessibilityState={{ disabled }}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          Boolean(error) && styles.fieldError,
          disabled && styles.fieldDisabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <Text style={shown ? styles.value : styles.placeholder}>
          {shown || copy.birthDatePlaceholder}
        </Text>
        <CalendarBlank size={20} color={colors.text.muted} weight="regular" />
      </Pressable>

      {error ? (
        <Text nativeID={errorId} style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}

      <BirthDatePickerDialog
        visible={open}
        value={value}
        earliest={earliest}
        latest={latest}
        onApply={(dateKey) => {
          onChange(dateKey);
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
  },
  label: {
    ...typography.labelMedium,
    color: colors.text.mutedStrong,
  },
  field: {
    minHeight: hitSlop.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  fieldError: {
    borderColor: colors.brand.primary,
  },
  fieldDisabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.7,
  },
  value: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  placeholder: {
    ...typography.labelMedium,
    color: colors.text.muted,
  },
  error: {
    ...typography.caption,
    color: colors.brand.primary,
  },
  hint: {
    ...typography.caption,
    color: colors.text.muted,
  },
});
