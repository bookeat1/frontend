import type { VenueSchedule } from "@bookeat/api";
import { WEEKDAY_BY_DAY_OF_WEEK, WEEK_ORDER_MONDAY_FIRST } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Clock } from "./icons";
import {
  dayHoursLabel,
  hasKnownDays,
  isForeignTimezone,
  openStateLabel,
  openUntilTodayLabel,
  scheduleDayFor,
  uniformDailyHours,
  venueDayOfWeek,
} from "../lib/schedule";

const t = getDictionary();

/**
 * Компактный блок часов работы ресторана.
 *
 * Дизайн («Ready for dev») показывает не недельную таблицу, а короткий блок:
 * статус «Открыто до 23:00» плюс одна сводная строка «Ежедневно с 10:00 до
 * 23:00», когда все дни одинаковые. Разбивка по дням остаётся ЗАПАСНЫМ
 * вариантом — её видно только у ресторанов, где часы реально разнятся.
 *
 * Что здесь принципиально:
 *   - «Открыто»/«Закрыто» берётся из серверного `openNow`, а не из строк
 *     ниже. Строка часов и статус — два независимых факта, и вывести один из
 *     другого клиент не имеет права (в разных таймзонах он получит другое).
 *     «до 23:00» — это лишь время закрытия из сегодняшней строки, а не наш
 *     вывод об открытости.
 *   - Неделя рисуется понедельником вперёд (RU-конвенция), хотя сервер
 *     нумерует дни с воскресенья.
 *   - Сегодняшняя строка выделена, и день определяется в таймзоне ЗАВЕДЕНИЯ.
 *   - День, которого нет в ответе, показывается как «Не указано», а не как
 *     выходной.
 */
export function VenueScheduleCard({
  schedule,
  openingHoursText,
}: {
  schedule: VenueSchedule | null;
  /** Свободнотекстовая строка заведения. Рисуется ТОЛЬКО когда графика нет. */
  openingHoursText: string;
}) {
  if (!schedule || !hasKnownDays(schedule)) {
    return (
      <View style={styles.card}>
        <Header statusLabel={openStateLabel(schedule)} />
        <Text style={styles.unknownTitle}>{t.restaurant.schedule.unknownTitle}</Text>
        <Text style={styles.unknownDescription}>
          {t.restaurant.schedule.unknownDescription}
        </Text>
        {/* Единственное, что мы про часы знаем, — как заведение написало о
            себе само. Подписано как его слова: разбирать эту строку на часы
            нельзя, именно на этом стоял прежний баг. */}
        {openingHoursText ? (
          <Text style={styles.venueWords}>
            {t.restaurant.schedule.venueOwnWords(openingHoursText)}
          </Text>
        ) : null}
      </View>
    );
  }

  const today = venueDayOfWeek(schedule.timezone);
  const uniform = uniformDailyHours(schedule);

  // Дизайн: компактный блок. Когда все дни одинаковые — одна строка «Ежедневно
  // с 10:00 до 23:00»; разбивка по дням остаётся запасным вариантом ровно для
  // тех графиков, где часы действительно разнятся.
  if (uniform) {
    return (
      <View style={styles.card}>
        <Header
          statusLabel={openUntilTodayLabel(schedule)}
          hoursLabel={t.restaurant.schedule.everyDay(uniform.opensAt, uniform.closesAt)}
        />
        {isForeignTimezone(schedule.timezone) ? (
          <Text style={styles.timezoneNote}>
            {t.restaurant.schedule.timezoneNote(schedule.timezone)}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Header statusLabel={openUntilTodayLabel(schedule)} />
      <View style={styles.week}>
        {WEEK_ORDER_MONDAY_FIRST.map((dayOfWeek) => {
          const day = scheduleDayFor(schedule, dayOfWeek);
          const isToday = dayOfWeek === today;
          const unknown = !day;
          const closed = day?.isOpen === false;
          return (
            <View
              key={dayOfWeek}
              style={[styles.row, isToday && styles.rowToday]}
              // Одной строкой для скринридера: «Понедельник, сегодня,
              // 12:00 – 01:00 следующего дня».
              accessible
              accessibilityLabel={[
                t.weekdays[WEEKDAY_BY_DAY_OF_WEEK[dayOfWeek]],
                isToday ? t.restaurant.schedule.today : null,
                dayHoursLabel(day),
              ]
                .filter(Boolean)
                .join(", ")}
            >
              <Text
                style={[styles.dayName, isToday && styles.textToday]}
                numberOfLines={1}
              >
                {t.weekdays[WEEKDAY_BY_DAY_OF_WEEK[dayOfWeek]]}
              </Text>
              <Text
                style={[
                  styles.dayHours,
                  isToday && styles.textToday,
                  (closed || unknown) && styles.dayHoursMuted,
                ]}
              >
                {dayHoursLabel(day)}
              </Text>
            </View>
          );
        })}
      </View>
      {isForeignTimezone(schedule.timezone) ? (
        <Text style={styles.timezoneNote}>
          {t.restaurant.schedule.timezoneNote(schedule.timezone)}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Шапка блока по макету (Figma node 340:2593): часы-иконка, справа две строки —
 * СТАТУС («Открыто до 23:00») крупнее и тёмным, под ним сводка часов
 * («Ежедневно с 10:00 до 23:00») мельче и серым.
 *
 * Заголовка «Часы работы» в макете нет: статус сам себя объясняет, а лишняя
 * строка отодвигала главное — до скольких сегодня открыто — на второй план.
 */
function Header({ statusLabel, hoursLabel }: { statusLabel: string; hoursLabel?: string }) {
  return (
    <View style={styles.header}>
      <Clock size={24} color={colors.text.primary} weight="regular" />
      <View style={styles.headerText}>
        <Text style={styles.status}>{statusLabel}</Text>
        {hoursLabel ? <Text style={styles.hours}>{hoursLabel}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  status: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  hours: {
    ...typography.caption,
    color: colors.text.muted,
  },
  week: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.card,
  },
  rowToday: {
    backgroundColor: colors.background.chip,
  },
  dayName: {
    ...typography.body,
    color: colors.text.primary,
    // Русские названия дней длинные («Воскресенье»); колонке нужна своя доля
    // ширины, иначе на 360 px часы уезжают за край.
    flexShrink: 0,
  },
  dayHours: {
    ...typography.body,
    color: colors.text.primary,
    flexShrink: 1,
    textAlign: "right",
  },
  dayHoursMuted: {
    color: colors.text.muted,
  },
  textToday: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
  unknownTitle: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  unknownDescription: {
    ...typography.caption,
    color: colors.text.muted,
  },
  venueWords: {
    ...typography.caption,
    color: colors.text.mutedStrong,
  },
  timezoneNote: {
    ...typography.caption,
    color: colors.text.muted,
  },
});
