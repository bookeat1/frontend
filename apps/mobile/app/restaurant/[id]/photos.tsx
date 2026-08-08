import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowLeft } from "../../../src/components/icons";
import { IconButton } from "../../../src/components/IconButton";
import { PhotoGrid } from "../../../src/components/PhotoGrid";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { SegmentedTabs } from "../../../src/components/SegmentedTabs";
import { EmptyState, ErrorState, LoadingState } from "../../../src/components/StateViews";
import { useRestaurant } from "../../../src/hooks/useRestaurant";

const t = getDictionary();

const TABS = [t.restaurant.photoAllFilter, t.restaurant.photoTabFood, t.restaurant.photoTabInterior] as const;

export default function RestaurantPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: restaurant, isLoading, isError, refetch } = useRestaurant(id);
  const [activeTab, setActiveTab] = useState(0);

  const filtered = useMemo(() => {
    if (!restaurant) return [];
    if (activeTab === 1) return restaurant.photos.filter((p) => p.category === "food");
    if (activeTab === 2) return restaurant.photos.filter((p) => p.category === "interior");
    return restaurant.photos;
  }, [restaurant, activeTab]);

  return (
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <IconButton icon={ArrowLeft} accessibilityLabel={t.a11y.backButton} onPress={() => router.back()} />
        <Text style={styles.title}>{t.restaurant.photos}</Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <LoadingState title={t.common.loading} />
      ) : isError || !restaurant ? (
        <ErrorState
          title={t.search.errorTitle}
          description={t.search.errorDescription}
          action={{ label: t.common.retry, onPress: () => refetch(), variant: "button" }}
        />
      ) : (
        <>
          <View style={styles.tabsRow}>
            <SegmentedTabs labels={[...TABS]} activeIndex={activeTab} onChange={setActiveTab} />
          </View>
          {filtered.length === 0 ? (
            // У большинства заведений в каталоге фотографий пока нет вовсе —
            // пустая сетка без объяснения выглядит как сломанный экран.
            <EmptyState
              title={t.restaurant.photosEmptyTitle}
              description={t.restaurant.photosEmptyDescription}
            />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              <PhotoGrid
                photos={filtered}
                onPressPhoto={(index) => {
                  const globalIndex = restaurant.photos.indexOf(filtered[index]);
                  router.push(`/restaurant/${restaurant.id}/photo/${globalIndex}`);
                }}
              />
            </ScrollView>
          )}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingHorizontal: spacing.sm,
  },
  title: {
    ...typography.titleMd,
    color: colors.text.primary,
  },
  tabsRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  scroll: {
    paddingBottom: spacing.xxxl,
  },
});
