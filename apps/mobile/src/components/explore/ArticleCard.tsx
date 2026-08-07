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
}: {
  article: ArticleCardData;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.articles.card(article.title, article.author)}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <PhotoView
        uri={article.coverImageUrl ?? undefined}
        style={styles.photo}
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
  pressed: {
    opacity: 0.7,
  },
  photo: {
    width: exploreLayout.cardWidth,
    height: exploreLayout.cardPhotoHeight,
    borderRadius: radius.media,
    backgroundColor: colors.background.bannerPlaceholder,
  },
  text: {
    gap: spacing.xxs,
  },
  title: {
    ...typography.titleSm,
    color: colors.text.primary,
  },
  author: {
    ...typography.body,
    color: colors.text.muted,
  },
});
