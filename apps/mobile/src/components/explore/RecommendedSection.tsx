import { colors, exploreLayout, radius, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { trackEvent } from "../../lib/analytics";
import { DataErrorState } from "../DataErrorState";
import { ForkKnife } from "../icons";
import { EmptyState } from "../StateViews";
import { CardStrip } from "./CardStrip";
import { RecommendedRestaurantCard } from "./RecommendedRestaurantCard";
import { SectionCard, SectionHeader } from "./SectionCard";
import { useRecommendedRestaurants } from "./use-explore-data";

const t = getDictionary();

/**
 * «Выбрали для вас» — the one home section on real data, so it carries all four
 * states. Loading is a skeleton rather than a spinner because the section sits
 * inside a scrolling page: a spinner would collapse the layout and make
 * everything below jump when the data lands. Reuses the same popular-restaurant
 * query and copy the old PopularSection used.
 */
export function RecommendedSection({
  onSeeAll,
  onOpenRestaurant,
}: {
  onSeeAll: () => void;
  /** Второй параметр — метка «откуда» для `restaurant_open`
   * (персонализация v1, критерий 23): `"for_you"` в персональном режиме,
   * `"picks"` в любом фолбэке (ручной список/популярное). */
  onOpenRestaurant: (id: string, source: "for_you" | "picks") => void;
}) {
  const query = useRecommendedRestaurants();
  const items = query.data?.items ?? [];
  const mode = query.data?.mode;
  // Заголовок ряда переключается ПОЛЕМ ОТВЕТА, не локальным знанием, пуст ли
  // профиль гостя (критерий 20 явно требует именно так: сервер может отдать
  // фолбэк даже заполненному профилю — 5.4, «ни одно заведение не набрало
  // очков»). До первого ответа (`mode === undefined`) — прежний заголовок:
  // экран не должен мигать «Для вас» на пустом состоянии загрузки.
  const title = mode === "for_you" ? t.explore.forYouTitle : t.explore.recommendedTitle;
  const openRestaurantSource: "for_you" | "picks" = mode === "for_you" ? "for_you" : "picks";

  // `for_you_shown` — один раз за монтирование, когда ряд реально появился
  // на экране (критерий 23, 🟡6.9): без него CTR «Для вас» против «Выбрали
  // для вас» не с чем сравнить. Считаем «появился» как «запрос ответил
  // успешно», независимо от режима — базовая линия нужна для ВСЕХ трёх
  // режимов, не только персонального.
  const shownFired = useRef(false);
  useEffect(() => {
    if (shownFired.current) return;
    if (!query.isSuccess || !query.data) return;
    shownFired.current = true;
    const matchedCount = query.data.items.filter((r) => (r.match?.score ?? 0) > 0).length;
    trackEvent("for_you_shown", {
      mode: query.data.mode,
      items_count: query.data.items.length,
      matched_count: matchedCount,
    });
  }, [query.isSuccess, query.data]);

  return (
    <SectionCard>
      <SectionHeader title={title} onSeeAll={onSeeAll} />

      {query.isLoading ? (
        <SkeletonStrip />
      ) : query.isError ? (
        <View style={styles.state}>
          <DataErrorState compact error={query.error} onRetry={() => void query.refetch()} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.state}>
          <EmptyState
            compact
            icon={ForkKnife}
            title={t.explore.popularEmptyTitle}
            description={t.explore.popularEmptyDescription}
            action={{ label: t.explore.popularEmptyAction, onPress: onSeeAll, variant: "link" }}
          />
        </View>
      ) : (
        <CardStrip
          data={items}
          keyExtractor={(restaurant) => restaurant.id}
          accessibilityLabel={title}
          renderItem={({ item }) => (
            <RecommendedRestaurantCard
              restaurant={item}
              onOpenRestaurant={(id) => onOpenRestaurant(id, openRestaurantSource)}
            />
          )}
        />
      )}
    </SectionCard>
  );
}

/** Two card-shaped grey blocks, same geometry as the real cards. */
function SkeletonStrip() {
  return (
    <View
      style={styles.skeletonRow}
      accessibilityRole="progressbar"
      accessibilityLabel={t.explore.popularLoading}
    >
      {[0, 1].map((key) => (
        <View key={key} style={styles.skeletonCard}>
          <View style={styles.skeletonPhoto} />
          <View style={styles.skeletonLineWide} />
          <View style={styles.skeletonLineNarrow} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    paddingHorizontal: spacing.lg,
  },
  skeletonRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    overflow: "hidden",
  },
  skeletonCard: {
    width: exploreLayout.cardWidth,
    gap: spacing.sm,
  },
  skeletonPhoto: {
    width: exploreLayout.cardWidth,
    height: exploreLayout.cardPhotoHeight,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  skeletonLineWide: {
    height: 16,
    width: "70%",
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
  skeletonLineNarrow: {
    height: 12,
    width: "45%",
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
});
