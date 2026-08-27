import type { MenuHighlight } from "@bookeat/api";
import { spacing } from "@bookeat/design-tokens";
import React, { useState } from "react";
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { MenuItemCard } from "../MenuItemCard";
import { dishCardFromHighlight, type DishCardItem } from "../../lib/dish-card";
import { DishDetailSheet } from "./DishDetailSheet";

/**
 * Лента «Популярное в меню» вместе с карточкой блюда, которая по ней
 * открывается.
 *
 * Заведена потому, что лента жила в трёх экранах тремя копиями, и в двух из
 * них — на экране брони и на экране подтверждения — она была МЁРТВОЙ: карточки
 * выглядели нажимаемыми (фото, название, цена в ряд, горизонтальная
 * прокрутка), но `MenuItemCard` без `onPress` не является кнопкой вовсе, и тап
 * не делал ничего. Теперь тап открывает карточку блюда прямо поверх экрана.
 *
 * Именно шторка, а не переход на экран меню: обе ленты стоят ВНУТРИ флоу
 * брони, где живёт черновик (`booking-draft`), и уход на другой экран стоил бы
 * гостю набранного предзаказа и выбранного слота. Закрыв карточку, он остаётся
 * ровно там, где был.
 *
 * Карточка — ТА ЖЕ, что открывается из экрана меню, и с 2026-08-27 с тем же
 * действием «счётчик + Добавить · итого»: владелец сравнил два экрана рядом и
 * попросил, чтобы они не отличались. Раньше действия здесь не было по честной
 * причине — у блюда из ленты не было цены ЧИСЛОМ, а считать итог из строки
 * «8 990 ₸» значило бы придумывать деньги. Теперь сервер отдаёт `price_minor`,
 * и та же кнопка считает по настоящей цене.
 *
 * Если числа всё же нет (старая сборка бэкенда, незаполненная цена) — кнопки
 * снова НЕТ. Правило не «показать и понадеяться», а «нет числа — нет
 * действия».
 */
export function MenuHighlightsStrip({
  items,
  contentContainerStyle,
  onAdd,
}: {
  items: MenuHighlight[];
  /** Отступы ряда задаёт экран: в брони и в подтверждении они разные. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * Кладёт блюдо в черновик предзаказа. Не передан — лента читательская
   * (заведение не принимает онлайн-бронь, добавлять некуда).
   *
   * Оба экрана передают сюда ОДИН общий колбэк `useAddDishToPreorder`, чтобы
   * «Добавить» с ленты означало на них одно и то же.
   */
  onAdd?: (dish: DishCardItem, quantity: number) => void;
}) {
  const [openedDish, setOpenedDish] = useState<DishCardItem | null>(null);

  // Считать итог не из чего — кнопки нет. Ровно то же правило, что у строки
  // меню (`canAddDish` в restaurant/[id]/menu.tsx).
  const canAdd = onAdd !== undefined && openedDish?.priceMinor != null;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, contentContainerStyle]}
      >
        {items.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            onPress={() => setOpenedDish(dishCardFromHighlight(item))}
          />
        ))}
      </ScrollView>

      <DishDetailSheet
        dish={openedDish}
        canAdd={canAdd}
        onAdd={(quantity) => {
          const dish = openedDish;
          // Закрываем ПЕРЕД добавлением: гость остаётся на своём экране, а
          // счётчик предзаказа над лентой обновляется у него на глазах.
          setOpenedDish(null);
          if (dish) onAdd?.(dish, quantity);
        }}
        onClose={() => setOpenedDish(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
