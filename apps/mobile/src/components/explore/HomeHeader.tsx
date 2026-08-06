import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "../../lib/locale";
import { IconButton } from "../IconButton";
import { PillSelect } from "../PillSelect";
import { Bell, CalendarBlank, MapPin, User } from "../icons";

/**
 * Rebuilt home header (Figma home design, 2026-08-06). Replaces the old promo
 * `HeroCarousel`: a compact dark block that runs under the status bar and
 * holds — the city (top-left), a notification bell (top-right, no badge: the
 * notifications feed endpoint does not exist yet, so there is no real unread
 * count to show and a fabricated one would lie), a large personalised
 * greeting, and a date/guests selector row.
 *
 * The dark fill (`colors.background.header`) stands in for the design's dark
 * restaurant photo: the backend has no home-header image endpoint, so a flat
 * surface is honest where a fabricated photo would not be. The screen flips the
 * status bar to light content while this is on screen.
 *
 * Both selector pills reuse `PillSelect` (the same control the booking screen
 * uses) and route into `/search` — the home screen keeps no date/guests state
 * of its own, so a tap simply opens the catalog where the real picker lives.
 *
 * The bell opens the «Уведомления» screen (`/notifications`). It carries no
 * unread badge yet: there is no feed endpoint to count from, and a made-up
 * count would be a lie. Add the badge here the day the feed exists and can
 * supply a real number.
 */
export function HomeHeader({
  greeting,
  city,
  dateValue,
  guestsValue,
  onOpenSearch,
  onOpenNotifications,
}: {
  greeting: string;
  city: string;
  dateValue: string;
  guestsValue: string;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
}) {
  const { dictionary: t } = useLocale();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.topRow}>
        <View style={styles.city} accessibilityRole="text" accessibilityLabel={t.explore.cityLabel(city)}>
          <MapPin size={20} color={colors.text.onDark} weight="fill" />
          <Text style={styles.cityLabel} numberOfLines={1}>
            {city}
          </Text>
        </View>

        <IconButton
          icon={Bell}
          tone="onDark"
          accessibilityLabel={t.notifications.title}
          onPress={onOpenNotifications}
        />
      </View>

      {/* Long RU first names wrap to a second line instead of pushing the
          header taller in one unreadable line. */}
      <Text style={styles.greeting} numberOfLines={2}>
        {greeting}
      </Text>

      <View style={styles.selectorRow}>
        <PillSelect
          icon={CalendarBlank}
          accessibilityLabel={t.explore.dateSelectorLabel}
          value={dateValue}
          onPress={onOpenSearch}
        />
        <PillSelect
          icon={User}
          accessibilityLabel={t.explore.guestsSelectorLabel}
          value={guestsValue}
          onPress={onOpenSearch}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background.header,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    // The white sheet below overlaps this block's rounded bottom by the same
    // amount the old hero used, so keep room for that overlap.
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    gap: spacing.lg,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  city: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1,
  },
  cityLabel: {
    ...typography.labelSemiBold,
    color: colors.text.onDark,
    flexShrink: 1,
  },
  greeting: {
    ...typography.titleXl,
    color: colors.text.onDark,
  },
  selectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
