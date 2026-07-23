import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconButton } from "../../../../src/components/IconButton";
import { ErrorState, LoadingState } from "../../../../src/components/StateViews";
import { useRestaurant } from "../../../../src/hooks/useRestaurant";

const t = getDictionary();

export default function PhotoViewerScreen() {
  const { id, photoId } = useLocalSearchParams<{ id: string; photoId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data: restaurant, isLoading, isError, refetch } = useRestaurant(id);

  const index = Number(photoId);
  const photo = useMemo(() => restaurant?.photos[index], [restaurant, index]);
  const total = restaurant?.photos.length ?? 0;

  const goTo = (nextIndex: number) => {
    if (!restaurant) return;
    if (nextIndex < 0 || nextIndex >= restaurant.photos.length) return;
    router.setParams({ photoId: String(nextIndex) });
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <IconButton
            glyph="✕"
            tone="onImage"
            accessibilityLabel={t.a11y.closeButton}
            onPress={() => router.back()}
          />
          {photo ? (
            <Text style={styles.counter}>{t.restaurant.photoOf(index + 1, total)}</Text>
          ) : null}
          <View style={{ width: 44 }} />
        </View>

        {isLoading ? (
          <LoadingState title={t.common.loading} />
        ) : isError || !restaurant || !photo ? (
          <ErrorState
            title={t.search.errorTitle}
            description={t.search.errorDescription}
            retryLabel={t.common.retry}
            onRetry={() => refetch()}
          />
        ) : (
          <>
            <Image
              source={{ uri: photo.uri }}
              style={{ width, height: width }}
              contentFit="contain"
              accessibilityLabel={photo.alt}
              transition={150}
            />
            <View style={styles.navRow}>
              <IconButton
                glyph="‹"
                tone="onImage"
                accessibilityLabel={t.restaurant.previousPhoto}
                onPress={() => goTo(index - 1)}
              />
              <IconButton
                glyph="›"
                tone="onImage"
                accessibilityLabel={t.restaurant.nextPhoto}
                onPress={() => goTo(index + 1)}
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.neutral[900],
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  counter: {
    ...typography.bodyMedium,
    color: colors.neutral[0],
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
});
