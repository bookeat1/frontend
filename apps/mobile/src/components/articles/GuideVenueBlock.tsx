import type { GuideCollectionVenue } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CaretRight } from "../icons";
import { PhotoRail } from "../PhotoRail";

const t = getDictionary();

/** Instagram as the design writes it — «@handle», not a URL. The venue field
 * holds whatever the cabinet typed: a full link, a bare handle, sometimes with
 * a trailing slash. Everything before the handle is dropped and one «@» is put
 * back, so «https://instagram.com/mongol.almaty/» and «mongol.almaty» print
 * identically. A value that survives to nothing (a bare link to the site root)
 * prints nothing rather than a lone «@». */
export function instagramHandle(raw: string): string {
  const handle = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0];
  return handle ? `@${handle}` : "";
}

/**
 * One venue block of a «Статья» (collection) detail.
 *
 * Two shapes, one component, because the payload has two:
 *  - a plain venue card — the name, the venue's photo, the editor's note;
 *  - the design's richer block (node 1001:11921), when the editor illustrated
 *    the venue with an EVENT or a PROMO: the item's own title and text over a
 *    RAIL of its photos, which is why the gallery was added server-side at all.
 *
 * The footer is the design's «адрес · @инстаграм». The instagram belongs to the
 * VENUE (the collection payload carries the venue's own link); when the venue
 * has none the separator goes with it rather than leaving a dangling «·».
 *
 * The whole block is one button that opens the restaurant screen — including
 * the highlighted variant: a guest reading about the venue's Wednesday event
 * wants the venue, and the event has its own card elsewhere in the app.
 */
export function GuideVenueBlock({
  venue,
  onPress,
}: {
  venue: GuideCollectionVenue;
  onPress: (restaurantId: string) => void;
}) {
  // The rail is inside a padded card, so the screen width is not the frame
  // width — measure the block's own content box instead of re-deriving every
  // enclosing padding here (the article screen's, and this block's).
  const [contentWidth, setContentWidth] = React.useState(0);

  const highlight = venue.highlight;
  const photos = highlight ? [highlight.coverImageUrl, ...highlight.images] : [venue.imageUrl];
  const handle = instagramHandle(venue.instagram);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.articles.openVenue(venue.name)}
      onPress={() => onPress(venue.restaurantId)}
      style={({ pressed }) => [styles.block, pressed && styles.pressed]}
      onLayout={(e) =>
        setContentWidth(Math.max(0, e.nativeEvent.layout.width - spacing.lg * 2))
      }
    >
      <View style={styles.titleRow}>
        <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">
          {venue.name}
        </Text>
        <CaretRight size={24} color={colors.text.mutedStrong} weight="regular" />
      </View>

      <PhotoRail
        uris={photos}
        height={180}
        inset={0}
        // Before the first layout pass the width is unknown; the rail then
        // falls back to its screen-width default, which is only ever visible
        // for one frame and never for the single-photo case.
        frameWidth={contentWidth > 0 ? contentWidth : undefined}
        borderRadius={radius.media}
      />

      {/* Заголовок и текст события/акции — над адресом заведения, как в макете.
          У простого блока их нет, и остаётся редакционная заметка. */}
      {highlight?.title ? <Text style={styles.highlightTitle}>{highlight.title}</Text> : null}
      {highlight?.description ? <Text style={styles.note}>{highlight.description}</Text> : null}
      {venue.note ? <Text style={styles.note}>{venue.note}</Text> : null}

      {/* Адрес — строкой, без иконки: в макете (node 1001:11921) это подпись
          «адрес · @инстаграм», а не пункт с пином. */}
      {venue.address || handle ? (
        <View style={styles.footer}>
          <Text style={styles.address} numberOfLines={2} ellipsizeMode="tail">
            {[venue.address, handle].filter(Boolean).join(" · ")}
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
  highlightTitle: {
    ...typography.titleSm,
    color: colors.text.primary,
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
