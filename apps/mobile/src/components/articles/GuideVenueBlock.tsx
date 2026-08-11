import type { GuideCollectionVenue } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CaretRight } from "../icons";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * One venue block of a «Статья» (collection) detail: the venue name with a
 * right chevron, the venue's photo (`primary_image_url`), the editor's `note`
 * as the description line, and a footer with the postal `address`.
 *
 * The whole block is one button that opens the restaurant screen
 * (`/restaurant/:restaurantId`). ONLY the address is shown in the footer — the
 * payload carries no social links / instagram for a collection venue, so none
 * is invented. The note and the address lines each hide when empty rather than
 * leaving a blank row.
 */
export function GuideVenueBlock({
  venue,
  onPress,
}: {
  venue: GuideCollectionVenue;
  onPress: (restaurantId: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.articles.openVenue(venue.name)}
      onPress={() => onPress(venue.restaurantId)}
      style={({ pressed }) => [styles.block, pressed && styles.pressed]}
    >
      <View style={styles.titleRow}>
        <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">
          {venue.name}
        </Text>
        <CaretRight size={24} color={colors.text.mutedStrong} weight="regular" />
      </View>

      <PhotoView uri={venue.imageUrl} style={styles.photo} decorative placeholderIconSize={40} />

      {venue.note ? <Text style={styles.note}>{venue.note}</Text> : null}

      {/* Адрес — строкой, без иконки: в макете (node 1001:11921) это подпись
          «адрес · @инстаграм», а не пункт с пином. Инстаграма в ответе API
          сегодня нет, поэтому остаётся один адрес. */}
      {venue.address ? (
        <View style={styles.footer}>
          <Text style={styles.address} numberOfLines={2} ellipsizeMode="tail">
            {venue.address}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  name: {
    ...typography.titleMd,
    color: colors.text.primary,
    flexShrink: 1,
  },
  photo: {
    width: "100%",
    height: 180,
    borderRadius: radius.media,
    backgroundColor: colors.background.chip,
  },
  note: {
    ...typography.body,
    color: colors.text.primary,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  address: {
    ...typography.caption,
    color: colors.text.muted,
    flexShrink: 1,
  },
});
