import { colors, exploreLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PhotoView } from "../PhotoView";
import { InertFavoriteHeart } from "./FavoriteButton";
import type { PromoStripItem } from "./placeholder";

const t = getDictionary();

/**
 * One «Акции» promo tile: photo with a red discount badge, an inert heart, a
 * title and a «venue · time» subtitle.
 *
 * DATA IS PLACEHOLDER (no global promotions endpoint — see ./placeholder.ts),
 * so the section that renders this is hidden today. The card is final: when a
 * real promo feed lands, only the mapper changes. The heart is INERT because
 * promos are restaurant-scoped and there is no favourite-a-promo endpoint.
 */
export function PromoCard({ promo }: { promo: PromoStripItem }) {
  return (
    <View style={styles.card}>
      <View>
        <PhotoView uri={promo.imageUrl ?? undefined} style={styles.photo} decorative placeholderIconSize={32} />
        {/* The «−N%» badge is drawn only when the feed carried a discount for
            this promo; a promo without one shows the photo with no badge. */}
        {promo.discountPercent !== null ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t.explore.promoDiscount(promo.discountPercent)}</Text>
          </View>
        ) : null}
        <InertFavoriteHeart />
      </View>

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {promo.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
          {promo.subtitle}
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
  badge: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
  },
  badgeText: {
    ...typography.captionMedium,
    color: colors.text.onBrand,
  },
  text: {
    gap: spacing.xxs,
  },
  title: {
    ...typography.titleSm,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
  },
});
