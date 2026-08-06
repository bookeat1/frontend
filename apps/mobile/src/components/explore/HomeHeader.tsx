import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "../../lib/locale";
import { PillSelect } from "../PillSelect";
import { Bell, CalendarBlank, MapPin, User } from "../icons";

/**
 * Rebuilt home header (Figma home design, 2026-08-06). Replaces the old promo
 * `HeroCarousel`: a compact dark block that runs under the status bar and
 * holds — the city (top-left), a static notification bell (top-right, no
 * badge: there is no notifications endpoint yet), a large personalised
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
 * The bell is a STATIC icon, not a button: there is no notifications endpoint
 * or screen to open, and a control that navigates nowhere is worse than none.
 * It is hidden from screen readers for the same reason (nothing to announce).
 * Turn it into an `IconButton` the day a notifications screen exists.
 */
export function HomeHeader({
  greeting,
  city,
  dateValue,
  guestsValue,
  onOpenSearch,
}: {
  greeting: string;
  city: string;
  dateValue: string;
  guestsValue: string;
  onOpenSearch: () => void;
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

        <View
          style={styles.bell}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Bell size={24} color={colors.text.onDark} weight="regular" />
        </View>
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
  bell: {
    width: hitSlop.minTouchTarget,
    height: hitSlop.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
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
