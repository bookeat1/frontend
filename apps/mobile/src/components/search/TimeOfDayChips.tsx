import { TIME_OF_DAY_ORDER, type TimeOfDay } from "@bookeat/api";
import { spacing } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useLocale } from "../../lib/locale";
import { FilterChip } from "../FilterChip";

/**
 * Ряд чипов «Утро / День / Вечер» — ОДИН компонент на все места, где спрашивают
 * время суток (шторка фильтров, главная). Своего списка значений у него нет:
 * порядок и сами значения приходят из `@bookeat/api/time-of-day`, оттуда же
 * берёт границы экран брони. Добавить четвёртое время суток — правка в одном
 * файле домена, а не в трёх экранах.
 *
 * Выбор ОДНОЗНАЧНЫЙ и снимаемый: повторный тап по выбранному чипу возвращает
 * `undefined` («любое время»). Отдельного чипа «Все» нет намеренно — он занял
 * бы место и всё равно означал бы «ничего не выбрано».
 *
 * Что этот выбор делает: он раскрывается в серверное окно `time_from`/`time_to`
 * (`timeOfDayWindow`) и уходит в `GET /restaurants/search`. Сервер применяет
 * окно ТОЛЬКО вместе с датой и числом гостей — поэтому вызывающий экран должен
 * показывать `t.search.filters.timeOfDayNote` рядом, а не делать вид, что чип
 * работает сам по себе.
 */
export function TimeOfDayChips({
  value,
  onChange,
  selectedTone = "brand",
}: {
  /** Выбранное время суток, или undefined — «любое». */
  value: TimeOfDay | undefined;
  onChange: (next: TimeOfDay | undefined) => void;
  /** Тон выбранного чипа — тот же проп, что у `FilterChip`. */
  selectedTone?: "dark" | "brand";
}) {
  const { dictionary: t } = useLocale();
  const labels: Record<TimeOfDay, string> = {
    morning: t.search.filters.timeOfDayMorning,
    lunch: t.search.filters.timeOfDayLunch,
    dinner: t.search.filters.timeOfDayDinner,
  };

  return (
    <View style={styles.row}>
      {TIME_OF_DAY_ORDER.map((period) => (
        <FilterChip
          key={period}
          label={labels[period]}
          selected={value === period}
          selectedTone={selectedTone}
          onPress={() => onChange(value === period ? undefined : period)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    // Чипы переносятся, а не сжимаются: «Түскі ас» и «Кешкі ас» в казахском
    // длиннее русских, и на 360 px три чипа в строку могут не поместиться.
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
