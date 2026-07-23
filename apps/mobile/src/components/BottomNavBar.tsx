import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BookOpen, Compass, Heart, MagnifyingGlass, UserCircle } from "./icons";

const t = getDictionary();

type NavKey = "overview" | "search" | "bookings" | "favorites" | "profile";

const items: { key: NavKey; label: string; icon: typeof Compass }[] = [
  { key: "overview", label: t.nav.overview, icon: Compass },
  { key: "search", label: t.nav.search, icon: MagnifyingGlass },
  { key: "bookings", label: t.nav.bookings, icon: BookOpen },
  { key: "favorites", label: t.nav.favorites, icon: Heart },
  { key: "profile", label: t.nav.profile, icon: UserCircle },
];

/**
 * Bottom tab bar shown on the search screens (Figma nodes 432:4322–432:4339).
 * Only the "Поиск" destination is wired to a real route today — the other
 * four tabs aren't built yet, so they render inert (see delivery report).
 */
export function BottomNavBar({ active = "search" }: { active?: NavKey }) {
  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <View style={styles.row}>
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          const color = isActive ? colors.brand.primary : colors.text.muted;
          return (
            <View key={key} style={styles.item} accessibilityElementsHidden={key !== active}>
              <Icon size={24} color={color} weight="regular" />
              <Text style={[styles.label, { color }]}>{label}</Text>
            </View>
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
    height: 52,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  label: {
    ...typography.navLabel,
  },
});
