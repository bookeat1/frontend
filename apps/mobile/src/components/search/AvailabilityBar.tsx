import { colors, controlHeight, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import type { AvailabilityFilter } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DEFAULT_GUESTS } from "../../lib/availability-options";
import { dateChoices } from "../../lib/availability-label";
import { CalendarBlank, User, X } from "../icons";
import { AvailabilityWheels, type AvailabilityHalf } from "./AvailabilityWheels";

const t = getDictionary();

/**
 * Капсула «дата · гости» над выдачей поиска — вторая половина того же выбора,
 * что стоит на главной. Тап по половине открывает своё колесо (макеты
 * 918:12317 и 918:12428).
 *
 * ВАЖНОЕ СВОЙСТВО: обе половины применяются ТОЛЬКО ВМЕСТЕ. Сервер отвечает на
 * вопрос «есть ли стол на N гостей в такой-то день» и игнорирует одно без
 * другого, поэтому выбрать дату, не назвав компанию, здесь невозможно: пока
 * выбрана одна половина, вторая держит своё значение по умолчанию, и фильтр
 * уходит целиком. Иначе капсула показывала бы «пятница», а выдача оставалась бы
 * прежней — вид работающего фильтра без фильтра.
 */

export function AvailabilityBar({
  value,
  onChange,
  today = new Date(),
}: {
  value: AvailabilityFilter | undefined;
  /** undefined = фильтр снят. */
  onChange: (next: AvailabilityFilter | undefined) => void;
  /** Точка отсчёта дат. Параметр — ради тестов, в приложении всегда «сегодня». */
  today?: Date;
}) {
  const [picker, setPicker] = useState<AvailabilityHalf | null>(null);

  // Подпись дня считает общий `dateChoices` — тот же, что рисует чипы подбора
  // над выдачей. Два расчёта разъехались бы на «Сегодня»/«12 августа». Сами
  // КОЛЁСА живут в `AvailabilityWheels` — там же лежит правило «наружу только
  // парой», общее с чипами на экране поиска.
  const { labelFor } = useMemo(() => dateChoices(today), [today]);

  // Пока дату не выбрали, показываем «Сегодня», а не «Любой день» (решение
  // владельца 18.08.2026): человек чаще всего ищет на сегодня, и подпись
  // называет то, что он получит, нажав «Найти», а не абстрактное состояние
  // фильтра.
  const dateLabel = value ? labelFor(value.date) : t.booking.today;
  const guestsLabel = t.booking.guestsCount(value?.guests ?? DEFAULT_GUESTS);

  return (
    <View style={styles.root}>
      <View style={styles.capsule}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t.booking.dateSectionTitle}: ${dateLabel}`}
          onPress={() => setPicker("date")}
          style={({ pressed }) => [styles.half, pressed && styles.pressed]}
        >
          <CalendarBlank size={20} color={colors.text.primary} weight="regular" />
          <Text style={styles.halfLabel} numberOfLines={1}>
            {dateLabel}
          </Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t.booking.guestsSectionTitle}: ${guestsLabel}`}
          onPress={() => setPicker("guests")}
          style={({ pressed }) => [styles.half, pressed && styles.pressed]}
        >
          <User size={20} color={colors.text.primary} weight="regular" />
          <Text style={styles.halfLabel} numberOfLines={1}>
            {guestsLabel}
          </Text>
        </Pressable>
      </View>

      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.search.availabilityReset}
          hitSlop={hitSlop.minTouchTarget / 4}
          onPress={() => onChange(undefined)}
          style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
        >
          <X size={18} color={colors.text.mutedStrong} weight="bold" />
        </Pressable>
      ) : null}

      {/* Колёса — общий `AvailabilityWheels`: и здесь, и у чипов над выдачей
          выбор половины досылает вторую половину сам. */}
      <AvailabilityWheels
        open={picker}
        value={value}
        today={today}
        onClose={() => setPicker(null)}
        onChange={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  capsule: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: controlHeight.pill,
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
  half: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: controlHeight.pill,
  },
  halfLabel: {
    ...typography.labelMedium,
    color: colors.text.primary,
    flexShrink: 1,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: spacing.sm,
    backgroundColor: colors.border.control,
  },
  reset: {
    width: controlHeight.pill,
    height: controlHeight.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
