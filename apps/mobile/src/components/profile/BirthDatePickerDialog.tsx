import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useId, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  birthDateInputFromDateKey,
  maskBirthDateInput,
  parseBirthDateInput,
  type BirthDateInputError,
} from "../../lib/birth-date-input";
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
 *
 * ДВА СПОСОБА ВВОДА, ОДНО ЗНАЧЕНИЕ (правка владельца 2026-09-01: «дату можно
 * указывать просто цифрами, без вызова календаря»). Сверху — поле, куда
 * набирают цифры, точки маска ставит сама; ниже — прежний календарь.
 * Календарь НЕ убран: он остаётся способом для того, кто не помнит дату
 * точно.
 *
 * Оба способа пишут в ОДНО состояние `pending`, поэтому набранное сразу
 * подсвечивается в календаре, а выбранное в календаре сразу появляется в
 * поле. Второй копии «выбранной даты» здесь нет — она бы разъехалась в первый
 * же день.
 *
 * НЕПОЛНЫЙ И НЕВЕРНЫЙ ВВОД РАЗЛИЧАЮТСЯ. Пока цифр меньше восьми, ошибки нет —
 * это ещё не ошибка человека, а незаконченный ввод, и красная строка над
 * недопечатанной датой раздражала бы. Как только дата собрана целиком, её
 * разбирает `parseBirthDateInput`, и «31.02», будущая дата или 1830 год
 * получают ИМЕННУЮ причину, а не молча погашенную кнопку.
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
  // То же самое глазами гостя — «04.05.1990». Отдельная строка, а не
  // производная от `pending`: пока дата набрана наполовину, ключа даты ещё
  // нет, а показывать набранное надо.
  const [typed, setTyped] = useState(() => birthDateInputFromDateKey(value));
  const [typedError, setTypedError] = useState<BirthDateInputError | null>(null);
  const inputErrorId = useId();

  // Сброс НА РЕНДЕРЕ открытия, а не в эффекте. Диалог висит смонтированным
  // рядом с экраном, и на первом рендере `value` ещё пустой (профиль не
  // загрузился). Эффект отработал бы ПОСЛЕ монтирования календаря — а тот
  // читает `initialView` один раз при монтировании и открылся бы на списке
  // лет вместо сохранённого месяца. Синхронный сброс перерисовывает диалог до
  // того, как календарь увидит устаревшее значение.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setPending(value);
      setTyped(birthDateInputFromDateKey(value));
      setTypedError(null);
    }
  }

  /** Набор цифр: маска, разбор, и — если дата собралась — подсветка в календаре. */
  const onType = (raw: string) => {
    const masked = maskBirthDateInput(raw);
    setTyped(masked);
    const result = parseBirthDateInput(masked, new Date());
    switch (result.status) {
      case "ok":
        setTypedError(null);
        setPending(result.dateKey);
        break;
      case "invalid":
        setTypedError(result.error);
        // Прежняя подсветка снимается: держать в календаре одну дату, а в поле
        // другую — значит применить не то, что человек видит в поле.
        setPending("");
        break;
      case "incomplete":
      case "empty":
        setTypedError(null);
        setPending("");
        break;
    }
  };

  /** Выбор в календаре: он же обновляет строку в поле. */
  const onPick = (dateKey: string) => {
    setPending(dateKey);
    setTyped(birthDateInputFromDateKey(dateKey));
    setTypedError(null);
  };

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
          <View style={styles.typedField}>
            <Text style={styles.typedLabel}>{copy.birthDateTypeLabel}</Text>
            <TextInput
              style={[styles.typedInput, typedError ? styles.typedInputError : null]}
              value={typed}
              onChangeText={onType}
              placeholder={copy.birthDateTypePlaceholder}
              placeholderTextColor={colors.text.muted}
              // Цифровая клавиатура: буквы в этом поле не нужны, а маска всё
              // равно выбросит всё, кроме цифр.
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={10}
              editable={!saving}
              accessibilityLabel={copy.birthDateTypeLabel}
              aria-invalid={Boolean(typedError)}
              aria-describedby={typedError ? inputErrorId : undefined}
            />
            {typedError ? (
              <Text nativeID={inputErrorId} style={styles.error} accessibilityRole="alert">
                {copy.errors[typedError]}
              </Text>
            ) : null}
          </View>

          <MonthCalendar
            selected={pending}
            onSelect={onPick}
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
  typedField: {
    gap: spacing.xs,
  },
  typedLabel: {
    ...typography.labelMedium,
    color: colors.text.mutedStrong,
  },
  typedInput: {
    minHeight: hitSlop.minTouchTarget,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: "transparent",
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  typedInputError: {
    borderColor: colors.brand.primary,
  },
  error: {
    ...typography.caption,
    color: colors.status.negativeTextOnSurface,
  },
  actions: {
    gap: spacing.sm,
  },
});
