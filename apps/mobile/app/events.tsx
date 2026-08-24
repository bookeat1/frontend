import { colors, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EventListCard } from "../src/components/afisha/EventListCard";
import { BottomNavBar, useNavBarSpacing } from "../src/components/BottomNavBar";
import { FlowHeader } from "../src/components/FlowHeader";
import { useExploreEvents } from "../src/components/explore/use-explore-data";
import { EmptyState, ErrorState, LoadingState } from "../src/components/StateViews";
import { trackEvent } from "../src/lib/analytics";

const t = getDictionary();

/**
 * «Афиша» — the full events list screen (GET /events), reached from the Home
 * «Афиша» section chevron. A vertical stack of full-width cards.
 *
 * Reuses `useExploreEvents` (the SAME query the Home section reads), so getting
 * here is a cache hit and the two can never disagree. All four async states are
 * the Home section's: an empty answer is the normal "nothing scheduled", never
 * an error — so it gets a calm empty state without a reload button that would
 * only re-fetch the same empty page.
 */
export default function EventsScreen() {
  const navPad = useNavBarSpacing();
  const router = useRouter();
  const query = useExploreEvents();
  const events = query.data?.items ?? [];

  const openEvent = useCallback(
    (id: string) => {
      trackEvent("event_tap", { id });
      router.push(`/event/${id}`);
    },
    [router],
  );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.afisha.title} onBack={() => router.back()} />
      </SafeAreaView>

      {query.isLoading ? (
        <LoadingState title={t.explore.eventsLoading} />
      ) : query.isError ? (
        <ErrorState
          title={t.explore.eventsErrorTitle}
          description={t.explore.eventsErrorDescription}
          action={{ label: t.common.retry, onPress: () => query.refetch(), variant: "button" }}
        />
      ) : events.length === 0 ? (
        // No action button: there is nowhere to send the guest that would
        // produce events, and a button that only reloads an empty list turns a
        // calm state into a dead end (same call the Home section makes).
        <EmptyState
          title={t.explore.eventsEmptyTitle}
          description={t.explore.eventsEmptyDescription}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: navPad }]}
          showsVerticalScrollIndicator={false}
        >
          {events.map((event) => (
            <EventListCard key={event.id} event={event} onPress={openEvent} />
          ))}
        </ScrollView>
      )}

      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  listContent: {
    // БЕЗ бокового отступа намеренно: `EventListCard` держит его сама и
    // по-разному для фотографии (`spacing.sm`, 8) и для подписи
    // (`spacing.lg`, 16). Общие 16 здесь складывались с внутренними и
    // отжимали фотографию от края дальше макетных 8 — ровно та же ошибка,
    // что чинили на экране поиска (правка владельца 2026-08-24).
    paddingTop: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
});
