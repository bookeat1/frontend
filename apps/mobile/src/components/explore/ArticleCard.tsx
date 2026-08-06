import { colors, exploreLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PhotoView } from "../PhotoView";
import { InertFavoriteHeart } from "./FavoriteButton";
import type { ArticleCardData } from "./placeholder";

/**
 * One «Статьи» editorial card: cover, an inert heart, a title and a byline.
 *
 * DATA IS PLACEHOLDER (no articles endpoint — see ./placeholder.ts), so the
 * section that renders this is hidden today. The heart is INERT: there is no
 * favourite-an-article endpoint to back it.
 */
export function ArticleCard({ article }: { article: ArticleCardData }) {
  return (
    <View style={styles.card}>
      <View>
        <PhotoView uri={article.coverImageUrl ?? undefined} style={styles.photo} decorative placeholderIconSize={32} />
        <InertFavoriteHeart />
      </View>

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {article.title}
        </Text>
        <Text style={styles.author} numberOfLines={1} ellipsizeMode="tail">
          {article.author}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: exploreLayout.cardWidth,
    gap: spacing.sm,
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
