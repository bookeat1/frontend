import type { GuideCollection } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * One card of the «Статьи» list screen (design: full-width cover ~148h, then a
 * bold title and the constant «От BookEat» byline). The whole card is one
 * button that opens the collection detail (`/articles/:slug`).
 *
 * NO author from the payload and NO favourite heart: the byline is editorial
 * and constant, and there is no favourite-an-article endpoint (see ArticleCard).
 */
export function ArticleListCard({
  collection,
  onPress,
}: {
  collection: GuideCollection;
  onPress: (slug: string) => void;
}) {
  const byline = t.explore.articleAuthorDefault;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.articles.card(collection.title, byline)}
      onPress={() => onPress(collection.slug)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <PhotoView
        uri={collection.coverImageUrl}
        style={styles.cover}
        decorative
        placeholderIconSize={40}
      />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {collection.title}
        </Text>
        <Text style={styles.byline} numberOfLines={1} ellipsizeMode="tail">
          {byline}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  cover: {
    width: "100%",
    height: 148,
    borderRadius: radius.photoHero,
    backgroundColor: colors.background.chip,
  },
  body: {
    gap: spacing.xxs,
  },
  title: {
    ...typography.titleMd,
    color: colors.text.primary,
  },
  byline: {
    ...typography.body,
    color: colors.text.muted,
  },
});
