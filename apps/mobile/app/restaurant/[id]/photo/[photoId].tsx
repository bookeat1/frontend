import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef } from "react";
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "../../../../src/components/icons";
import { IconButton } from "../../../../src/components/IconButton";
import { PhotoView } from "../../../../src/components/PhotoView";
import { ErrorState, LoadingState } from "../../../../src/components/StateViews";
import { useRestaurant } from "../../../../src/hooks/useRestaurant";
import type { Photo } from "@bookeat/api";

const t = getDictionary();

/**
 * Figma node 340:2455 shows only a close button and a "N из total" counter
 * over a full-bleed photo — no visible prev/next chevrons, implying swipe
 * navigation. This screen pages through photos with a horizontal FlatList
 * and keeps the route's photoId param in sync with the current page.
 *
 * The photo is FULL-BLEED (each page is the whole screen, not a square), so
 * the viewer is deliberately NOT wrapped in a SafeAreaView — that would inset
 * the image and leave black bands top and bottom. Only the controls row
 * respects the safe area, via the top inset, so the close button never hides
 * under the status-bar clock.
 */
export default function PhotoViewerScreen() {
  const { id, photoId } = useLocalSearchParams<{ id: string; photoId: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { data: restaurant, isLoading, isError, refetch } = useRestaurant(id);
  const listRef = useRef<FlatList<Photo>>(null);

  const initialIndex = Number(photoId) || 0;
  const total = restaurant?.photos.length ?? 0;

  return (
    <View style={styles.root}>
      {isLoading ? (
        <View style={styles.centered}>
          <LoadingState title={t.common.loading} />
        </View>
      ) : isError || !restaurant ? (
        <View style={styles.centered}>
          <ErrorState
            title={t.search.errorTitle}
            description={t.search.errorDescription}
            retryLabel={t.common.retry}
            onRetry={() => refetch()}
          />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={restaurant.photos}
          keyExtractor={(photo) => photo.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={(e) => {
            const nextIndex = Math.round(e.nativeEvent.contentOffset.x / width);
            router.setParams({ photoId: String(nextIndex) });
          }}
          renderItem={({ item }) => (
            // Each page fills the whole screen; `contain` keeps the photo
            // undistorted, filling the long edge instead of a small square.
            <View style={{ width, height }}>
              <PhotoView
                uri={item.uri}
                alt={item.alt}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
              />
            </View>
          )}
        />
      )}

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <IconButton icon={X} tone="onImage" accessibilityLabel={t.a11y.closeButton} onPress={() => router.back()} />
        {restaurant ? (
          <Text style={styles.counter}>{t.restaurant.photoOf(initialIndex + 1, total)}</Text>
        ) : null}
        <View style={{ width: 44 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.photoViewer,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  counter: {
    ...typography.titleMd,
    color: colors.text.onDark,
  },
});
