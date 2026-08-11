import type { RestaurantSummary } from "@bookeat/api";
import { colors, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNavBar, useNavBarSpacing } from "../src/components/BottomNavBar";
import { DataErrorState } from "../src/components/DataErrorState";
import { FlowHeader } from "../src/components/FlowHeader";
import { Heart } from "../src/components/icons";
import { RestaurantCard } from "../src/components/RestaurantCard";
import { EmptyState, LoadingState } from "../src/components/StateViews";
import { useFavorites } from "../src/hooks/useFavorites";
import { useAuth } from "../src/lib/auth";

const t = getDictionary();

/**
 * «Избранные» — the venues the guest saved (`GET /favorites`).
 *
 * The endpoint answers the same restaurant objects the catalog does, so the
 * rows are the ordinary search `RestaurantCard` — a second, slightly different
 * venue card would be a defect.
 *
 * Not paginated: the endpoint returns the whole set in one array and there is
 * no page parameter to send. A guest's favorites list is small by nature; if
 * that ever stops being true it needs a server-side page, not a client-side
 * slice that hides rows.
 */
export default function FavoritesScreen() {
  const navPad = useNavBarSpacing();
  const router = useRouter();
  const { status } = useAuth();
  const query = useFavorites();

  const openRestaurant = useCallback(
    (id: string) => router.push(`/restaurant/${id}`),
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: RestaurantSummary }) => (
      <RestaurantCard restaurant={item} onPress={openRestaurant} />
    ),
    [openRestaurant],
  );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.favorites.title} />
      </SafeAreaView>

      <View style={styles.body}>
        {status === "loading" ? (
          <LoadingState title={t.favorites.loadingTitle} />
        ) : status === "signed-out" ? (
          <EmptyState
            icon={Heart}
            title={t.favorites.signedOutTitle}
            description={t.favorites.signedOutDescription}
            action={{
              label: t.favorites.signIn,
              onPress: () => router.push("/auth/sign-in"),
              variant: "button",
            }}
          />
        ) : query.isPending ? (
          <LoadingState title={t.favorites.loadingTitle} />
        ) : query.isError ? (
          <DataErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.length === 0 ? (
          // Figma «Состояния»: пустое избранное без действия — только иконка,
          // заголовок и описание.
          <EmptyState
            icon={Heart}
            title={t.favorites.emptyTitle}
            description={t.favorites.emptyDescription}
          />
        ) : (
          <FlatList
            data={query.data}
            keyExtractor={(restaurant) => restaurant.id}
            renderItem={renderItem}
            // Same gutter and rhythm as the search results — this is the same
            // card in the same kind of list.
            ItemSeparatorComponent={Separator}
            contentContainerStyle={[styles.list, { paddingBottom: navPad }]}
            showsVerticalScrollIndicator={false}
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
          />
        )}
      </View>

      <BottomNavBar />
    </View>
  );
}

/** Vertical rhythm between venue cards. */
function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  body: {
    flex: 1,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  separator: {
    height: spacing.xxl,
  },
});
