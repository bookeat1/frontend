import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { dateChoices } from "../../lib/availability-label";
import { DEFAULT_GUESTS, guestOptions } from "../../lib/availability-options";
import { toDateKey } from "../../lib/format";
import { useLocale } from "../../lib/locale";
import { CalendarBlank, User } from "../icons";
import { WheelSheet } from "../search/WheelSheet";

/**
 * Капсула «дата · гости» в шапке главной и выбор, который она открывает.
 *
 * Тап по половине поднимает НИЖНЮЮ ШТОРКУ с колесом (`WheelSheet`, макеты
 * 918:12317 и 918:12428) поверх главной — своя половина, своё колесо. Никакого
 * перехода на этом шаге не происходит: отдельного экрана выбора даты и гостей
 * в дизайне нет вовсе (правка владельца 2026-08-26). До неё тап уводил в
 * `/search` с параметром `focus`, там немедленно раскрывалась шторка фильтров,
 * и человек, назвавший всего лишь день, встречал нагруженную панель со всеми
 * фасетами сразу.
 *
 * Наверх выбор уходит ЦЕЛИКОМ — парой «дата + гости», даже когда покрутили
 * одно колесо. Это не удобство, а правило сервера: он отвечает на вопрос
 * «есть ли стол на N гостей в такой-то день» и половину запроса игнорирует,
 * поэтому недостающая половина берёт значение по умолчанию (сегодня и
 * `DEFAULT_GUESTS`) — ровно как в `AvailabilityBar` внутри фильтров.
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
  // Какая половина раскрыта колесом. `null` — шторки нет.
  const [picker, setPicker] = useState<"date" | "guests" | null>(null);
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
        onPress={() => setPicker("date")}
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
        onPress={() => setPicker("guests")}
      >
        <User size={24} color={colors.text.primary} weight="regular" />
        <Text style={styles.selectorValue} numberOfLines={1}>
          {guestsValue}
        </Text>
      </Pressable>

      {/* Обе шторки — ТОТ ЖЕ `WheelSheet`, что стоит в фильтрах каталога:
          второе колесо означало бы два разных списка дат в одном приложении.
          Выбор внутри черновой и уходит наверх только по «Готово»; крестик и
          тап по затемнению не ищут ничего. */}
      <WheelSheet
        visible={picker === "date"}
        title={t.booking.pickDateTitle}
        options={dates}
        value={dates[0].value}
        submitLabel={t.search.availabilityDone}
        closeLabel={t.search.availabilityClose}
        onClose={() => setPicker(null)}
        onSubmit={(date) => {
          setPicker(null);
          onSearchParty({ date, guests: DEFAULT_GUESTS });
        }}
      />

      <WheelSheet
        visible={picker === "guests"}
        title={t.booking.pickGuestsTitle}
        options={guests}
        value={String(DEFAULT_GUESTS)}
        submitLabel={t.search.availabilityDone}
        closeLabel={t.search.availabilityClose}
        onClose={() => setPicker(null)}
        onSubmit={(picked) => {
          setPicker(null);
          onSearchParty({ date: toDateKey(new Date()), guests: Number(picked) });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    // Капсула прижата к низу шапки: её высота фиксирована правилом, и
    // свободное место при коротком приветствии должно оставаться НАД капсулой,
    // а не висеть под ней, как было бы при раскладке сверху вниз.
    marginTop: "auto",
  },
  selector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
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
