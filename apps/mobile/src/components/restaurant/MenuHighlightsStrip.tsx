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
 * Карточка здесь читательская — см. обоснование в `DishDetailSheet`.
 */
export function MenuHighlightsStrip({
  items,
  contentContainerStyle,
}: {
  items: MenuHighlight[];
  /** Отступы ряда задаёт экран: в брони и в подтверждении они разные. */
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const [openedDish, setOpenedDish] = useState<DishCardItem | null>(null);

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
        canAdd={false}
        onAdd={() => {}}
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
