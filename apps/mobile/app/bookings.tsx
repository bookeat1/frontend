import type { Booking, BookingStatus } from "@bookeat/api";
import { colors, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNavBar, useNavBarSpacing } from "../src/components/BottomNavBar";
import { BookingListCard } from "../src/components/booking/BookingListCard";
import { DataErrorState } from "../src/components/DataErrorState";
import { FlowHeader } from "../src/components/FlowHeader";
import { CalendarBlank, Clock } from "../src/components/icons";
import { SegmentedTabs } from "../src/components/SegmentedTabs";
import { EmptyState, LoadingState } from "../src/components/StateViews";
import { useMyBookings } from "../src/hooks/useBooking";
import { useAuth } from "../src/lib/auth";

const t = getDictionary();

/** Statuses that put a booking in История regardless of its time: the visit is
 * finished or was called off. Everything else (`pending`/`confirmed`/`waitlist`/
 * `arrived`) is judged by the clock instead. */
const TERMINAL_STATUSES: readonly BookingStatus[] = ["completed", "cancelled", "no_show"];

/**
 * A booking belongs to История when it is in a terminal status OR it has
 * already ended. `endsAt` (not `startsAt`) is the boundary on purpose: a visit
 * that started an hour ago but runs until tonight is still «активная», not
 * history. Everything not past is «Активные».
 */
function isPastBooking(booking: Booking, now: number): boolean {
  if (TERMINAL_STATUSES.includes(booking.status)) return true;
  const endsAt = new Date(booking.endsAt).getTime();
  // Unparseable timestamp → fold into История, never leave a broken booking
  // stuck in Активные forever.
  if (Number.isNaN(endsAt)) return true;
  return endsAt < now;
}

const TAB_ACTIVE = 0;
const TAB_HISTORY = 1;

/**
 * «Бронь» — the guest's own reservations (`GET /bookings`), server order
 * `starts_at DESC`, so the next visit is at the top and the history runs down.
 *
 * Two tabs, split CLIENT-SIDE from the single paginated list (there is no
 * separate history endpoint): «Активные» = upcoming/ongoing & non-terminal,
 * «История» = ended or cancelled/completed/no-show. Because the server order is
 * `starts_at DESC`, the active tail sits on the first pages and history
 * accumulates as the guest scrolls (`onEndReached` keeps paging the one list).
 *
 * Five whole-screen states, not four: loading / error / empty / list — plus
 * SIGNED OUT, which is neither an error nor an empty list. The endpoint is
 * session-scoped, so an anonymous guest is offered the sign-in screen rather
 * than being told they have no bookings.
 *
 * The list is paginated (20 per page) and pulls the next page only when the
 * guest reaches the end of the current one — a guest with three years of
 * history never downloads all of it.
 */
export default function MyBookingsScreen() {
  const navPad = useNavBarSpacing();
  const router = useRouter();
  const { status } = useAuth();
  const query = useMyBookings();
  const [activeTab, setActiveTab] = useState<number>(TAB_ACTIVE);

  const openBooking = useCallback(
    (bookingId: string) => router.push({ pathname: "/booking/[id]", params: { id: bookingId } }),
    [router],
  );

  const bookings = useMemo<Booking[]>(
    () => (query.data?.pages ?? []).flatMap((page) => page.items),
    [query.data],
  );

  const { active, history } = useMemo(() => {
    const now = Date.now();
    const activeBucket: Booking[] = [];
    const historyBucket: Booking[] = [];
    for (const booking of bookings) {
      (isPastBooking(booking, now) ? historyBucket : activeBucket).push(booking);
    }
    return { active: activeBucket, history: historyBucket };
  }, [bookings]);

  const renderItem = useCallback(
    ({ item }: { item: Booking }) => <BookingListCard booking={item} onPress={openBooking} />,
    [openBooking],
  );

  const visibleBookings = activeTab === TAB_HISTORY ? history : active;
  const isEmpty = visibleBookings.length === 0;

  // Deterministic pagination for the selected tab, independent of the FlatList
  // firing onEndReached on a short/empty list. When the selected tab's loaded
  // bucket is empty but the server still has pages (`starts_at DESC` can front-
  // load the whole first page with the OTHER tab's bookings), keep paging until
  // this bucket has an item or the pages run out. It cannot loop: `hasNextPage`
  // goes false once the last page is in, which both drops it from the deps and
  // fails the guard, so an all-other-tab result stops instead of spinning.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (isEmpty && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [activeTab, isEmpty, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // The empty state is passed as `ListEmptyComponent`, NOT returned early: the
  // FlatList must always mount so `onEndReached`/`fetchNextPage` stay wired even
  // when the SELECTED tab's currently-loaded bucket is empty. Server order is
  // `starts_at DESC`, so a guest with 25+ upcoming bookings opens «История» to
  // an all-Active first page (history bucket [] while hasNextPage is true); the
  // filling empty component gives a scroll surface so more pages load and
  // История fills instead of showing "Здесь пока пусто" permanently.
  const listEmptyComponent =
    activeTab === TAB_HISTORY ? (
      <EmptyState
        icon={Clock}
        title={t.myBookings.emptyHistoryTitle}
        description={t.myBookings.emptyHistoryDescription}
      />
    ) : (
      <EmptyState
        icon={CalendarBlank}
        title={t.myBookings.emptyTitle}
        description={t.myBookings.emptyDescription}
        action={{
          label: t.myBookings.emptyAction,
          onPress: () => router.replace("/search"),
          variant: "button",
        }}
      />
    );

  const renderList = () => (
    <FlatList
      data={visibleBookings}
      keyExtractor={(booking) => booking.id}
      renderItem={renderItem}
      // flexGrow lets an empty bucket's state fill the viewport, so its content
      // sits at the scroll end and onEndReached can fire to page in more.
      contentContainerStyle={[styles.list, isEmpty && styles.listEmpty, { paddingBottom: navPad }]}
      showsVerticalScrollIndicator={false}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => void query.refetch()}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      }}
      ListEmptyComponent={listEmptyComponent}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator
            style={styles.footer}
            color={colors.brand.primary}
            accessibilityLabel={t.myBookings.loadingMore}
          />
        ) : null
      }
    />
  );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.myBookings.title} />
      </SafeAreaView>

      <View style={styles.body}>
        {status === "loading" ? (
          <LoadingState title={t.myBookings.loadingTitle} />
        ) : status === "signed-out" ? (
          <EmptyState
            icon={CalendarBlank}
            title={t.myBookings.signedOutTitle}
            description={t.myBookings.signedOutDescription}
            action={{
              label: t.myBookings.signIn,
              onPress: () => router.push("/auth/sign-in"),
              variant: "button",
            }}
          />
        ) : query.isPending ? (
          <LoadingState title={t.myBookings.loadingTitle} />
        ) : query.isError ? (
          <DataErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <View style={styles.tabs}>
              <SegmentedTabs
                labels={[t.myBookings.tabActive, t.myBookings.tabHistory]}
                activeIndex={activeTab}
                onChange={setActiveTab}
              />
            </View>
            {renderList()}
          </>
        )}
      </View>

      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Белый лист: пустое состояние на сером выглядело как ошибка загрузки,
    // хотя «броней ещё нет» — это нормальное начало пути, а не сбой.
    backgroundColor: colors.background.surface,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  body: {
    flex: 1,
  },
  tabs: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background.surface,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  listEmpty: {
    flexGrow: 1,
  },
  footer: {
    paddingVertical: spacing.lg,
  },
});
