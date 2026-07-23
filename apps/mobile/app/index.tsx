import { EMPTY_FILTERS } from "@bookeat/api";
import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
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
    <ScreenContainer>
      <View style={styles.searchRow}>
        <SearchBar value={text} onChangeText={setText} autoFocus />
      </View>

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
        <>
          <Text style={styles.resultsCount}>
            {t.search.resultsCount(searchQueryResult.data?.total ?? 0)}
          </Text>
          <FlatList
            data={searchQueryResult.data?.items ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <RestaurantCard restaurant={item} onPress={openRestaurant} />
            )}
            ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </ScreenContainer>
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t.search.recent}</Text>
          </View>
          <View style={styles.termsWrap}>
            {recent.map((term) => (
              <Pressable
                key={term}
                onPress={() => onPickTerm(term)}
                style={styles.termChip}
                accessibilityRole="button"
                accessibilityLabel={term}
              >
                <Text style={styles.termText}>{term}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.search.popular}</Text>
        <View style={styles.termsWrap}>
          {popular.map((term) => (
            <Pressable
              key={term}
              onPress={() => onPickTerm(term)}
              style={styles.termChip}
              accessibilityRole="button"
              accessibilityLabel={term}
            >
              <Text style={styles.termText}>{term}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  resultsCount: {
    ...typography.body,
    color: colors.neutral[500],
    paddingBottom: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xxxl,
  },
  idleContainer: {
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  termsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  termChip: {
    minHeight: hitSlop.minTouchTarget,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.neutral[50],
  },
  termText: {
    ...typography.body,
    color: colors.neutral[700],
  },
});
