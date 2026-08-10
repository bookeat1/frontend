import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookOpen, Compass, Heart, MagnifyingGlass, UserCircle } from "./icons";

const t = getDictionary();

/** The five destinations of the tab bar. Every one of them is a real route. */
type NavKey = "overview" | "search" | "bookings" | "favorites" | "profile";

interface NavItem {
  key: NavKey;
  label: string;
  icon: typeof Compass;
  route: "/" | "/search" | "/bookings" | "/favorites" | "/profile";
}

const items: NavItem[] = [
  { key: "overview", label: t.nav.overview, icon: Compass, route: "/" },
  { key: "search", label: t.nav.search, icon: MagnifyingGlass, route: "/search" },
  { key: "bookings", label: t.nav.bookings, icon: BookOpen, route: "/bookings" },
  { key: "favorites", label: t.nav.favorites, icon: Heart, route: "/favorites" },
  { key: "profile", label: t.nav.profile, icon: UserCircle, route: "/profile" },
];

/**
 * Height of the bar itself, without the home-indicator inset.
 *
 * 8 padding + 24 glyph + 4 gap + 14 label + 8 padding. Exported because the bar
 * FLOATS above the content now (see below): every screen that renders it has to
 * reserve this much room at the end of its scroll, or the last row of content
 * ends up permanently under the glass.
 */
export const NAV_BAR_HEIGHT = 58;

/**
 * How much bottom padding a scrollable screen needs so its last item clears the
 * floating bar — the bar plus the home indicator underneath it.
 */
export function useNavBarSpacing(): number {
  return NAV_BAR_HEIGHT + useSafeAreaInsets().bottom;
}

/**
 * Which tab the CURRENT route belongs to.
 *
 * Derived from the pathname rather than taken as a prop: a prop is a second
 * source of truth that goes stale the moment a screen forgets to pass it —
 * which is exactly how this bar used to claim "Поиск" while the guest was on
 * the home screen.
 *
 * `/booking/:id` (one reservation) maps to the «Бронь» tab even though that
 * screen does not render the bar today, so the mapping stays right if it ever
 * does.
 */
export function activeNavKey(pathname: string): NavKey | null {
  if (pathname === "/") return "overview";
  if (pathname.startsWith("/search")) return "search";
  if (pathname.startsWith("/bookings") || pathname.startsWith("/booking/")) return "bookings";
  if (pathname.startsWith("/favorites")) return "favorites";
  if (pathname.startsWith("/profile")) return "profile";
  return null;
}

/**
 * Bottom tab bar (Figma nodes 432:4322–432:4339).
 *
 * All five tabs navigate. Switching tabs REPLACES the current route rather
 * than pushing: tabs are siblings, not a stack, and pushing would build a back
 * history of "Обзор → Поиск → Обзор → Поиск" that nobody expects on a phone.
 * Tapping the tab you are already on does nothing, instead of remounting the
 * screen and throwing away its scroll position.
 *
 * The bar is a floating layer of frosted glass: it is positioned over the
 * screen so content scrolls UNDER it, which is the whole point of the effect —
 * a bar sitting in the layout flow would have nothing behind it to refract.
 * `GlassView` is the real iOS 26 liquid glass; below that (and on Android) the
 * component degrades to a plain view, so we paint a translucent fill ourselves
 * instead of leaving the labels floating over bare content.
 */
export function BottomNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const active = activeNavKey(pathname);
  const insets = useSafeAreaInsets();
  const glass = isLiquidGlassAvailable();

  const tabs = (
    <View style={[styles.row, { paddingBottom: insets.bottom }]}>
      {items.map(({ key, label, icon: Icon, route }) => {
        const isActive = key === active;
        const color = isActive ? colors.brand.primary : colors.text.muted;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
            onPress={() => {
              if (isActive) return;
              router.replace(route);
            }}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Icon size={24} color={color} weight="regular" />
            {/* Длинные подписи («Избранные») сжимаются в одну строку, а не
                выталкивают соседнюю вкладку за край на 360 px. */}
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (glass) {
    return (
      <GlassView style={styles.bar} glassEffectStyle="regular" colorScheme="light">
        {tabs}
      </GlassView>
    );
  }

  return <View style={[styles.bar, styles.fallback]}>{tabs}</View>;
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
  },
  fallback: {
    backgroundColor: colors.background.navBarFallback,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  item: {
    flex: 1,
    // Padding + 24pt glyph + label makes the row ~52 tall, so every tab clears
    // the 44pt touch-target rule without hitSlop (which would overlap its
    // neighbour).
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    alignItems: "center",
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    ...typography.navLabel,
  },
});
