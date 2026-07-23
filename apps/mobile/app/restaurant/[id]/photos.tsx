import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { IconButton } from "../../../src/components/IconButton";
import { PhotoGrid } from "../../../src/components/PhotoGrid";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { ErrorState, LoadingState } from "../../../src/components/StateViews";
import { useRestaurant } from "../../../src/hooks/useRestaurant";

const t = getDictionary();

export default function RestaurantPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: restaurant, isLoading, isError, refetch } = useRestaurant(id);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <IconButton
          glyph="←"
          accessibilityLabel={t.a11y.backButton}
          onPress={() => router.back()}
        />
        <Text style={styles.title}>{t.restaurant.photos}</Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <LoadingState title={t.common.loading} />
      ) : isError || !restaurant ? (
        <ErrorState
          title={t.search.errorTitle}
          description={t.search.errorDescription}
          retryLabel={t.common.retry}
          onRetry={() => refetch()}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <PhotoGrid
            photos={restaurant.photos}
            onPressPhoto={(index) => router.push(`/restaurant/${restaurant.id}/photo/${index}`)}
          />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  scroll: {
    paddingBottom: spacing.xxxl,
  },
});
