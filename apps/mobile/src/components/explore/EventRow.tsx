import type { EventSummary } from "@bookeat/api";
import { colors, exploreLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatEventDateBlock, formatRelativeDateTime, formatTime } from "../../lib/format";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * One row of the vertical «Афиша» list — REAL DATA (GET /events).
 *
 * Layout: a left date block (число + месяц), the title with a «venue · time»
 * line, and a right thumbnail.
 *
 * NO TAG CHIPS. The design draws grey chips under the venue line ("Бранч",
 * "Живая музыка"), but an event carries NO tags/categories ANYWHERE in the
 * backend (no column on `events`, no join table, nothing on domain.Event —
 * checked, not assumed). Nothing on the payload stands in for them (`venue` is
 * a room name, `ticketed` a payment flag). So the chip row is omitted rather
 * than filled with a fabricated label — same call the old EventCard made. Bring
 * it back when (and only when) the backend grows real tags.
 */
export function EventRow({
  event,
  onOpenRestaurant,
}: {
  event: EventSummary;
  onOpenRestaurant: (restaurantId: string) => void;
}) {
  const dateBlock = formatEventDateBlock(event.startsAt);
  const time = formatTime(event.startsAt);
  const venueName = event.restaurant.name || event.venue;
  const subtitle = venueName && time ? `${venueName} · ${time}` : venueName || time;

  const body = (
    <>
      {dateBlock ? (
        <View style={styles.dateBlock}>
          <Text style={styles.dateDay}>{dateBlock.day}</Text>
          <Text style={styles.dateMonth}>{dateBlock.month}</Text>
        </View>
      ) : (
        <View style={styles.dateBlock} />
      )}

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {event.title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
            {subtitle}
          </Text>
        ) : null}
      </View>

      <PhotoView uri={event.coverImageUrl} style={styles.thumb} decorative placeholderIconSize={24} />
    </>
  );

  // The mapper is defensive about the host venue id — without one there is
  // nowhere to navigate, so the row stays a plain block instead of a button
  // that does nothing.
  const restaurantId = event.restaurant.id || event.restaurantId;
  if (!restaurantId) {
    return <View style={styles.row}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.explore.eventCard(
        event.title,
        formatRelativeDateTime(event.startsAt),
        event.restaurant.name,
      )}
      onPress={() => onOpenRestaurant(restaurantId)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: exploreLayout.eventThumb,
  },
  pressed: {
    opacity: 0.7,
  },
  dateBlock: {
    width: 40,
    alignItems: "center",
  },
  dateDay: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  dateMonth: {
    ...typography.caption,
    color: colors.text.muted,
  },
  text: {
    flex: 1,
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
  thumb: {
    width: exploreLayout.eventThumb,
    height: exploreLayout.eventThumb,
    borderRadius: radius.media,
    backgroundColor: colors.background.bannerPlaceholder,
  },
});
