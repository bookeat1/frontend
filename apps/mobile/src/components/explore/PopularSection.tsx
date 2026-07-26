import type { AvailabilitySlot, RestaurantSummary } from "@bookeat/api";
import { colors, exploreLayout, radius, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, View } from "react-native";
import { EmptyState, ErrorState } from "../StateViews";
import { CardStrip } from "./CardStrip";
import { PopularRestaurantCard } from "./PopularRestaurantCard";
import { SectionHeader } from "./SectionCard";
import { usePopularRestaurants } from "./use-explore-data";

const t = getDictionary();

/**
 * "Популярные заведения" — the one section of Explore on real data, so it is
 * the one that needs all four states. Loading is a skeleton rather than a
 * spinner because the section sits inside a scrolling page: a spinner would
 * collapse the layout and make everything below jump when the data lands.
 */
export function PopularSection({
  onSeeAll,
  onOpenRestaurant,
  onPickSlot,
}: {
  onSeeAll: () => void;
  onOpenRestaurant: (id: string) => void;
  onPickSlot: (restaurant: RestaurantSummary, slot: AvailabilitySlot) => void;
}) {
  const query = usePopularRestaurants();

  return (
    <>
      <SectionHeader title={t.explore.popularTitle} onSeeAll={onSeeAll} />

      {query.isLoading ? (
        <SkeletonStrip />
      ) : query.isError ? (
        <View style={styles.state}>
          <ErrorState
            compact
            title={t.explore.popularErrorTitle}
            description={t.explore.popularErrorDescription}
            retryLabel={t.common.retry}
            onRetry={() => query.refetch()}
          />
        </View>
      ) : (query.data?.length ?? 0) === 0 ? (
        <View style={styles.state}>
          <EmptyState
            compact
            title={t.explore.popularEmptyTitle}
            description={t.explore.popularEmptyDescription}
            actionLabel={t.explore.popularEmptyAction}
            onAction={onSeeAll}
          />
        </View>
      ) : (
        <CardStrip
          data={query.data ?? []}
          keyExtractor={(restaurant) => restaurant.id}
          accessibilityLabel={t.explore.popularTitle}
          renderItem={({ item }) => (
            <PopularRestaurantCard
              restaurant={item}
              onOpenRestaurant={onOpenRestaurant}
              onPickSlot={onPickSlot}
            />
          )}
        />
      )}
    </>
  );
}

/** Two card-shaped grey blocks, same geometry as the real cards. */
function SkeletonStrip() {
  return (
    <View style={styles.skeletonRow} accessibilityRole="progressbar" accessibilityLabel={t.explore.popularLoading}>
      {[0, 1].map((key) => (
        <View key={key} style={styles.skeletonCard}>
          <View style={styles.skeletonPhoto} />
          <View style={styles.skeletonLineWide} />
          <View style={styles.skeletonLineNarrow} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    paddingHorizontal: spacing.lg,
  },
  skeletonRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    // Clipped rather than scrollable: a skeleton the user can swipe is a lie
    // about how much content there is.
    overflow: "hidden",
  },
  skeletonCard: {
    width: exploreLayout.cardWidth,
    gap: spacing.sm,
  },
  skeletonPhoto: {
    width: exploreLayout.cardWidth,
    height: exploreLayout.cardPhotoHeight,
    borderRadius: radius.media,
    backgroundColor: colors.background.chip,
  },
  skeletonLineWide: {
    height: 16,
    width: "70%",
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
  skeletonLineNarrow: {
    height: 12,
    width: "45%",
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
});
