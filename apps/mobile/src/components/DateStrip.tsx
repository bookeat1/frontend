import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { addDays, isSameDay, mondayFirstIndex, toDateKey, WEEKDAY_SHORT } from "../lib/format";

interface DateStripProps {
  /** "YYYY-MM-DD" of the selected day. */
  selected: string;
  onSelect: (dateKey: string) => void;
  /** How many days forward the strip offers before the guest has to open the
   * full calendar. The backend's default booking horizon is 60 days. */
  days?: number;
  todayLabel: string;
  tomorrowLabel: string;
}

const DEFAULT_DAYS = 14;

/**
 * Horizontal day picker on the reservation screen: today plus the next two
 * weeks. Anything further is the full-calendar screen's job.
 *
 * Only forward dates are offered — a past day would always come back with
 * every slot `too_soon`, which is a dead end dressed up as a choice.
 */
export function DateStrip({
  selected,
  onSelect,
  days = DEFAULT_DAYS,
  todayLabel,
  tomorrowLabel,
}: DateStripProps) {
  const today = useMemo(() => new Date(), []);
  const items = useMemo(
    () =>
      Array.from({ length: days }, (_, index) => {
        const date = addDays(today, index);
        return {
          key: toDateKey(date),
          date,
          weekday: WEEKDAY_SHORT[mondayFirstIndex(date)],
          day: String(date.getDate()),
          index,
        };
      }),
    [days, today],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {items.map((item) => {
        const active = item.key === selected;
        // "Сегодня"/"Завтра" replace the weekday abbreviation on the first two
        // cells — they are what a guest actually looks for, and both fit the
        // 56pt cell in Russian.
        const caption =
          item.index === 0 ? todayLabel : item.index === 1 ? tomorrowLabel : item.weekday;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            // Дубль ARIA-пропом — не декорация: react-native-web НЕ выводит
            // `aria-selected` из `accessibilityState` (та же грабля, что с
            // `aria-expanded` у графика заведения), и на вебе выбранный день
            // не объявлялся вовсе. RN 0.86 понимает ARIA-пропы напрямую,
            // поэтому нативу вторая запись не мешает.
            aria-selected={active}
            accessibilityLabel={`${caption}, ${item.day}`}
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => [
              styles.cell,
              active && styles.cellActive,
              pressed && !active && styles.pressed,
            ]}
          >
            <Text
              style={[styles.caption, active && styles.textActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {caption}
            </Text>
            <Text style={[styles.day, active && styles.textActive]}>{item.day}</Text>
            {isSameDay(item.date, today) && !active ? <View style={styles.todayDot} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  cell: {
    width: 60,
    minHeight: hitSlop.minTouchTarget + spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  // NOT verified against Figma (the MCP tools were unavailable when this was
  // built): brand red is the app's existing "chosen/primary" colour, so the
  // selected day reuses it rather than inventing a new token.
  cellActive: {
    backgroundColor: colors.brand.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  caption: {
    ...typography.caption,
    color: colors.text.mutedStrong,
  },
  day: {
    ...typography.titleMd,
    color: colors.text.primary,
  },
  textActive: {
    color: colors.text.onBrand,
  },
  todayDot: {
    position: "absolute",
    bottom: spacing.xs,
    width: 4,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
  },
});
