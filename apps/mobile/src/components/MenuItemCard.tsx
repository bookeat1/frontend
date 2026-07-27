import type { MenuHighlight } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PhotoView } from "./PhotoView";

const ITEM_WIDTH = 180;
const ITEM_HEIGHT = 120;

/**
 * Карточка блюда в ленте «Из меню» — Figma nodes 340:2601–340:2614.
 *
 * Фото может не быть: в живой базе его нет НИ У ОДНОГО блюда (проверено
 * 2026-07-26). Вместо картинки рисуется ровная плашка со столовым прибором —
 * она читается как «фотографии нет», а не как «картинка не загрузилась», и
 * точно не как сломанная карточка. Название, описание и цена при этом
 * настоящие.
 */
export function MenuItemCard({ item }: { item: MenuHighlight }) {
  return (
    <View style={styles.card}>
      {/* Плашка «фото нет» больше не живёт здесь: она переехала в PhotoView,
          вместе с тем же случаем для заведений и для фото, которое не
          загрузилось. Вид у неё тот же — ровный фон и приглушённый прибор. */}
      <PhotoView uri={item.photo?.uri} alt={item.photo?.alt} style={styles.image} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {/* У большинства живых блюд описание пустое, а цена изредка не
            заполнена — пустые строки просто не рисуем. */}
        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        {item.price ? <Text style={styles.price}>{item.price}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: ITEM_WIDTH,
    gap: spacing.md,
  },
  image: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  body: {
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  name: {
    ...typography.itemName,
    color: colors.text.strong,
  },
  description: {
    ...typography.caption,
    color: colors.text.muted,
  },
  price: {
    ...typography.itemName,
    color: colors.text.strong,
  },
});
