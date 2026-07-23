import { EMPTY_FILTERS } from "@bookeat/api";
import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { BottomNavBar } from "../src/components/BottomNavBar";
import { EmptyState, ErrorState, LoadingState } from "../src/components/StateViews";
import { FilterChip } from "../src/components/FilterChip";
import { RestaurantCard } from "../src/components/RestaurantCard";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { SearchBar } from "../src/components/SearchBar";
import { useSearchScreen } from "../src/hooks/useSearch";

const t = getDictionary();

export default function SearchScreen() {
  const router = useRouter();
  const {
    text,
    setText,
    filters,
    setFilters,
    hasActiveSearch,
    isTyping,
    searchQueryResult,
    recentQuery,
    popularQuery,
    cuisinesQuery,
  } = useSearchScreen();

  const openRestaurant = useCallback(
    (id: string) => router.push(`/restaurant/${id}`),
    [router],
  );

  const toggleOpenNow = () =>
    setFilters((prev) => ({ ...prev, openNowOnly: !prev.openNowOnly }));

  const toggleCuisine = (cuisineId: string) =>
    setFilters((prev) => ({
      ...prev,
      cuisineIds: prev.cuisineIds.includes(cuisineId)
        ? prev.cuisineIds.filter((id) => id !== cuisineId)
        : [...prev.cuisineIds, cuisineId],
    }));

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setText("");
  };

  return (
    <View style={styles.root}>
      <ScreenContainer padded={false}>
        <View style={styles.searchRow}>
          <SearchBar value={text} onChangeText={setText} autoFocus />

          <View style={styles.chipsRow}>
            <FilterChip
              label={t.search.filterOpenNow}
              selected={filters.openNowOnly}
              onPress={toggleOpenNow}
            />
            {(cuisinesQuery.data ?? []).map((cuisine) => (
              <FilterChip
                key={cuisine.id}
                label={cuisine.name}
                selected={filters.cuisineIds.includes(cuisine.id)}
                onPress={() => toggleCuisine(cuisine.id)}
              />
            ))}
          </View>
        </View>

        {!hasActiveSearch ? (
          <IdleContent
            recent={recentQuery.data ?? []}
            popular={popularQuery.data ?? []}
            isLoading={recentQuery.isLoading || popularQuery.isLoading}
            onPickTerm={setText}
          />
        ) : isTyping || searchQueryResult.isLoading ? (
          <LoadingState title={t.search.loadingTitle} />
        ) : searchQueryResult.isError ? (
          <ErrorState
            title={t.search.errorTitle}
            description={t.search.errorDescription}
            retryLabel={t.common.retry}
            onRetry={() => searchQueryResult.refetch()}
          />
        ) : (searchQueryResult.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title={t.search.emptyTitle}
            description={t.search.emptyDescription}
            actionLabel={t.search.emptyResetFilters}
            onAction={resetFilters}
          />
        ) : (
          <FlatList
            data={searchQueryResult.data?.items ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <RestaurantCard restaurant={item} onPress={openRestaurant} />
            )}
            ItemSeparatorComponent={() => <View style={{ height: spacing.xxl }} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </ScreenContainer>

      <BottomNavBar active="search" />
    </View>
  );
}

function IdleContent({
  recent,
  popular,
  isLoading,
  onPickTerm,
}: {
  recent: string[];
  popular: string[];
  isLoading: boolean;
  onPickTerm: (term: string) => void;
}) {
  if (isLoading) {
    return <LoadingState title={t.common.loading} />;
  }

  return (
    <View style={styles.idleContainer}>
      {recent.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.search.recent}</Text>
          <View style={styles.termsList}>
            {recent.map((term) => (
              <TermRow key={term} term={term} onPress={() => onPickTerm(term)} />
            ))}
          </View>
        </View>
      ) : null}

      {popular.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.search.popular}</Text>
          <View style={styles.termsList}>
            {popular.map((term) => (
              <TermRow key={term} term={term} onPress={() => onPickTerm(term)} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function TermRow({ term, onPress }: { term: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.termRow}
      accessibilityRole="button"
      accessibilityLabel={term}
    >
      <Text style={styles.termText}>{term}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  searchRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  idleContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  termsList: {
    gap: spacing.xs,
  },
  termRow: {
    minHeight: hitSlop.minTouchTarget,
    justifyContent: "center",
  },
  termText: {
    ...typography.body,
    color: colors.text.primary,
  },
});
