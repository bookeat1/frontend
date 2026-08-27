import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { dateChoices } from "../../lib/availability-label";
import { DEFAULT_GUESTS, guestOptions } from "../../lib/availability-options";
import { useLocale } from "../../lib/locale";
import { CalendarBlank, User } from "../icons";
import { PartySheet } from "./PartySheet";

/**
 * Капсула «дата · гости» в шапке главной и выбор, который она открывает.
 *
 * Тап по ЛЮБОЙ из половин поднимает ОДНУ общую нижнюю шторку «Дата и гости»
 * (`PartySheet`, макет 3447:13024): в ней рядом стоят оба колеса. Раньше
 * половины поднимали ДВЕ разные шторки с одним колесом каждая, и человек,
 * нажавший «2 гостя», подтверждал половину подбора — вторая молча бралась по
 * умолчанию. Никакого перехода на этом шаге по-прежнему не происходит:
 * отдельного экрана выбора даты и гостей в дизайне нет вовсе (правка владельца
 * 2026-08-26).
 *
 * Наверх выбор уходит ЦЕЛИКОМ — парой «дата + гости». Это не удобство, а
 * правило сервера: он отвечает на вопрос «есть ли стол на N гостей в такой-то
 * день» и половину запроса игнорирует. Колёса открываются на «сегодня» и
 * `DEFAULT_GUESTS` — ровно как в `AvailabilityBar` внутри фильтров.
 *
 * Отдельный компонент, а не часть `HomeHeader`: шапка тянет вшитую в
 * приложение фотографию через `require`, и в тестах она не рендерится вовсе
 * (Node разбирает jpg как модуль и падает). Живое поведение капсулы не должно
 * зависеть от того, удалось ли отрисовать фон вокруг неё.
 */
export function PartySelector({
  dateValue,
  guestsValue,
  onSearchParty,
}: {
  /** Подпись левой половины — как есть, компонент её не считает. */
  dateValue: string;
  /** Подпись правой половины. */
  guestsValue: string;
  /**
   * Человек закончил выбор. Дальше — каталог с этим подбором; второго шага
   * («сначала дата, потом гости») нет, поэтому приходит готовая пара.
   */
  onSearchParty: (party: { date: string; guests: number }) => void;
}) {
  const { dictionary: t } = useLocale();
  // Шторка одна на обе половины, поэтому и состояние одно: открыта или нет.
  const [open, setOpen] = useState(false);
  // Список дат считаем ОДИН раз на монтирование: главная живёт минуты, а не
  // сутки, и пересчёт на каждый рендер строил бы 61 объект впустую.
  const dates = useMemo(() => dateChoices(new Date()).options, []);
  const guests = useMemo(() => guestOptions((n) => t.booking.guestsCount(n)), [t]);

  return (
    <View style={styles.row}>
      {/* Дата и гости — ОДНА белая капсула, разделённая тонкой линией
          (node 986:8721), а не два отдельных пилла: так в макете главной.
          Пилл со стрелкой (PillSelect) остаётся на экране брони, где он и
          нарисован. */}
      <Pressable
        style={({ pressed }) => [styles.selector, styles.selectorLeft, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${t.explore.dateSelectorLabel}: ${dateValue}`}
        onPress={() => setOpen(true)}
      >
        <CalendarBlank size={24} color={colors.text.primary} weight="regular" />
        <Text style={styles.selectorValue} numberOfLines={1}>
          {dateValue}
        </Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.selector, styles.selectorRight, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${t.explore.guestsSelectorLabel}: ${guestsValue}`}
        onPress={() => setOpen(true)}
      >
        <User size={24} color={colors.text.primary} weight="regular" />
        <Text style={styles.selectorValue} numberOfLines={1}>
          {guestsValue}
        </Text>
      </Pressable>

      {/* Колёса — ТЕ ЖЕ, что в фильтрах каталога (`WheelPicker`): второе
          колесо означало бы два разных списка дат в одном приложении. Выбор
          внутри черновой и уходит наверх только по «Показать заведения»;
          крестик и тап по затемнению не ищут ничего. */}
      <PartySheet
        visible={open}
        dateOptions={dates}
        guestOptions={guests}
        dateValue={dates[0].value}
        guestsValue={String(DEFAULT_GUESTS)}
        onClose={() => setOpen(false)}
        onSubmit={(party) => {
          setOpen(false);
          onSearchParty({ date: party.date, guests: Number(party.guests) });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  selector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    // Содержимое половины стоит ПО ЦЕНТРУ, а не у левого края (макет
    // node 3447:13093 — `items-center justify-center`).
    justifyContent: "center",
    gap: spacing.sm,
    height: controlHeight.pill,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.surface,
  },
  selectorLeft: {
    borderTopLeftRadius: radius.pill,
    borderBottomLeftRadius: radius.pill,
    // Волосяная линия между половинками — в макете это граница, а не зазор.
    borderRightWidth: 1,
    borderRightColor: colors.background.screen,
  },
  selectorRight: {
    borderTopRightRadius: radius.pill,
    borderBottomRightRadius: radius.pill,
  },
  selectorValue: {
    ...typography.labelMedium,
    color: colors.text.primary,
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
