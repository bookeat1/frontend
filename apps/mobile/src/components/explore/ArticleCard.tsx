import { colors, exploreLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PhotoView } from "../PhotoView";
import type { ArticleCardData } from "./placeholder";

const t = getDictionary();

/**
 * One «Статьи» editorial card: cover, title and the constant «От BookEat»
 * byline. The whole card is one button that opens the collection's detail
 * (`/articles/:slug`, the id IS the slug).
 *
 * NO favourite heart: there is no favourite-an-article endpoint, and a dead
 * toggle is worse than none (see the fake-favorite-heart bug in team-memory).
 */
export function ArticleCard({
  article,
  onPress,
  /**
   * Как карточка занимает место (макет 3z0f6dgev4HMwBAHPjTjPo, node
   * 3102:12122):
   *   full — первая статья, во всю ширину блока (node 3102:12123);
   *   strip — 256 в ширину, для горизонтальной ленты под ней (3102:12131).
   *
   * Кадр у обеих ОДИНАКОВОЙ высоты (148) и с одним скруглением (20) —
   * различает их только ширина. Первая статья крупнее, потому что она свежая,
   * а не потому что «так красивее».
   *
   * ВАРИАНТА `half` БОЛЬШЕ НЕТ. Сетка «по две в ряд» с кадром 104 была нашей
   * раскладкой по старому макету 986:8697; новый рисует под первой статьёй
   * горизонтальную ленту — ровно ту же, что у акций и афиши.
   */
  variant = "strip",
}: {
  article: ArticleCardData;
  onPress: () => void;
  variant?: "full" | "strip";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.articles.card(article.title, article.author)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        variant === "full" && styles.cardFull,
        pressed && styles.pressed,
      ]}
    >
      <PhotoView
        uri={article.coverImageUrl ?? undefined}
        style={[styles.photo, variant === "full" && styles.photoFull]}
        decorative
        placeholderIconSize={32}
      />

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {article.title}
        </Text>
        <Text style={styles.author} numberOfLines={1} ellipsizeMode="tail">
          {article.author}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: exploreLayout.cardWidth,
    gap: spacing.sm,
  },
  cardFull: {
    width: "100%",
  },
  pressed: {
    opacity: 0.7,
  },
  photo: {
    width: exploreLayout.cardWidth,
    height: exploreLayout.cardPhotoHeight,
    borderRadius: radius.card,
    backgroundColor: colors.background.bannerPlaceholder,
  },
  // Первая статья отличается от ленты ТОЛЬКО шириной: высота кадра и
  // скругление те же, что у карточки акции и афиши (node 3102:12124 —
  // `h-[148px]`, `rounded-[20px]`). БЫЛО 198 при скруглении 24 — высота
  // карточки ВЕРТИКАЛЬНЫХ листингов (`listCard.coverHeight`), которой на
  // главной взяться неоткуда: здесь тот же ряд, что у акций.
  photoFull: {
    width: "100%",
    height: exploreLayout.cardPhotoHeight,
  },
  text: {
    gap: spacing.xxs,
  },
  title: {
    ...typography.itemName,
    color: colors.text.primary,
  },
  author: {
    ...typography.body,
    color: colors.text.muted,
  },
});
