import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUnreadNotificationsCount } from "../../hooks/useNotifications";
import { useLocale } from "../../lib/locale";
import { IconButton } from "../IconButton";
import { PillSelect } from "../PillSelect";
import { Bell, CalendarBlank, CaretDown, MapPin, User } from "../icons";

/**
 * Rebuilt home header (Figma home design, 2026-08-06). Replaces the old promo
 * `HeroCarousel`: a compact dark block that runs under the status bar and
 * holds — the city (top-left), a notification bell (top-right, no badge: the
 * notifications feed endpoint does not exist yet, so there is no real unread
 * count to show and a fabricated one would lie), a large personalised
 * greeting, and a date/guests selector row.
 *
 * The design's dark restaurant photo now ships with the app (assets/
 * home-header.jpg, supplied 2026-08-10). It is a bundled asset rather than a
 * remote url because the backend still has no home-header image endpoint; the
 * dark fill (`colors.background.header`) stays underneath as the colour the
 * header falls back to while the image decodes. A scrim over the photo keeps
 * the white greeting, city and bell legible on its lighter areas. The screen
 * flips the status bar to light content while this is on screen.
 *
 * Both selector pills reuse `PillSelect` (the same control the booking screen
 * uses) and route into `/search` — the home screen keeps no date/guests state
 * of its own, so a tap simply opens the catalog where the real picker lives.
 *
 * The bell opens the «Уведомления» screen (`/notifications`) and carries an
 * unread badge fed by the real feed's `unread_count` (B5 Part 2), read from the
 * SAME `["notifications"]` query the screen uses — so the badge and the inbox
 * can never disagree, and it costs no extra request. The badge hides at 0 and,
 * for a signed-out guest, the query is disabled so the count is 0 (no badge).
 */
export function HomeHeader({
  greeting,
  city,
  dateValue,
  guestsValue,
  onOpenSearch,
  onOpenNotifications,
  onOpenCity,
}: {
  greeting: string;
  city: string;
  dateValue: string;
  guestsValue: string;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  /** Opens the city picker (same screen the profile uses). */
  onOpenCity: () => void;
}) {
  const { dictionary: t } = useLocale();
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadNotificationsCount();

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      {/* Photo and scrim are decorative layers BEHIND the header's controls —
          hidden from screen readers individually rather than by wrapping the
          block, which would take the city picker, the bell and both pills out
          of the accessibility tree with them. */}
      <Image
        source={require("../../../assets/home-header.jpg")}
        style={styles.photo}
        contentFit="cover"
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View
        style={styles.scrim}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={styles.topRow}>
        <Pressable
          style={({ pressed }) => [styles.city, pressed && styles.cityPressed]}
          accessibilityRole="button"
          accessibilityLabel={t.explore.cityLabel(city)}
          onPress={onOpenCity}
        >
          <MapPin size={20} color={colors.text.onDark} weight="fill" />
          <Text style={styles.cityLabel} numberOfLines={1}>
            {city}
          </Text>
          <CaretDown size={14} color={colors.text.onDark} weight="bold" />
        </Pressable>

        <View style={styles.bellWrap}>
          <IconButton
            icon={Bell}
            tone="onDark"
            accessibilityLabel={t.notifications.bell(unreadCount)}
            onPress={onOpenNotifications}
          />
          {unreadCount > 0 ? (
            // Decorative: the count is already spoken through the bell's own
            // accessibilityLabel, so the badge is hidden from the screen reader
            // and non-interactive (taps go to the button underneath).
            <View
              style={styles.badge}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Text style={styles.badgeText} numberOfLines={1}>
                {unreadCount > 9 ? "9+" : String(unreadCount)}
              </Text>
            </View>
          ) : null}
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

/** Diameter of the unread badge on the bell. A local layout constant like
 * NotificationRow's ICON_CIRCLE — not a design token, since it exists only
 * here. */
const BADGE_SIZE = 18;

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background.header,
    // The photo is clipped by the same rounded bottom as the block itself.
    overflow: "hidden",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    // The white sheet below overlaps this block's rounded bottom by the same
    // amount the old hero used, so keep room for that overlap.
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    gap: spacing.lg,
  },
  photo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay.headerScrim,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  bellWrap: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    // Sits over the bell's top-right without pushing the 44pt touch target.
    top: 4,
    right: 2,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    paddingHorizontal: 4,
    backgroundColor: colors.brand.primary,
    alignItems: "center",
    justifyContent: "center",
    // A ring in the header fill separates the badge from the white glyph.
    borderWidth: 2,
    borderColor: colors.background.header,
  },
  badgeText: {
    ...typography.captionMedium,
    fontSize: 10,
    lineHeight: 14,
    color: colors.text.onDark,
  },
  city: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1,
    // A comfortable tap target for the city picker without shifting the layout.
    minHeight: 44,
  },
  cityPressed: {
    opacity: 0.6,
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
