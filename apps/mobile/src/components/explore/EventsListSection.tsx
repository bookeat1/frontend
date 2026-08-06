import { colors, exploreLayout, radius, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, View } from "react-native";
import { EmptyState, ErrorState } from "../StateViews";
import { EventRow } from "./EventRow";
import { SectionCard, SectionHeader } from "./SectionCard";
import { useExploreEvents } from "./use-explore-data";

const t = getDictionary();

/**
 * «Афиша» — cross-venue upcoming events on real data (GET /events), rendered as
 * a VERTICAL list (the old EventsSection was a horizontal strip).
 *
 * All four states matter, and EMPTY most of all: the endpoint returns only
 * published, not-yet-finished events of active venues, and today that set is
 * genuinely empty on the test backend — so an empty answer reads as "nothing is
 * scheduled yet", never as a failed section. Loading is a skeleton, not a
 * spinner, so nothing below jumps when the data lands.
 *
 * The rows are mapped, not put in a nested FlatList: the whole screen is
 * already a ScrollView, and a VirtualizedList inside one both warns and scrolls
 * badly. The list is capped at ~12 events upstream, so mapping is fine.
 *
 * The header chevron now navigates to the dedicated «Афиша» list screen
 * (`onSeeAll` → `/events`), which reads the SAME query — so it is a real
 * control, not decoration.
 */
export function EventsListSection({
  onOpenEvent,
  onSeeAll,
}: {
  onOpenEvent: (eventId: string) => void;
  onSeeAll?: () => void;
}) {
  const query = useExploreEvents();
  const events = query.data?.items ?? [];

  return (
    <SectionCard>
      <SectionHeader title={t.explore.afishaTitle} onSeeAll={onSeeAll} />

      {query.isLoading ? (
        <SkeletonList />
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
              that would produce events, and a button that only reloads an empty
              list turns a calm state into a dead end. */}
          <EmptyState
            compact
            title={t.explore.eventsEmptyTitle}
            description={t.explore.eventsEmptyDescription}
          />
        </View>
      ) : (
        <View style={styles.list}>
          {events.map((event, index) => (
            <React.Fragment key={event.id}>
              {index > 0 ? <View style={styles.separator} /> : null}
              <EventRow event={event} onOpenEvent={onOpenEvent} />
            </React.Fragment>
          ))}
        </View>
      )}
    </SectionCard>
  );
}

/** Three row-shaped skeletons with the real rows' geometry. */
function SkeletonList() {
  return (
    <View
      style={styles.list}
      accessibilityRole="progressbar"
      accessibilityLabel={t.explore.eventsLoading}
    >
      {[0, 1, 2].map((key) => (
        <View key={key} style={styles.skeletonRow}>
          <View style={styles.skeletonDate} />
          <View style={styles.skeletonText}>
            <View style={styles.skeletonLineWide} />
            <View style={styles.skeletonLineNarrow} />
          </View>
          <View style={styles.skeletonThumb} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    paddingHorizontal: spacing.lg,
  },
  list: {
    gap: spacing.lg,
  },
  separator: {
    height: 1,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.border.subtle,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  skeletonDate: {
    width: 40,
    height: 40,
    borderRadius: radius.media,
    backgroundColor: colors.background.chip,
  },
  skeletonText: {
    flex: 1,
    gap: spacing.sm,
  },
  skeletonLineWide: {
    height: 16,
    width: "80%",
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
  skeletonLineNarrow: {
    height: 12,
    width: "50%",
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
  skeletonThumb: {
    width: exploreLayout.eventThumb,
    height: exploreLayout.eventThumb,
    borderRadius: radius.media,
    backgroundColor: colors.background.chip,
  },
});
