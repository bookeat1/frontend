import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { fromDateKey } from "../../lib/format";
import { MonthCalendar } from "../MonthCalendar";
import { PrimaryButton } from "../PrimaryButton";

const t = getDictionary();
const copy = t.profile.edit;

/**
 * The birth-date calendar itself — one implementation, two callers.
 *
 * It was born inside `BirthDateField` (the «О себе» form) and was pulled out
 * when «Персональные данные» needed the SAME calendar for its «День рождения»
 * row. Copying it would have meant two controls that can drift apart in bounds,
 * in copy and in behaviour while claiming to edit one and the same date.
 *
 * Confirm-then-close, unlike the booking date picker which applies on tap:
 * there the guest is choosing among a fortnight and a wrong tap costs one more
 * tap, here they may have crossed 40 years of calendar to get to the day and a
 * mistap would throw that away.
 *
 * `value`/`onApply` speak the WIRE format, the date key "YYYY-MM-DD", because
 * `birth_date` is parsed server-side with time.Parse("2006-01-02"). Formatting
 * for human eyes belongs to the caller.
 *
 * `saving`/`error` exist for the caller that saves STRAIGHT from the dialog
 * (the personal-data row: there is no «Сохранить» button behind it). The form
 * leaves them unset — there the apply only edits a draft and cannot fail.
 */
export function BirthDatePickerDialog({
  visible,
  value,
  earliest,
  latest,
  saving = false,
  error,
  onApply,
  onCancel,
}: {
  visible: boolean;
  /** Date key "YYYY-MM-DD", or "" when the guest has no birth date stored. */
  value: string;
  /** Earliest selectable day, inclusive, as a date key. */
  earliest: string;
  /** Latest selectable day, inclusive, as a date key. */
  latest: string;
  /** Keeps the dialog open and blocks a second apply while a save is in flight. */
  saving?: boolean;
  /** Why the last save failed. Shown inside the dialog, above the buttons. */
  error?: string;
  onApply: (dateKey: string) => void;
  onCancel: () => void;
}) {
  // What the calendar currently highlights. Separate from `value` so closing
  // with «Отмена» leaves the stored date exactly as it was.
  const [pending, setPending] = useState(value);

  // Сброс НА РЕНДЕРЕ открытия, а не в эффекте. Диалог висит смонтированным
  // рядом с экраном, и на первом рендере `value` ещё пустой (профиль не
  // загрузился). Эффект отработал бы ПОСЛЕ монтирования календаря — а тот
  // читает `initialView` один раз при монтировании и открылся бы на списке
  // лет вместо сохранённого месяца. Синхронный сброс перерисовывает диалог до
  // того, как календарь увидит устаревшее значение.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setPending(value);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.modalRoot}>
        {/* Tap target only — hidden from the accessibility tree so a screen
            reader lands on the dialog and not on a nameless full-screen
            button (same treatment as CancelBookingDialog). */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (!saving) onCancel();
          }}
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
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <PrimaryButton
              label={saving ? copy.saving : copy.birthDateApply}
              size="lg"
              disabled={!pending || saving}
              onPress={() => onApply(pending)}
            />
            <PrimaryButton
              label={copy.birthDateCancel}
              variant="secondary"
              size="lg"
              disabled={saving}
              onPress={onCancel}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  error: {
    ...typography.caption,
    color: colors.status.negativeTextOnSurface,
  },
  actions: {
    gap: spacing.sm,
  },
});
