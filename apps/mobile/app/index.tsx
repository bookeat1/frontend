import { colors, spacing } from "@bookeat/design-tokens";
import type { AuthUser, Cuisine } from "@bookeat/api";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { BottomNavBar } from "../src/components/BottomNavBar";
import { ArticlesSection } from "../src/components/explore/ArticlesSection";
import { CuisineSection } from "../src/components/explore/CuisineSection";
import { EventsListSection } from "../src/components/explore/EventsListSection";
import { HomeHeader } from "../src/components/explore/HomeHeader";
import { PromotionsSection } from "../src/components/explore/PromotionsSection";
import { RecommendedSection } from "../src/components/explore/RecommendedSection";
import { EXPLORE_DEFAULT_GUESTS } from "../src/components/explore/use-explore-data";
import { useAuth } from "../src/lib/auth";
import { useLocale } from "../src/lib/locale";

/**
 * Home — the first screen (rebuilt to the Figma home design, 2026-08-06),
 * mounted at the `/` route and reached by the Explore bottom tab.
 *
 * Shape: a compact dark header (`HomeHeader`, replaces the old promo
 * HeroCarousel) bleeding under the status bar, then a stack of full-width white
 * section blocks on the grey screen background.
 *
 * REAL DATA today: «Выбрали для вас» (popular catalog), «Выберите кухню»
 * (distinct cuisine_type values) and «Афиша» (GET /events). «Акции» and
 * «Статьи» have no endpoint yet and hide themselves cleanly (their hooks return
 * [] — see use-explore-data.ts), so the screen looks finished on real data.
 */
export default function HomeScreen() {
  // Dictionary through the context so the greeting/city labels re-render in the
  // chosen language the instant it changes (the switch lives in /settings/language).
  const { dictionary: t } = useLocale();
  const router = useRouter();
  const { status, repository } = useAuth();

  // Greeting name and city read from the SAME ["me"] query cache the profile
  // screens edit (profile.tsx / profile/edit / profile/personal-data all write
  // it via queryClient.setQueryData(["me"], updated)). Reading the auth
  // context's best-effort `user` instead left the header stale after an edit —
  // that state is only refreshed at sign-in, never after a PATCH. Same query
  // shape as profile.tsx so the two views share one source of truth, and the
  // stored city survives a restart because GET /users/me returns it.
  const me = useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: () => repository.getMe(),
    enabled: status === "signed-in",
    staleTime: 5 * 60_000,
  });
  const account = me.data ?? null;

  // Both are best-effort: a cold start with no session, or a profile that
  // hasn't answered yet, falls back to the no-name greeting and the default
  // city rather than gating the screen.
  const firstName = account?.fullName?.trim().split(/\s+/)[0];
  const greeting = firstName ? t.explore.greeting(firstName) : t.explore.greetingNoName;
  const city = account?.city?.trim() || t.explore.cityFallback;

  const openSearch = useCallback(() => router.push("/search"), [router]);
  const openNotifications = useCallback(() => router.push("/notifications"), [router]);

  // The «Афиша» section chevron opens the dedicated events list screen.
  const openEvents = useCallback(() => router.push("/events"), [router]);

  // Tapping an «Афиша» row opens that event's detail card (same target as the
  // dedicated list), instead of jumping to the host restaurant.
  const openEvent = useCallback((id: string) => router.push(`/event/${id}`), [router]);

  const openRestaurant = useCallback(
    (id: string) => router.push(`/restaurant/${id}`),
    [router],
  );

  // A cuisine chip opens the catalog pre-filtered to that cuisine. The id is
  // casefold(cuisine_type), exactly what the search filter matches on, so the
  // search screen just seeds `filters.cuisineIds` from the `cuisine` param.
  const pickCuisine = useCallback(
    (cuisine: Cuisine) =>
      router.push({ pathname: "/search", params: { cuisine: cuisine.id } }),
    [router],
  );

  return (
    <View style={styles.root}>
      {/* The header is a dark block behind the status bar — dark glyphs would
          disappear into it. Reverts to the app-wide dark bar on unmount. */}
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        // No top safe-area inset here on purpose: the header bleeds under the
        // status bar and applies the inset itself.
      >
        <HomeHeader
          greeting={greeting}
          city={city}
          dateValue={t.booking.today}
          guestsValue={t.booking.guestsCount(EXPLORE_DEFAULT_GUESTS)}
          onOpenSearch={openSearch}
          onOpenNotifications={openNotifications}
        />

        <View style={styles.sheet}>
          <RecommendedSection onSeeAll={openSearch} onOpenRestaurant={openRestaurant} />
          <CuisineSection onPickCuisine={pickCuisine} />
          {/* Hidden today (no promo endpoint) — renders nothing. */}
          <PromotionsSection />
          <EventsListSection onOpenEvent={openEvent} onSeeAll={openEvents} />
          {/* Hidden today (no articles endpoint) — renders nothing. */}
          <ArticlesSection />
        </View>
      </ScrollView>

      {/* The bar reads the active tab off the current route itself. */}
      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.screen,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  sheet: {
    // 8 of grey between the header and the white blocks, and between blocks.
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
});
