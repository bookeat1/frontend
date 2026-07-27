import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useId, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { formatDateKeyDayFirst, fromDateKey } from "../../lib/format";
import { CalendarBlank } from "../icons";
import { MonthCalendar } from "../MonthCalendar";
import { PrimaryButton } from "../PrimaryButton";

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
 *   - what the guest reads is ДД-ММ-ГГГГ ("04-05-1990");
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
 * Confirm-then-close, unlike the booking date picker which applies on tap:
 * there the guest is choosing among a fortnight and a wrong tap costs one more
 * tap, here they may have crossed 40 years of calendar to get to the day and a
 * mistap would throw that away.
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
  // What the calendar currently highlights. Separate from `value` so closing
  // with «Отмена» leaves the stored date exactly as it was.
  const [pending, setPending] = useState(value);
  const errorId = useId();

  const shown = value ? formatDateKeyDayFirst(value) : "";

  const openPicker = () => {
    setPending(value);
    setOpen(true);
  };

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
        onPress={openPicker}
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

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          {/* Tap target only — hidden from the accessibility tree so a screen
              reader lands on the dialog and not on a nameless full-screen
              button (same treatment as CancelBookingDialog). */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
            importantForAccessibility="no"
            accessibilityElementsHidden
          />
          <View style={styles.card} accessibilityViewIsModal>
            <Text style={styles.cardTitle} accessibilityRole="header">
              {copy.birthDateDialogTitle}
            </Text>
            <MonthCalendar
              selected={pending}
              onSelect={setPending}
              minDate={fromDateKey(earliest)}
              maxDate={fromDateKey(latest)}
              yearPicker
              // With no date yet the year is the decision that matters; with
              // one, the guest is almost always correcting a day or a month.
              initialView={pending ? "days" : "years"}
            />
            <View style={styles.actions}>
              <PrimaryButton
                label={copy.birthDateApply}
                size="lg"
                disabled={!pending}
                onPress={() => {
                  onChange(pending);
                  setOpen(false);
                }}
              />
              <PrimaryButton
                label={copy.birthDateCancel}
                variant="secondary"
                size="lg"
                onPress={() => setOpen(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  modalRoot: {
    flex: 1,
    backgroundColor: colors.overlay.dialogScrim,
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.dialog,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  cardTitle: {
    ...typography.titleCard,
    color: colors.text.primary,
  },
  actions: {
    gap: spacing.sm,
  },
});
