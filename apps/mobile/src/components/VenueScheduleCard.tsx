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
  scheduleDayFor,
  venueDayOfWeek,
} from "../lib/schedule";

const t = getDictionary();

/**
 * Недельный график заведения — единственное место, где часы работы рисуются
 * подробно.
 *
 * Что здесь принципиально:
 *   - «Открыто»/«Закрыто» берётся из серверного `openNow`, а не из строк
 *     ниже. Строка часов и статус — два независимых факта, и вывести один из
 *     другого клиент не имеет права (в разных таймзонах он получит другое).
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

  return (
    <View style={styles.card}>
      <Header statusLabel={openStateLabel(schedule)} />
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

function Header({ statusLabel }: { statusLabel: string }) {
  return (
    <View style={styles.header}>
      <Clock size={24} color={colors.text.primary} weight="regular" />
      <View style={styles.headerText}>
        <Text style={styles.title}>{t.restaurant.workingHours}</Text>
        <Text style={styles.status}>{statusLabel}</Text>
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
  title: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  status: {
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
