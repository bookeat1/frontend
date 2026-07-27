import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef } from "react";
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
 */
export default function PhotoViewerScreen() {
  const { id, photoId } = useLocalSearchParams<{ id: string; photoId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data: restaurant, isLoading, isError, refetch } = useRestaurant(id);
  const listRef = useRef<FlatList<Photo>>(null);

  const initialIndex = Number(photoId) || 0;
  const total = restaurant?.photos.length ?? 0;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
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
              <View style={{ width, height: width }}>
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

        <View style={styles.header} pointerEvents="box-none">
          <IconButton icon={X} tone="onImage" accessibilityLabel={t.a11y.closeButton} onPress={() => router.back()} />
          {restaurant ? (
            <Text style={styles.counter}>{t.restaurant.photoOf(initialIndex + 1, total)}</Text>
          ) : null}
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.photoViewer,
  },
  safeArea: {
    flex: 1,
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
    paddingVertical: spacing.sm,
  },
  counter: {
    ...typography.titleMd,
    color: colors.text.onDark,
  },
});
