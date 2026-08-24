import type { EventSummary } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDayMonth, formatRelativeDateTime, formatTime } from "../../lib/format";
import { PhotoView } from "../PhotoView";
import { TagChips } from "../TagChips";

const t = getDictionary();

/**
 * One card of the «Афиша» list screen (design: full-width cover on top, then a
 * bold title, a «venue · date · time» line, and the event's `tags` as grey
 * chips under it).
 *
 * Tags are the venue's own labels ("Бранч", "Живая музыка"), carried on the
 * event payload. The chip row hides itself when the event has none (see
 * TagChips) — no fabricated labels.
 *
 * Unlike EventRow (the compact Home row that opens the venue), this card opens
 * the event DETAIL screen — the whole card is one button.
 *
 * КАРТОЧКА ДЕРЖИТ БОКОВЫЕ ОТСТУПЫ САМА и делает это по-разному для фотографии
 * (8) и для текста (16). Контейнер списка не должен добавлять свой
 * `paddingHorizontal` — он сложится с этими.
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
      <View style={styles.coverWrap}>
        <PhotoView uri={event.coverImageUrl} style={styles.cover} decorative placeholderIconSize={40} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {event.title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2} ellipsizeMode="tail">
            {subtitle}
          </Text>
        ) : null}
        <TagChips tags={event.tags} />
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
  // Фотография отступает от края экрана на 8, подпись под ней — на 16, как на
  // карточке поиска и как на обложке подборки. Отступ живёт ЗДЕСЬ, а не на
  // контейнере списка: общий отступ у списка складывался бы с этим и отжимал
  // фотографию дальше положенного (та же ошибка, что чинили на поиске).
  coverWrap: {
    paddingHorizontal: spacing.sm,
  },
  cover: {
    width: "100%",
    height: 148,
    borderRadius: radius.photoHero,
    backgroundColor: colors.background.chip,
  },
  body: {
    paddingHorizontal: spacing.lg,
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
