import type { Booking } from "@bookeat/api";
import { colors, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNavBar } from "../src/components/BottomNavBar";
import { BookingListCard } from "../src/components/booking/BookingListCard";
import { DataErrorState } from "../src/components/DataErrorState";
import { FlowHeader } from "../src/components/FlowHeader";
import { CalendarBlank } from "../src/components/icons";
import { EmptyState, LoadingState } from "../src/components/StateViews";
import { useMyBookings } from "../src/hooks/useBooking";
import { useAuth } from "../src/lib/auth";

const t = getDictionary();

/**
 * «Бронь» — the guest's own reservations (`GET /bookings`), server order
 * `starts_at DESC`, so the next visit is at the top and the history runs down.
 *
 * Five states, not four: loading / error / empty / list — plus SIGNED OUT,
 * which is neither an error nor an empty list. The endpoint is
 * session-scoped, so an anonymous guest is offered the sign-in screen rather
 * than being told they have no bookings.
 *
 * The list is paginated (20 per page) and pulls the next page only when the
 * guest reaches the end of the current one — a guest with three years of
 * history never downloads all of it.
 */
export default function MyBookingsScreen() {
  const router = useRouter();
  const { status } = useAuth();
  const query = useMyBookings();

  const openBooking = useCallback(
    (bookingId: string) => router.push({ pathname: "/booking/[id]", params: { id: bookingId } }),
    [router],
  );

  const bookings = useMemo<Booking[]>(
    () => (query.data?.pages ?? []).flatMap((page) => page.items),
    [query.data],
  );

  const renderItem = useCallback(
    ({ item }: { item: Booking }) => <BookingListCard booking={item} onPress={openBooking} />,
    [openBooking],
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
        ) : bookings.length === 0 ? (
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
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={(booking) => booking.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => void query.refetch()}
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (query.hasNextPage && !query.isFetchingNextPage) {
                void query.fetchNextPage();
              }
            }}
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
        )}
      </View>

      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.screen,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  body: {
    flex: 1,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  footer: {
    paddingVertical: spacing.lg,
  },
});
