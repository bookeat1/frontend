import type { GuideCollection } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PhotoView } from "../PhotoView";
import { toGridRows } from "./guide-collections";

const t = getDictionary();

/**
 * Сетка «Подборки» гастрогида (макет 1099:6837/1100:7086): две плитки в ряд,
 * кадр 128 со скруглением 20, под ним название и строка описания.
 *
 * ПЛИТКА ОТКРЫВАЕТ ПОДБОРКУ (`/articles/:slug`), а не отбирает список под
 * собой: экран подборки в продукте есть, и это ровно та карточка, которую ждёт
 * гость, нажимая на фотографию. Прежний отбор по рубрике был нашей выдумкой и
 * снят по итогам просмотра на устройстве.
 *
 * Плитку кормит САМА ПОДБОРКА, а не рубрика: гостевая ручка рубрик отдаёт
 * `{id, slug, title, position}` — ни обложки, ни подписи, и плитка выходила
 * пустой плашкой. У подборки есть и `cover_image_url`, и `description` —
 * ровно то, что рисует макет. Обложки нет — стандартная плашка «фото нет»
 * (та же, что у заведения без фотографии), выдуманной картинки тут не будет.
 */

/** Высота кадра плитки (node 1099:6839). */
const TILE_PHOTO_HEIGHT = 128;

export function GuideCollectionGrid({
  collections,
  onPress,
}: {
  collections: GuideCollection[];
  onPress: (slug: string) => void;
}) {
  if (collections.length === 0) return null;

  return (
    <View style={styles.grid}>
      {toGridRows(collections).map((row) => (
        <View key={row.map((collection) => collection.slug).join("|")} style={styles.row}>
          {row.map((collection) => (
            <CollectionTile key={collection.slug} collection={collection} onPress={onPress} />
          ))}
          {/* Пустышка в неполном ряду: без неё одинокая плитка растянулась бы
              на всю ширину и перестала быть частью сетки. */}
          {row.length === 1 ? <View style={styles.filler} /> : null}
        </View>
      ))}
    </View>
  );
}

function CollectionTile({
  collection,
  onPress,
}: {
  collection: GuideCollection;
  onPress: (slug: string) => void;
}) {
  const summary = collection.subtitle || collection.description;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={summary ? t.articles.card(collection.title, summary) : collection.title}
      onPress={() => onPress(collection.slug)}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <PhotoView
        uri={collection.coverImageUrl}
        style={styles.photo}
        decorative
        placeholderIconSize={32}
      />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {collection.title}
        </Text>
        {summary ? (
          // Описание живой подборки — целое предложение, а в макете под
          // названием стоят два-три слова. Поэтому подпись мельче карточки
          // списка (12 против 14) и обрезается на второй строке: плитка шириной
          // 160 на 360 px иначе разъезжает ряд.
          <Text style={styles.summary} numberOfLines={2} ellipsizeMode="tail">
            {summary}
          </Text>
        ) : null}
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
    gap: spacing.xxs,
  },
  title: {
    ...typography.itemName,
    color: colors.text.strong,
  },
  summary: {
    ...typography.caption,
    color: colors.text.muted,
  },
});
