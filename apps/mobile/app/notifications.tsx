import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNavBar } from "../src/components/BottomNavBar";
import { FilterChip } from "../src/components/FilterChip";
import { FlowHeader } from "../src/components/FlowHeader";
import { DataErrorState } from "../src/components/DataErrorState";
import { Bell, BellSimple, CalendarBlank, SealPercent } from "../src/components/icons";
import { NotificationRow } from "../src/components/notifications/NotificationRow";
import { EmptyState, LoadingState } from "../src/components/StateViews";
import {
  matchesFilter,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type NotificationFilter,
} from "../src/hooks/useNotifications";
import { useAuth } from "../src/lib/auth";
import { useLocale } from "../src/lib/locale";

/**
 * «Уведомления» — the guest inbox reached from the home-header bell, bound to
 * the real feed (`GET /notifications`, B5 Part 2).
 *
 * Five states, like «Бронь»: loading / error / empty / list — plus SIGNED OUT,
 * because notifications are guest-scoped, so an anonymous guest is offered
 * sign-in rather than being told they have nothing. The chip filter (Все /
 * Брони / Акции) is applied client-side over the loaded list.
 *
 * Tapping an UNREAD row marks it read (optimistic — the dot clears at once);
 * the header carries a «Прочитать всё» action while anything is unread, and the
 * list pulls to refresh. Reactive i18n: strings come from
 * `useLocale().dictionary`, so switching language re-renders live.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const { dictionary: t } = useLocale();
  const { status } = useAuth();
  const { notifications, unreadCount, isLoading, isError, error, isRefetching, refetch } =
    useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const visible = useMemo(
    () => notifications.filter((item) => matchesFilter(item.type, filter)),
    [notifications, filter],
  );

  const chips: { key: NotificationFilter; label: string }[] = [
    { key: "all", label: t.notifications.filterAll },
    { key: "bookings", label: t.notifications.filterBookings },
    { key: "promos", label: t.notifications.filterPromos },
  ];

  const showMarkAll = status === "signed-in" && unreadCount > 0;

  // Empty copy + icon follow the selected chip (Figma «Состояния»): «Все» —
  // BellSimple, «Брони» — CalendarBlank, «Акции» — SealPercent.
  const emptyByFilter: Record<
    NotificationFilter,
    { icon: typeof BellSimple; title: string; description: string }
  > = {
    all: {
      icon: BellSimple,
      title: t.notifications.emptyTitle,
      description: t.notifications.emptyDescription,
    },
    bookings: {
      icon: CalendarBlank,
      title: t.notifications.emptyBookingsTitle,
      description: t.notifications.emptyBookingsDescription,
    },
    promos: {
      icon: SealPercent,
      title: t.notifications.emptyPromosTitle,
      description: t.notifications.emptyPromosDescription,
    },
  };
  const emptyProps = emptyByFilter[filter];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader
          title={t.notifications.title}
          onBack={() => router.back()}
          trailing={
            showMarkAll ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.notifications.markAllRead}
                onPress={() => markAll.mutate()}
                disabled={markAll.isPending}
                style={styles.markAllButton}
              >
                <Text style={styles.markAllLabel}>{t.notifications.markAllRead}</Text>
              </Pressable>
            ) : undefined
          }
        />
      </SafeAreaView>

      {status === "signed-out" ? (
        <EmptyState
          icon={Bell}
          title={t.notifications.signedOutTitle}
          description={t.notifications.signedOutDescription}
          action={{
            label: t.notifications.signIn,
            onPress: () => router.push("/auth/sign-in"),
            variant: "button",
          }}
        />
      ) : (
        <>
          <View style={styles.chipRow}>
            {chips.map((chip) => (
              <FilterChip
                key={chip.key}
                label={chip.label}
                selected={filter === chip.key}
                selectedTone="brand"
                onPress={() => setFilter(chip.key)}
              />
            ))}
          </View>

          {status === "loading" || isLoading ? (
            <LoadingState title={t.common.loading} />
          ) : isError ? (
            <DataErrorState error={error} onRetry={refetch} />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={emptyProps.icon}
              title={emptyProps.title}
              description={emptyProps.description}
            />
          ) : (
            <ScrollView
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
            >
              {visible.map((item) =>
                item.read ? (
                  <NotificationRow key={item.id} notification={item} />
                ) : (
                  // Only unread rows are tappable: marking an already-read item
                  // would be a wasted request. The optimistic update flips the
                  // row to read, so on the next render it drops back to the
                  // plain (non-pressable) branch — a rapid double tap is
                  // harmless server-side anyway.
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => markRead.mutate(item.id)}
                    style={({ pressed }) => (pressed ? styles.rowPressed : undefined)}
                  >
                    <NotificationRow notification={item} />
                  </Pressable>
                ),
              )}
            </ScrollView>
          )}
        </>
      )}

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
  markAllButton: {
    minHeight: hitSlop.minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  markAllLabel: {
    ...typography.labelMedium,
    color: colors.brand.primary,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.surface,
  },
  listContent: {
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  rowPressed: {
    opacity: 0.6,
  },
});
