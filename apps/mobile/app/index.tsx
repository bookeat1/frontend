import type { AvailabilitySlot, RestaurantSummary } from "@bookeat/api";
import { colors, exploreLayout, spacing } from "@bookeat/design-tokens";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { BottomNavBar } from "../src/components/BottomNavBar";
import { CardStrip } from "../src/components/explore/CardStrip";
import { exploreCopy } from "../src/components/explore/copy";
import { DishCard } from "../src/components/explore/DishCard";
import { EventCard } from "../src/components/explore/EventCard";
import { ExploreSearchField } from "../src/components/explore/ExploreSearchField";
import { HeroCarousel } from "../src/components/explore/HeroCarousel";
import { PopularSection } from "../src/components/explore/PopularSection";
import { SectionCard, SectionHeader } from "../src/components/explore/SectionCard";
import {
  EXPLORE_DEFAULT_GUESTS,
  exploreDateKey,
  useChefsPicks,
  useExploreEvents,
  useGastroguide,
  useHeroBanners,
} from "../src/components/explore/use-explore-data";

/**
 * Explore — the home screen (Figma "BookEat Copy" / «🟠 В работе» / Explore,
 * node 488:9875, frame 408:3550; built from the render
 * `design-ref/screen-explore.png`, which is 375 wide at 1:1).
 *
 * Shape: a full-bleed hero carousel running under the status bar, then a
 * white sheet that overlaps it by 20 and holds a stack of white section
 * blocks separated by the grey screen background.
 *
 * REAL DATA: only «Популярные заведения» (catalog + today's availability).
 * Everything else is driven by `src/components/explore/placeholder.ts`, which
 * names the missing endpoint for each block.
 */
export default function ExploreScreen() {
  const router = useRouter();

  const banners = useHeroBanners();
  const chefsPicks = useChefsPicks();
  const gastroguide = useGastroguide();
  const events = useExploreEvents();

  const openSearch = useCallback(() => router.push("/search"), [router]);

  const openRestaurant = useCallback(
    (id: string) => router.push(`/restaurant/${id}`),
    [router],
  );

  /**
   * A time pill goes straight into the existing booking flow.
   *
   * The params below are what the flow needs to open pre-filled, but
   * `app/restaurant/[id]/book/index.tsx` does not read them yet (it starts on
   * today / 2 guests / no slot). That file is owned by another task right now,
   * so the params are sent forward-compatibly instead of being edited in:
   * today the guest lands on the right venue and date and picks the time one
   * tap later. FOLLOW-UP: read `date`/`startsAt`/`guests` in the flow's
   * BookingDraftProvider.
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
            <SectionHeader title={exploreCopy.chefsPicksTitle} />
            <CardStrip
              data={chefsPicks}
              keyExtractor={(dish) => dish.id}
              accessibilityLabel={exploreCopy.chefsPicksTitle}
              renderItem={({ item }) => (
                <DishCard dish={item} onOpenRestaurant={openRestaurant} />
              )}
            />
          </SectionCard>

          <SectionCard>
            <SectionHeader title={exploreCopy.gastroguideTitle} />
            <CardStrip
              data={gastroguide}
              keyExtractor={(dish) => dish.id}
              accessibilityLabel={exploreCopy.gastroguideTitle}
              renderItem={({ item }) => (
                <DishCard dish={item} onOpenRestaurant={openRestaurant} />
              )}
            />
          </SectionCard>

          <SectionCard>
            <SectionHeader title={exploreCopy.eventsTitle} />
            <CardStrip
              data={events}
              keyExtractor={(event) => event.id}
              accessibilityLabel={exploreCopy.eventsTitle}
              renderItem={({ item }) => (
                <EventCard event={item} onOpenRestaurant={openRestaurant} />
              )}
            />
          </SectionCard>
        </View>
      </ScrollView>

      {/* Explore is the active tab. The other four are still inert — the tab
          bar owns no navigation today (see BottomNavBar). */}
      <BottomNavBar active="overview" />
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
