import type { RestaurantSummary } from "@bookeat/api";
import { oceanPageLayout, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import type { UseQueryResult } from "@tanstack/react-query";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { EmptyState, ErrorState, LoadingState } from "../StateViews";
import { OceanPointCard } from "./OceanPointCard";
import { OceanSectionHeader } from "./OceanSectionHeader";

const t = getDictionary();

/**
 * «ВСЕ ТОЧКИ» — макет 3z0f6dgev4HMwBAHPjTjPo, узлы 3427:12237…3441:12335:
 * заголовок со счётчиком и горизонтальная лента карточек 292 с просветом 14.
 *
 * ЕДИНСТВЕННЫЙ БЛОК СТРАНИЦЫ, У КОТОРОГО ЕСТЬ СОСТОЯНИЯ, потому что он
 * единственный ходит в сеть. Их четыре, и все четыре нарисованы: загрузка,
 * отказ с повтором, пусто и сама лента. Остальная страница при отказе сети
 * остаётся на месте — она зашита в сборку, и прятать историю бренда из-за
 * того, что не ответил каталог, незачем.
 */
export function OceanPointsSection({
  query,
  contentPadding,
  onOpenVenue,
}: {
  query: UseQueryResult<RestaurantSummary[]>;
  /** Поля листа: лента выходит за них и возвращает их себе отступом. */
  contentPadding: number;
  onOpenVenue: (restaurantId: string) => void;
}) {
  const venues = query.data ?? [];

  return (
    <View style={styles.section}>
      <OceanSectionHeader
        title={t.oceanBasket.pointsTitle}
        // Счётчик считается по ФАКТИЧЕСКИ пришедшим точкам, а не по числу из
        // макета: их три на тесте сегодня и может стать четыре завтра.
        note={venues.length > 0 ? t.articles.venueCount(venues.length) : undefined}
      />

      {query.isLoading ? (
        <LoadingState title={t.oceanBasket.pointsLoading} compact />
      ) : query.isError ? (
        <ErrorState
          title={t.oceanBasket.pointsErrorTitle}
          description={t.oceanBasket.pointsErrorDescription}
          action={{ label: t.common.retry, onPress: () => void query.refetch(), variant: "button" }}
          compact
        />
      ) : venues.length === 0 ? (
        <EmptyState
          title={t.oceanBasket.pointsEmptyTitle}
          description={t.oceanBasket.pointsEmptyDescription}
          compact
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -contentPadding }}
          contentContainerStyle={[styles.rail, { paddingHorizontal: contentPadding }]}
        >
          {venues.map((venue, index) => (
            <OceanPointCard
              key={venue.id}
              venue={venue}
              index={index}
              onPress={onOpenVenue}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  rail: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: oceanPageLayout.venueCardGap,
  },
});
