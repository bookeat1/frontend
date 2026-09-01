import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { parseBirthDateDraft } from "../../lib/birth-date-input";
import { PrimaryButton } from "../PrimaryButton";
import { BirthDateField } from "./BirthDateField";

const t = getDictionary();
const copy = t.profile.edit;

/**
 * Правка даты рождения из СПИСКА «Персональные данные»: там строка «День
 * рождения» открывает редактор, как строка «Имя» открывает `FieldEditorSheet`.
 * Это единственный потребитель диалога — в форме «О себе» поле стоит прямо на
 * странице.
 *
 * КАЛЕНДАРЯ ЗДЕСЬ БОЛЬШЕ НЕТ (правка владельца 2026-09-01, вечер). Раньше это
 * был `BirthDatePickerDialog` с месячной сеткой `MonthCalendar`; сетка убрана,
 * компонент удалён, осталось поле ввода — то же самое `BirthDateField`, что
 * стоит в форме. Второй реализации набора даты в приложении нет.
 *
 * Подтверждение отдельной кнопкой, а не применение на лету: `onApply`
 * сохраняет СРАЗУ, PATCH-ем на сервер, и делать это на каждой набранной цифре
 * нельзя.
 *
 * КНОПКА ЖИВАЯ НА НЕВЕРНОЙ ДАТЕ — она печатает причину. Молча погашенная
 * кнопка не объясняет ничего: гость набрал 31.02 и не понимает, чего от него
 * хотят. Гаснет она только на время сохранения.
 *
 * `value`/`onApply` говорят ПРОВОДНЫМ форматом, ключом даты «YYYY-MM-DD»:
 * `birth_date` сервер разбирает через time.Parse("2006-01-02").
 */
export function BirthDateDialog({
  visible,
  value,
  saving = false,
  error,
  onApply,
  onCancel,
}: {
  visible: boolean;
  /** Date key "YYYY-MM-DD", or "" when the guest has no birth date stored. */
  value: string;
  /** Keeps the dialog open and blocks a second apply while a save is in flight. */
  saving?: boolean;
  /** Why the last save failed. Shown inside the dialog, above the buttons. */
  error?: string;
  onApply: (dateKey: string) => void;
  onCancel: () => void;
}) {
  // Черновик: либо ключ даты, либо ещё не сложившаяся набранная строка — тот
  // же контракт, что у самого поля.
  const [draft, setDraft] = useState(value);
  const [reason, setReason] = useState<string | undefined>(undefined);

  // Сброс НА РЕНДЕРЕ открытия, а не в эффекте: диалог висит смонтированным
  // рядом с экраном, и на первом рендере `value` ещё пустой — профиль не
  // загрузился. Эффект отработал бы после того, как поле уже показало пустоту.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDraft(value);
      setReason(undefined);
    }
  }

  const apply = () => {
    const parsed = parseBirthDateDraft(draft, new Date());
    if (parsed.status === "ok") {
      setReason(undefined);
      onApply(parsed.dateKey);
      return;
    }
    // `empty` и `incomplete` для гостя одно и то же: дата не дописана.
    setReason(
      parsed.status === "invalid"
        ? copy.errors[parsed.error]
        : copy.errors.birth_date_incomplete,
    );
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

          <BirthDateField
            label={copy.birthDateTypeLabel}
            value={draft}
            onChange={(next) => {
              setDraft(next);
              // Причина гаснет на первом же нажатии клавиши — она относилась
              // к прошлому набору, а не к тому, что сейчас в поле.
              setReason(undefined);
            }}
            disabled={saving}
            error={reason}
          />

          {/* Отказ сервера — отдельная строка над кнопками: она не про то,
              что набрано, а про то, что сохранение не прошло. */}
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <PrimaryButton
              label={saving ? copy.saving : copy.birthDateApply}
              size="lg"
              disabled={saving}
              onPress={apply}
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
