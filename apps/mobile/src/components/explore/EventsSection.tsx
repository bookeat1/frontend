import { colors, exploreLayout, radius, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, View } from "react-native";
import { EmptyState, ErrorState } from "../StateViews";
import { CardStrip } from "./CardStrip";
import { EventCard } from "./EventCard";
import { SectionHeader } from "./SectionCard";
import { useExploreEvents } from "./use-explore-data";

const t = getDictionary();

/**
 * «События» — the cross-venue upcoming events strip, on real data
 * (GET /events).
 *
 * All four states matter here, and the EMPTY one most of all: the endpoint
 * returns only published, not-yet-finished events of active venues, and today
 * that set is genuinely empty on the test backend. So an empty answer is the
 * normal case, and it has to read as "nothing is scheduled yet", never as a
 * section that failed to load. Loading is a skeleton for the same reason as
 * PopularSection: a spinner inside a scrolling page collapses the layout and
 * makes everything below jump when the data lands.
 *
 * There is no «смотреть все» target — no events screen exists yet — so the
 * header renders its chevron as decoration rather than a dead button.
 */
export function EventsSection({
  onOpenRestaurant,
}: {
  onOpenRestaurant: (restaurantId: string) => void;
}) {
  const query = useExploreEvents();
  const events = query.data?.items ?? [];

  return (
    <>
      <SectionHeader title={t.explore.eventsTitle} />

      {query.isLoading ? (
        <SkeletonStrip />
      ) : query.isError ? (
        <View style={styles.state}>
          <ErrorState
            compact
            title={t.explore.eventsErrorTitle}
            description={t.explore.eventsErrorDescription}
            retryLabel={t.common.retry}
            onRetry={() => query.refetch()}
          />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.state}>
          {/* No action button on purpose: there is nowhere to send the guest
              that would produce events, and a button that only reloads an
              empty list turns a calm state into a dead end. */}
          <EmptyState
            compact
            title={t.explore.eventsEmptyTitle}
            description={t.explore.eventsEmptyDescription}
          />
        </View>
      ) : (
        <CardStrip
          data={events}
          keyExtractor={(event) => event.id}
          accessibilityLabel={t.explore.eventsTitle}
          renderItem={({ item }) => (
            <EventCard event={item} onOpenRestaurant={onOpenRestaurant} />
          )}
        />
      )}
    </>
  );
}

/** Two card-shaped grey blocks with the real cards' geometry — photo, title
 * line, date line, and no third line, because the card has no tag row. */
function SkeletonStrip() {
  return (
    <View
      style={styles.skeletonRow}
      accessibilityRole="progressbar"
      accessibilityLabel={t.explore.eventsLoading}
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
