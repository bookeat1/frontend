import { colors, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArticleListCard } from "../src/components/articles/ArticleListCard";
import { BottomNavBar } from "../src/components/BottomNavBar";
import { FlowHeader } from "../src/components/FlowHeader";
import { useGuideCollections } from "../src/components/explore/use-explore-data";
import { EmptyState, ErrorState, LoadingState } from "../src/components/StateViews";

const t = getDictionary();

/**
 * «Статьи» — the full editorial collections list (GET /gastroguide/collections),
 * reached from the Home «Статьи» section chevron. A vertical stack of full-width
 * cards.
 *
 * Reuses `useGuideCollections` (the SAME query the Home section reads), so
 * getting here is a cache hit and the two can never disagree. Four async states:
 * an empty answer is the normal "nothing published", never an error — a calm
 * empty state with no reload button (there is nowhere to send the guest that
 * would produce collections). Keeps `BottomNavBar` like `/events` (no active tab
 * for `/articles` — `activeNavKey` returns null, which is honest).
 */
export default function ArticlesScreen() {
  const router = useRouter();
  const query = useGuideCollections();
  const collections = query.data ?? [];

  const openArticle = useCallback((slug: string) => router.push(`/articles/${slug}`), [router]);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.articles.title} onBack={() => router.back()} />
      </SafeAreaView>

      {query.isLoading ? (
        <LoadingState title={t.articles.loading} />
      ) : query.isError ? (
        <ErrorState
          title={t.articles.errorTitle}
          description={t.articles.errorDescription}
          action={{ label: t.common.retry, onPress: () => query.refetch(), variant: "button" }}
        />
      ) : collections.length === 0 ? (
        <EmptyState title={t.articles.emptyTitle} description={t.articles.emptyDescription} />
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {collections.map((collection) => (
            <ArticleListCard key={collection.slug} collection={collection} onPress={openArticle} />
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
    backgroundColor: colors.background.screen,
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
