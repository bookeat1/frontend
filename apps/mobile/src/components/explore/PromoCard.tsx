import { colors, exploreLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { usePromoFavorite } from "../../hooks/useFavorites";
import { PhotoView } from "../PhotoView";
import { FavoriteButton } from "./FavoriteButton";
import type { PromoStripItem } from "./placeholder";

const t = getDictionary();

/**
 * One «Акции» promo tile: photo with a red discount badge, an inert heart, a
 * title and a «venue · time» subtitle.
 *
 * Сердечко сохраняет САМУ АКЦИЮ (`PUT|DELETE /promos/:id/favorite`). Раньше
 * оно было нарисованным и неактивным: эндпоинта «в избранное акцию» у бэкенда
 * не было, и заведомо мёртвая иконка честнее, чем локальный `useState`,
 * который забывает нажатие. Теперь эндпоинт есть.
 */
export function PromoCard({ promo }: { promo: PromoStripItem }) {
  const favorite = usePromoFavorite(promo.id);

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
        <FavoriteButton
          itemName={promo.title}
          isFavorite={favorite.isFavorite}
          onToggle={favorite.toggle}
        />
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
