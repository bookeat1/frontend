import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  formatMonthYear,
  fromDateKey,
  isSameDay,
  mondayFirstIndex,
  toDateKey,
  WEEKDAY_SHORT,
} from "../lib/format";
import { CaretLeft, CaretRight } from "./icons";
import { IconButton } from "./IconButton";

const t = getDictionary();

interface MonthCalendarProps {
  selected: string;
  onSelect: (dateKey: string) => void;
  /** Last selectable day, inclusive. Matches the venue's booking horizon. */
  maxDate: Date;
}

interface Cell {
  key: string;
  date: Date | null;
}

/**
 * Month grid for the "Выберите дату" screen. Monday-first, Russian month
 * names from lib/format (no Intl — see the note there).
 *
 * Days before today and past `maxDate` are rendered disabled rather than
 * hidden: a calendar with holes in it is harder to read than one that greys
 * out what it can't take.
 */
export function MonthCalendar({ selected, onSelect, maxDate }: MonthCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const selectedDate = useMemo(() => fromDateKey(selected), [selected]);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );

  const cells = useMemo<Cell[]>(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const daysInMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      0,
    ).getDate();
    const leading = mondayFirstIndex(first);
    const out: Cell[] = [];
    for (let i = 0; i < leading; i++) {
      out.push({ key: `pad-${i}`, date: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
      out.push({ key: toDateKey(date), date });
    }
    return out;
  }, [visibleMonth]);

  const startOfToday = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    [today],
  );

  const canGoBack =
    visibleMonth.getFullYear() > startOfToday.getFullYear() ||
    (visibleMonth.getFullYear() === startOfToday.getFullYear() &&
      visibleMonth.getMonth() > startOfToday.getMonth());
  const canGoForward =
    visibleMonth.getFullYear() < maxDate.getFullYear() ||
    (visibleMonth.getFullYear() === maxDate.getFullYear() &&
      visibleMonth.getMonth() < maxDate.getMonth());

  const shiftMonth = (delta: number) =>
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {canGoBack ? (
          <IconButton
            icon={CaretLeft}
            accessibilityLabel={t.a11y.previousMonth}
            onPress={() => shiftMonth(-1)}
          />
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <Text style={styles.monthLabel}>{formatMonthYear(visibleMonth)}</Text>
        {canGoForward ? (
          <IconButton
            icon={CaretRight}
            accessibilityLabel={t.a11y.nextMonth}
            onPress={() => shiftMonth(1)}
          />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_SHORT.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => {
          if (!cell.date) {
            return <View key={cell.key} style={styles.cell} />;
          }
          const disabled = cell.date < startOfToday || cell.date > maxDate;
          const active = isSameDay(cell.date, selectedDate);
          return (
            <Pressable
              key={cell.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled }}
              accessibilityLabel={`${cell.date.getDate()}`}
              disabled={disabled}
              onPress={() => onSelect(cell.key)}
              style={({ pressed }) => [styles.cell, pressed && !disabled && styles.pressed]}
            >
              <View style={[styles.dayBubble, active && styles.dayBubbleActive]}>
                <Text
                  style={[
                    styles.dayText,
                    disabled && styles.dayTextDisabled,
                    active && styles.dayTextActive,
                  ]}
                >
                  {cell.date.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: hitSlop.minTouchTarget,
    height: hitSlop.minTouchTarget,
  },
  monthLabel: {
    ...typography.titleMd,
    color: colors.text.primary,
  },
  weekdayRow: {
    flexDirection: "row",
  },
  weekdayLabel: {
    ...typography.caption,
    color: colors.text.muted,
    // 100/7 as a percentage keeps the seven columns aligned with the grid
    // below at any screen width, including 360px.
    width: `${100 / 7}%`,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%`,
    height: hitSlop.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  dayBubble: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBubbleActive: {
    backgroundColor: colors.brand.primary,
  },
  dayText: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  dayTextDisabled: {
    color: colors.text.muted,
  },
  dayTextActive: {
    color: colors.text.onBrand,
  },
});
