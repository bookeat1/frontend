import { colors, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EventListCard } from "../src/components/afisha/EventListCard";
import { BottomNavBar, useNavBarSpacing } from "../src/components/BottomNavBar";
import { FlowHeader } from "../src/components/FlowHeader";
import { useExploreEvents } from "../src/components/explore/use-explore-data";
import { usePullToRefresh } from "../src/hooks/usePullToRefresh";
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
  // Один запрос — один индикатор, но состояние всё равно своё (см.
  // usePullToRefresh): `isRefetching` гаснет и на фоновых перезапросах, к
  // которым гость руки не прикладывал.
  const { refreshing, onRefresh } = usePullToRefresh(() => query.refetch());

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
        //
        // Зато ПОТЯНУТЬ пустой список можно: именно на пустом экране жест и
        // просится («вдруг уже появилось»), а кнопки «обновить» здесь нет
        // нарочно. Отсюда обёртка-лента с `flexGrow: 1` — без неё содержимое
        // короче экрана не тянется вовсе.
        <ScrollView
          contentContainerStyle={styles.stateContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <EmptyState
            title={t.explore.eventsEmptyTitle}
            description={t.explore.eventsEmptyDescription}
          />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: navPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
  stateContent: {
    // Пустое состояние занимает ленту целиком — иначе его нечем тянуть.
    flexGrow: 1,
  },
  listContent: {
    // Отступы контейнера из макета 985:8170: 16 по бокам, 8 сверху, 32 снизу,
    // просвет между карточками 16.
    //
    // Боковой отступ снова живёт ЗДЕСЬ, а не в карточке: в новом макете
    // (3452:13198) карточка — цельный кадр во всю ширину контейнера, у неё
    // больше нет разных отступов для фотографии и для подписи, из-за которых
    // отступ когда-то пришлось унести внутрь.
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
});
