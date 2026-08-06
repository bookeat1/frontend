import { colors, exploreLayout, radius, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, View } from "react-native";
import { EmptyState, ErrorState } from "../StateViews";
import { CardStrip } from "./CardStrip";
import { RecommendedRestaurantCard } from "./RecommendedRestaurantCard";
import { SectionCard, SectionHeader } from "./SectionCard";
import { useRecommendedRestaurants } from "./use-explore-data";

const t = getDictionary();

/**
 * «Выбрали для вас» — the one home section on real data, so it carries all four
 * states. Loading is a skeleton rather than a spinner because the section sits
 * inside a scrolling page: a spinner would collapse the layout and make
 * everything below jump when the data lands. Reuses the same popular-restaurant
 * query and copy the old PopularSection used.
 */
export function RecommendedSection({
  onSeeAll,
  onOpenRestaurant,
}: {
  onSeeAll: () => void;
  onOpenRestaurant: (id: string) => void;
}) {
  const query = useRecommendedRestaurants();

  return (
    <SectionCard>
      <SectionHeader title={t.explore.recommendedTitle} onSeeAll={onSeeAll} />

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
          accessibilityLabel={t.explore.recommendedTitle}
          renderItem={({ item }) => (
            <RecommendedRestaurantCard restaurant={item} onOpenRestaurant={onOpenRestaurant} />
          )}
        />
      )}
    </SectionCard>
  );
}

/** Two card-shaped grey blocks, same geometry as the real cards. */
function SkeletonStrip() {
  return (
    <View
      style={styles.skeletonRow}
      accessibilityRole="progressbar"
      accessibilityLabel={t.explore.popularLoading}
    >
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
