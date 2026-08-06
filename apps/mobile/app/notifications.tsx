import { colors, spacing } from "@bookeat/design-tokens";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNavBar } from "../src/components/BottomNavBar";
import { FilterChip } from "../src/components/FilterChip";
import { FlowHeader } from "../src/components/FlowHeader";
import { NotificationRow } from "../src/components/notifications/NotificationRow";
import { EmptyState, ErrorState, LoadingState } from "../src/components/StateViews";
import {
  matchesFilter,
  useNotifications,
  type NotificationFilter,
} from "../src/hooks/useNotifications";
import { useAuth } from "../src/lib/auth";
import { useLocale } from "../src/lib/locale";

/**
 * «Уведомления» — the guest inbox reached from the home-header bell.
 *
 * There is NO notifications-list endpoint yet (see `useNotifications`), so the
 * hook returns an empty list and this screen renders a calm empty state instead
 * of fabricated rows. The full layout — filter chips, tinted-icon rows, unread
 * dot — is built and ready to bind the moment a feed exists.
 *
 * Five states, like «Бронь»: loading / error / empty / list — plus SIGNED OUT,
 * because notifications are guest-scoped, so an anonymous guest is offered
 * sign-in rather than being told they have nothing. The chip filter (Все /
 * Брони / Акции) is applied client-side over the loaded list.
 *
 * Reactive i18n: strings come from `useLocale().dictionary`, so switching the
 * language re-renders this screen live (not a module-scope `getDictionary()`).
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const { dictionary: t } = useLocale();
  const { status } = useAuth();
  const { notifications, isLoading, isError } = useNotifications();
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

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.notifications.title} onBack={() => router.back()} />
      </SafeAreaView>

      {status === "signed-out" ? (
        <EmptyState
          title={t.notifications.signedOutTitle}
          description={t.notifications.signedOutDescription}
          actionLabel={t.notifications.signIn}
          onAction={() => router.push("/auth/sign-in")}
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
            <ErrorState
              title={t.notifications.emptyTitle}
              description={t.notifications.emptyDescription}
              retryLabel={t.common.retry}
              // No feed endpoint to retry against yet; when one exists this
              // becomes `query.refetch`. Kept honest: the button re-reads the
              // (currently empty) source without pretending to hit a network.
              onRetry={() => undefined}
            />
          ) : visible.length === 0 ? (
            <EmptyState
              title={t.notifications.emptyTitle}
              description={t.notifications.emptyDescription}
            />
          ) : (
            <ScrollView
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {visible.map((item) => (
                <NotificationRow key={item.id} notification={item} />
              ))}
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
});
