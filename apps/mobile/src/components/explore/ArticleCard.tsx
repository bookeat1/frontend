import { colors, exploreLayout, listCard, radius, spacing, typography } from "@bookeat/design-tokens";
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
   * Как карточка занимает место (макет 986:8697):
   *   full — первая статья, во всю ширину блока;
   *   half — следующие, по две в ряд;
   *   strip — фиксированная ширина для горизонтальной ленты.
   *
   * Размер здесь не украшение, а порядок чтения: первая статья крупнее,
   * потому что она свежая, а не потому что «так красивее».
   */
  variant = "strip",
}: {
  article: ArticleCardData;
  onPress: () => void;
  variant?: "full" | "half" | "strip";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.articles.card(article.title, article.author)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        variant === "full" && styles.cardFull,
        variant === "half" && styles.cardHalf,
        pressed && styles.pressed,
      ]}
    >
      <PhotoView
        uri={article.coverImageUrl ?? undefined}
        style={[
          styles.photo,
          variant === "full" && styles.photoFull,
          variant === "half" && styles.photoHalf,
        ]}
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
  // Половина ряда: ширину задаёт flex, а не проценты, — иначе промежуток между
  // карточками пришлось бы вычитать из процентов вручную и он бы «плыл» на
  // экранах разной ширины.
  cardHalf: {
    flex: 1,
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
  // Высота общей карточки листингов (`listCard.coverHeight`) — та же, что у
  // поиска, избранного и акций: один и тот же материал не должен выглядеть
  // по-разному на двух экранах, а на главную гость попадает раньше всего.
  // На экране «Статьи» карточки с 27.08.2026 свои — журнальные
  // `GuideEditorialCard` со своими высотами (214 и 206).
  photoFull: {
    width: "100%",
    height: listCard.coverHeight,
    borderRadius: radius.photoHero,
  },
  // Ниже ростом, чем первая: в половину ширины кадр той же высоты выглядел бы
  // непропорционально вытянутым.
  photoHalf: {
    width: "100%",
    height: 104,
    borderRadius: radius.photoHero,
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
