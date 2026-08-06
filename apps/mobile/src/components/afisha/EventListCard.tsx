import type { EventSummary } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDayMonth, formatRelativeDateTime, formatTime } from "../../lib/format";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * One card of the «Афиша» list screen (design: full-width cover on top, then a
 * bold title and a «venue · date · time» line).
 *
 * NO TAG CHIPS. The design draws grey chips ("Бранч", "Живая музыка"), but an
 * event carries no tags/categories anywhere in the backend (no column, no join
 * table, nothing on the payload — see types.ts EventSummary and the same call
 * in EventRow). Rendering a fabricated label would be inventing data, so the
 * chip row is omitted until the backend grows real tags. The layout already
 * reads complete without it.
 *
 * Unlike EventRow (the compact Home row that opens the venue), this card opens
 * the event DETAIL screen — the whole card is one button.
 */
export function EventListCard({
  event,
  onPress,
}: {
  event: EventSummary;
  onPress: (eventId: string) => void;
}) {
  const startsAt = new Date(event.startsAt);
  const dayMonth = Number.isNaN(startsAt.getTime()) ? "" : formatDayMonth(startsAt);
  const time = formatTime(event.startsAt);
  const venue = event.restaurant.name || event.venue;
  const subtitle = t.afisha.subtitle([venue, dayMonth, time]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.afisha.card(
        event.title,
        formatRelativeDateTime(event.startsAt),
        event.restaurant.name,
      )}
      onPress={() => onPress(event.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <PhotoView uri={event.coverImageUrl} style={styles.cover} decorative placeholderIconSize={40} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {event.title}
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
    height: 180,
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
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
  },
});
