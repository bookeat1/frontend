import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
 */
export function BottomNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const active = activeNavKey(pathname);

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <View style={styles.row}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
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
