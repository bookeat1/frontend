import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useId, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
  birthDateInputFromDateKey,
  maskBirthDateInput,
  parseBirthDateInput,
} from "../../lib/birth-date-input";

const t = getDictionary();
const copy = t.profile.edit;

/**
 * «Дата рождения» — ОДНО поле, в которое набирают цифры. Точки ставит маска.
 *
 * КАЛЕНДАРЯ БОЛЬШЕ НЕТ (правка владельца 2026-09-01, вечер: «убери календарь
 * из даты рождения»). До этого дня поле было кнопкой: тап открывал диалог с
 * месячной сеткой, и до 1990 года нужно было пролистать сорок лет. Днём того
 * же дня рядом с календарём появился набор цифрами (PR #108), вечером
 * календарь убран совсем — вместе с компонентом `MonthCalendar`, у которого
 * других потребителей не осталось.
 *
 * ДВА ФОРМАТА, И ЭТО НЕ ОДИН И ТОТ ЖЕ:
 *   - человек читает и набирает ДД.ММ.ГГГГ («04.05.1990»);
 *   - наружу и на провод уходит ключ даты «YYYY-MM-DD», потому что
 *     `birth_date` сервер разбирает через time.Parse("2006-01-02").
 * `value`/`onChange` говорят ПРОВОДНЫМ форматом ровно до тех пор, пока
 * набранное складывается в настоящую дату.
 *
 * ЧТО УХОДИТ НАВЕРХ, ПОКА ДАТА НЕ СОБРАЛАСЬ. Не пустая строка, а сама
 * набранная строка («04.05.19»). Пустая означала бы «даты нет», и черновик
 * профиля молча сохранился бы без неё — гость увидел бы «Сохранено» над
 * недопечатанной датой. Недоразобранное значение в черновике ловит
 * `validateProfileDraft`: она отличает недобор («введите дату полностью») от
 * несуществующего дня («такой даты не существует») по числу цифр.
 *
 * ОШИБКУ ПЕЧАТАЕТ ХОЗЯИН ФОРМЫ, а не поле. Так же устроены «Имя» и «Город»:
 * причина появляется по «Сохранить» и гаснет на первом же нажатии клавиши.
 * Красная строка над датой, которую человек ещё набирает, — раздражение, а не
 * помощь.
 */
export function BirthDateField({
  label,
  value,
  onChange,
  error,
  hint,
  disabled = false,
}: {
  label: string;
  /**
   * Ключ даты «YYYY-MM-DD», пустая строка — даты нет, либо НАБРАННАЯ строка
   * «04.05.19», пока она в дату не сложилась.
   */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
}) {
  // Что стоит в поле глазами гостя. Отдельное состояние, а не производная от
  // `value`: пока дата набрана наполовину, ключа даты ещё нет, а показывать
  // набранное надо.
  const [typed, setTyped] = useState(() => shownFor(value));
  // Значение, с которого поле синхронизировалось в последний раз. Нужно,
  // чтобы отличить «хозяин прислал ДРУГУЮ дату» (загрузился профиль, отменили
  // правку) от «хозяин вернул то, что мы сами только что отдали».
  const [syncedFrom, setSyncedFrom] = useState(value);
  const errorId = useId();

  if (value !== syncedFrom) {
    setSyncedFrom(value);
    if (value !== emitFor(typed)) setTyped(shownFor(value));
  }

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.field, Boolean(error) && styles.fieldError, disabled && styles.fieldDisabled]}
        value={typed}
        onChangeText={(raw) => {
          const masked = maskBirthDateInput(raw);
          setTyped(masked);
          const next = emitFor(masked);
          setSyncedFrom(next);
          onChange(next);
        }}
        placeholder={copy.birthDateTypePlaceholder}
        placeholderTextColor={colors.text.muted}
        // Цифровая клавиатура: букв в дате нет, а маска всё равно выбросит
        // всё, кроме цифр.
        keyboardType="number-pad"
        inputMode="numeric"
        // «ДД.ММ.ГГГГ» — восемь цифр и две точки. Маска длиннее не выдаёт, но
        // ограничение снимает и вставку из буфера.
        maxLength={10}
        editable={!disabled}
        accessibilityLabel={label}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />

      {error ? (
        <Text nativeID={errorId} style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** Что показать в поле для значения, пришедшего сверху. */
function shownFor(value: string): string {
  return birthDateInputFromDateKey(value) || maskBirthDateInput(value);
}

/**
 * Что отдать наверх для набранного.
 *
 * Собралась настоящая дата — ключ «YYYY-MM-DD». Не собралась — ровно то, что
 * набрано: пустая строка значит «даты нет», а «04.05.19» значит «дата не
 * дописана», и эти два случая обязаны различаться.
 */
function emitFor(typed: string): string {
  const parsed = parseBirthDateInput(typed, new Date());
  return parsed.status === "ok" ? parsed.dateKey : typed;
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
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: "transparent",
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  fieldError: {
    borderColor: colors.brand.primary,
  },
  fieldDisabled: {
    opacity: 0.6,
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
