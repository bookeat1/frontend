import type { EventSummary } from "@bookeat/api";
import { colors, exploreLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatEventDateBlock, formatRelativeDateTime, formatTime } from "../../lib/format";
import { PhotoView } from "../PhotoView";
import { TagChips } from "../TagChips";

const t = getDictionary();

/**
 * One row of the vertical «Афиша» list — REAL DATA (GET /events).
 *
 * Layout: a left date block (число + месяц), the title with a «venue · time»
 * line, real `tags` chips under it, and a right thumbnail.
 *
 * Tags are the venue's own labels ("Бранч", "Живая музыка"), now carried on the
 * event payload as a top-level `tags` array. The chip row hides itself when the
 * event has none (see TagChips) — no fabricated labels.
 */
export function EventRow({
  event,
  onOpenEvent,
}: {
  event: EventSummary;
  onOpenEvent: (eventId: string) => void;
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
        <TagChips tags={event.tags} />
      </View>

      <PhotoView uri={event.coverImageUrl} style={styles.thumb} decorative placeholderIconSize={24} />
    </>
  );

  // Tapping a row opens the event's detail card (same target as the full «Афиша»
  // list). Without an event id there is nowhere to go, so it stays a plain block.
  if (!event.id) {
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
      onPress={() => onOpenEvent(event.id)}
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
