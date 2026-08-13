import { colors, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNavBar, useNavBarSpacing } from "../src/components/BottomNavBar";
import { useExplorePromotionsQuery } from "../src/components/explore/use-explore-data";
import { FlowHeader } from "../src/components/FlowHeader";
import { PromotionListCard } from "../src/components/promotions/PromotionListCard";
import { EmptyState, ErrorState, LoadingState } from "../src/components/StateViews";
import { trackEvent } from "../src/lib/analytics";

const t = getDictionary();

/**
 * «Акции» — the full promotions list, reached from the Home «Акции» chevron.
 * Built exactly like «Афиша» (app/events.tsx): a vertical stack of full-width
 * cards with the same four async states.
 *
 * Reuses the SAME query the Home strip reads (the city feed), so arriving here
 * is a cache hit and the two views can never disagree. An empty answer is the
 * normal "no promos in this city", never an error, so it gets a calm empty
 * state with no reload button that would only re-fetch the same empty feed.
 */
export default function PromotionsScreen() {
  const navPad = useNavBarSpacing();
  const router = useRouter();
  const query = useExplorePromotionsQuery();
  const promotions = query.data ?? [];

  const openPromotion = useCallback(
    (id: string) => {
      trackEvent("promotion_tap", { id });
      router.push(`/promotion/${id}`);
    },
    [router],
  );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.promotions.title} onBack={() => router.back()} />
      </SafeAreaView>

      {query.isLoading ? (
        <LoadingState title={t.promotions.loading} />
      ) : query.isError ? (
        <ErrorState
          title={t.promotions.errorTitle}
          description={t.promotions.errorDescription}
          action={{ label: t.common.retry, onPress: () => query.refetch(), variant: "button" }}
        />
      ) : promotions.length === 0 ? (
        <EmptyState
          title={t.promotions.emptyTitle}
          description={t.promotions.emptyDescription}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: navPad }]}
          showsVerticalScrollIndicator={false}
        >
          {promotions.map((promo) => (
            <PromotionListCard key={promo.id} promo={promo} onPress={openPromotion} />
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
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
});
