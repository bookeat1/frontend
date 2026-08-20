import type { GuideCategory } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PhotoView } from "../PhotoView";
import { toGridRows } from "./guide-categories";

const t = getDictionary();

/**
 * Сетка рубрик гастрогида (макет 1099:6837/1100:7086): две плитки в ряд,
 * кадр 128 со скруглением 20, под ним название.
 *
 * ЧЕГО В ДАННЫХ НЕТ. Гостевая ручка `GET /gastroguide/categories` отдаёт
 * ровно `{id, slug, title, position}` — ни картинки, ни подписи, хотя макет
 * рисует и то, и другое. Поэтому кадр плитки — стандартная плашка «фото нет»
 * (та же, что у заведения без фотографии), а строки-подписи под названием нет
 * вовсе: выдуманная подпись врала бы про содержимое рубрики. Появится поле у
 * бэкенда — плитка оживёт без правки раскладки.
 *
 * Плитка работает ФИЛЬТРОМ списка подборок под сеткой, а не переходом на
 * отдельный экран: отдельного экрана рубрики в продукте нет, а плитка, которая
 * при нажатии ничего не делает, — тот самый мёртвый контрол, который из этого
 * приложения уже убирали. Повторное нажатие снимает отбор.
 */

/** Высота кадра плитки (node 1099:6839). */
const TILE_PHOTO_HEIGHT = 128;

export function GuideCategoryGrid({
  categories,
  selectedSlug,
  onToggle,
}: {
  categories: GuideCategory[];
  selectedSlug: string | null;
  onToggle: (slug: string) => void;
}) {
  if (categories.length === 0) return null;

  return (
    <View style={styles.grid}>
      {toGridRows(categories).map((row) => (
        <View key={row.map((category) => category.slug).join("|")} style={styles.row}>
          {row.map((category) => (
            <CategoryTile
              key={category.slug}
              category={category}
              selected={category.slug === selectedSlug}
              onToggle={onToggle}
            />
          ))}
          {/* Пустышка в неполном ряду: без неё одинокая плитка растянулась бы
              на всю ширину и перестала быть частью сетки. */}
          {row.length === 1 ? <View style={styles.filler} /> : null}
        </View>
      ))}
    </View>
  );
}

function CategoryTile({
  category,
  selected,
  onToggle,
}: {
  category: GuideCategory;
  selected: boolean;
  onToggle: (slug: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      // aria-selected, а не accessibilityState: RN разворачивает aria-* в
      // нативное состояние сам, а react-native-web выносит его в DOM — так
      // отбор виден и голосовому доступу, и тесту.
      aria-selected={selected}
      accessibilityLabel={t.articles.rubricFilter(category.title)}
      onPress={() => onToggle(category.slug)}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <PhotoView
        uri={undefined}
        style={styles.photo}
        decorative
        placeholderIconSize={32}
      />
      <View style={styles.body}>
        <Text
          style={[styles.title, selected && styles.titleSelected]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {category.title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.xxl,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    gap: spacing.sm,
  },
  filler: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  photo: {
    width: "100%",
    height: TILE_PHOTO_HEIGHT,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  body: {
    paddingHorizontal: spacing.xs,
  },
  title: {
    ...typography.itemName,
    color: colors.text.strong,
  },
  titleSelected: {
    // Выбранная рубрика помечена цветом бренда — тем же, которым помечена
    // активная вкладка внизу. Своего состояния «выбрано» у плитки в макете
    // нет: фильтра там нет вовсе.
    color: colors.brand.primary,
  },
});
