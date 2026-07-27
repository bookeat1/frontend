import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  formatMonthYear,
  fromDateKey,
  isSameDay,
  mondayFirstIndex,
  toDateKey,
  WEEKDAY_SHORT,
} from "../lib/format";
import { CaretDown, CaretLeft, CaretRight } from "./icons";
import { IconButton } from "./IconButton";

const t = getDictionary();

interface MonthCalendarProps {
  /** Date key of the chosen day, or "" when nothing is chosen yet. */
  selected: string;
  onSelect: (dateKey: string) => void;
  /** First selectable day, inclusive. Defaults to today — the booking horizon
   * starts now, but a birth date runs the other way and needs the floor moved. */
  minDate?: Date;
  /** Last selectable day, inclusive. Matches the venue's booking horizon. */
  maxDate: Date;
  /**
   * Lets the guest tap the month title and jump to a year.
   *
   * Off by default and off for booking on purpose: that range is a fortnight,
   * and a year list of one entry is noise. A birth date spans 120 years, where
   * month-by-month paging is ~430 taps — the control is not optional there.
   */
  yearPicker?: boolean;
  /** Which view the calendar opens on. "years" is right when there is no
   * selection yet and the range is decades wide: the year is the first
   * decision, and starting on a day grid asks the guest to page out of it. */
  initialView?: "days" | "years";
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
export function MonthCalendar({
  selected,
  onSelect,
  minDate,
  maxDate,
  yearPicker = false,
  initialView = "days",
}: MonthCalendarProps) {
  const today = useMemo(() => new Date(), []);
  // "" means nothing is chosen yet — no day is highlighted, and the grid opens
  // on whatever is inside the range rather than on 1 January year 1.
  const selectedDate = useMemo(() => (selected ? fromDateKey(selected) : null), [selected]);
  const [showYears, setShowYears] = useState(initialView === "years");
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const anchor = selectedDate ?? clampToRange(today, minDate, maxDate);
    return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  });

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

  const rangeStart = useMemo(
    () => minDate ?? new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    [minDate, today],
  );

  /** Every year the range touches, newest first — a birth year is far more
   * often in the recent half of the list than in 1906. */
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = maxDate.getFullYear(); y >= rangeStart.getFullYear(); y--) out.push(y);
    return out;
  }, [maxDate, rangeStart]);

  const canGoBack =
    visibleMonth.getFullYear() > rangeStart.getFullYear() ||
    (visibleMonth.getFullYear() === rangeStart.getFullYear() &&
      visibleMonth.getMonth() > rangeStart.getMonth());
  const canGoForward =
    visibleMonth.getFullYear() < maxDate.getFullYear() ||
    (visibleMonth.getFullYear() === maxDate.getFullYear() &&
      visibleMonth.getMonth() < maxDate.getMonth());

  const shiftMonth = (delta: number) =>
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {canGoBack && !showYears ? (
          <IconButton
            icon={CaretLeft}
            accessibilityLabel={t.a11y.previousMonth}
            onPress={() => shiftMonth(-1)}
          />
        ) : (
          <View style={styles.headerSpacer} />
        )}
        {yearPicker ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showYears ? t.a11y.backToDays : t.a11y.pickYear}
            accessibilityState={{ expanded: showYears }}
            onPress={() => setShowYears((open) => !open)}
            style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
          >
            <Text style={styles.monthLabel}>{formatMonthYear(visibleMonth)}</Text>
            <CaretDown size={16} color={colors.text.primary} weight="regular" />
          </Pressable>
        ) : (
          <Text style={styles.monthLabel}>{formatMonthYear(visibleMonth)}</Text>
        )}
        {canGoForward && !showYears ? (
          <IconButton
            icon={CaretRight}
            accessibilityLabel={t.a11y.nextMonth}
            onPress={() => shiftMonth(1)}
          />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {showYears ? (
        // Replaces the day grid rather than sitting above it: the calendar is
        // rendered inside a ScrollView (the booking screen) and inside a modal
        // card (the birth date), and two scrollable areas nested in either one
        // is a scroll that fights the finger.
        <ScrollView style={styles.yearList} contentContainerStyle={styles.yearGrid}>
          {years.map((year) => {
            const active = visibleMonth.getFullYear() === year;
            return (
              <Pressable
                key={year}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={String(year)}
                onPress={() => {
                  // Keep the month, move the year, then pull the result back
                  // inside the range: jumping to 1906 from July must not land
                  // on a month that is entirely before `minDate`.
                  const moved = clampToRange(
                    new Date(year, visibleMonth.getMonth(), 1),
                    rangeStart,
                    maxDate,
                  );
                  setVisibleMonth(new Date(moved.getFullYear(), moved.getMonth(), 1));
                  setShowYears(false);
                }}
                style={({ pressed }) => [styles.yearCell, pressed && styles.pressed]}
              >
                <View style={[styles.yearBubble, active && styles.yearBubbleActive]}>
                  <Text style={[styles.yearText, active && styles.yearTextActive]}>{year}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <>
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
          const disabled = cell.date < rangeStart || cell.date > maxDate;
          const active = selectedDate !== null && isSameDay(cell.date, selectedDate);
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
        </>
      )}
    </View>
  );
}

/** `date` moved the shortest distance needed to land inside [min, max]. */
function clampToRange(date: Date, min: Date | undefined, max: Date): Date {
  if (min && date < min) return min;
  if (date > max) return max;
  return date;
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
  monthButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: hitSlop.minTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  monthLabel: {
    ...typography.titleMd,
    color: colors.text.primary,
  },
  yearList: {
    // Bounded so the modal card cannot grow past a 360x640 screen; ~5 rows.
    maxHeight: 240,
  },
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  yearCell: {
    // Three columns: a four-digit year needs the width, and 33% keeps the
    // grid aligned at 360px just as the day grid's 100/7 does.
    width: "33.333%",
    height: hitSlop.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  yearBubble: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  yearBubbleActive: {
    backgroundColor: colors.brand.primary,
  },
  yearText: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  yearTextActive: {
    color: colors.text.onBrand,
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
