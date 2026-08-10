import type { HomePromo } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDayMonth } from "../../lib/format";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * One card of the «Акции» list screen — the same shape as the «Афиша» card
 * (full-width cover, bold title, a muted «venue · срок» line), so the two
 * lists read as one product rather than two designs.
 *
 * What differs is what a promo actually has: no tags, and a «−N%» badge over
 * the cover when the feed carried a discount. The whole card is one button and
 * opens the promo's detail screen.
 */
export function PromotionListCard({
  promo,
  onPress,
}: {
  promo: HomePromo;
  onPress: (promoId: string) => void;
}) {
  const endsAt = new Date(promo.endsAt);
  const until = Number.isNaN(endsAt.getTime())
    ? ""
    : t.promotions.until(formatDayMonth(endsAt));
  const subtitle = t.promotions.subtitle([promo.restaurantName.trim(), until]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.promotions.card(promo.title, promo.restaurantName.trim())}
      onPress={() => onPress(promo.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View>
        <PhotoView
          uri={promo.coverImageUrl ?? undefined}
          style={styles.cover}
          decorative
          placeholderIconSize={40}
        />
        {promo.discountPercent !== null ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {t.explore.promoDiscount(promo.discountPercent)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {promo.title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2} ellipsizeMode="tail">
            {subtitle}
          </Text>
        ) : null}
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
  badge: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
  },
  badgeText: {
    ...typography.caption,
    color: colors.text.onBrand,
  },
  body: {
    gap: spacing.xxs,
  },
  title: {
    ...typography.titleMd,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
  },
});
