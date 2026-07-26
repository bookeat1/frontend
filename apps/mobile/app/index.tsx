import type { AvailabilitySlot, RestaurantSummary } from "@bookeat/api";
import { colors, exploreLayout, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { BottomNavBar } from "../src/components/BottomNavBar";
import { CardStrip } from "../src/components/explore/CardStrip";
import { DishCard } from "../src/components/explore/DishCard";
import { EventsSection } from "../src/components/explore/EventsSection";
import { ExploreSearchField } from "../src/components/explore/ExploreSearchField";
import { HeroCarousel } from "../src/components/explore/HeroCarousel";
import { PopularSection } from "../src/components/explore/PopularSection";
import { SectionCard, SectionHeader } from "../src/components/explore/SectionCard";
import {
  EXPLORE_DEFAULT_GUESTS,
  exploreDateKey,
  useChefsPicks,
  useGastroguide,
  useHeroBanners,
} from "../src/components/explore/use-explore-data";

const t = getDictionary();

/**
 * Explore — the home screen (Figma "BookEat Copy" / «🟠 В работе» / Explore,
 * node 488:9875, frame 408:3550; built from the render
 * `design-ref/screen-explore.png`, which is 375 wide at 1:1).
 *
 * Shape: a full-bleed hero carousel running under the status bar, then a
 * white sheet that overlaps it by 20 and holds a stack of white section
 * blocks separated by the grey screen background.
 *
 * REAL DATA: «Популярные заведения» (catalog + today's availability) and
 * «События» (GET /events). The remaining blocks are driven by
 * `src/components/explore/placeholder.ts`, which names the missing endpoint
 * for each one.
 */
export default function ExploreScreen() {
  const router = useRouter();

  const banners = useHeroBanners();
  const chefsPicks = useChefsPicks();
  const gastroguide = useGastroguide();

  const openSearch = useCallback(() => router.push("/search"), [router]);

  const openRestaurant = useCallback(
    (id: string) => router.push(`/restaurant/${id}`),
    [router],
  );

  /**
   * A time pill goes straight into the booking flow, pre-filled.
   *
   * The flow's layout reads `date` / `startsAt` / `guests` and hands them to
   * the draft (app/restaurant/[id]/book/_layout.tsx), so the guest lands with
   * the day, the party size and that exact time already chosen. If the slot
   * has been taken in the meantime, the flow keeps the date and the party,
   * clears the time and says so — see PrefillOutcome in
   * src/lib/booking-draft.tsx.
   */
  const openBookingWithSlot = useCallback(
    (restaurant: RestaurantSummary, slot: AvailabilitySlot) => {
      router.push({
        pathname: "/restaurant/[id]/book",
        params: {
          id: restaurant.id,
          date: exploreDateKey(),
          startsAt: slot.startsAt,
          guests: String(EXPLORE_DEFAULT_GUESTS),
        },
      });
    },
    [router],
  );

  return (
    <View style={styles.root}>
      {/* The hero is a dark photo behind the status bar — dark glyphs would
          disappear into it. Reverts to the app-wide dark bar on unmount. */}
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        // No top safe-area inset on purpose: the hero must bleed under the
        // status bar exactly as in the reference.
      >
        <HeroCarousel banners={banners} />

        <View style={styles.sheet}>
          <SectionCard>
            <ExploreSearchField onPress={openSearch} />
            <PopularSection
              onSeeAll={openSearch}
              onOpenRestaurant={openRestaurant}
              onPickSlot={openBookingWithSlot}
            />
          </SectionCard>

          <SectionCard>
            <SectionHeader title={t.explore.chefsPicksTitle} />
            <CardStrip
              data={chefsPicks}
              keyExtractor={(dish) => dish.id}
              accessibilityLabel={t.explore.chefsPicksTitle}
              renderItem={({ item }) => (
                <DishCard dish={item} onOpenRestaurant={openRestaurant} />
              )}
            />
          </SectionCard>

          <SectionCard>
            <SectionHeader title={t.explore.gastroguideTitle} />
            <CardStrip
              data={gastroguide}
              keyExtractor={(dish) => dish.id}
              accessibilityLabel={t.explore.gastroguideTitle}
              renderItem={({ item }) => (
                <DishCard dish={item} onOpenRestaurant={openRestaurant} />
              )}
            />
          </SectionCard>

          <SectionCard>
            {/* Owns its own query and all four of its states — see
                EventsSection. */}
            <EventsSection onOpenRestaurant={openRestaurant} />
          </SectionCard>
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
    marginTop: -exploreLayout.sheetOverlap,
    // 8 of grey between white blocks — measured at the centre of the render,
    // where the 20pt corner radius doesn't widen the gap.
    gap: spacing.sm,
  },
});
