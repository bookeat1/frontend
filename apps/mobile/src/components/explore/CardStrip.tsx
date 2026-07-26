import { exploreLayout, spacing } from "@bookeat/design-tokens";
import React, { useCallback } from "react";
import { FlatList, type ListRenderItem, StyleSheet, View } from "react-native";

/**
 * The horizontal card rail every Explore section uses.
 *
 * Deliberately NOT snapping: the reference shows the next card cut off
 * mid-width, which is the affordance that says "there is more to the right".
 * Paging/snapping would align cards to the edge and destroy that peek.
 *
 * Windowing is tight on purpose — `PopularRestaurantCard` fires one
 * availability request per mounted card, so mounting far ahead of the viewport
 * would mean a burst of requests on a phone connection.
 */
export function CardStrip<T>({
  data,
  keyExtractor,
  renderItem,
  accessibilityLabel,
}: {
  data: readonly T[];
  keyExtractor: (item: T) => string;
  renderItem: ListRenderItem<T>;
  accessibilityLabel: string;
}) {
  const separator = useCallback(() => <View style={styles.separator} />, []);

  return (
    <FlatList
      data={data as T[]}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ItemSeparatorComponent={separator}
      contentContainerStyle={styles.content}
      accessibilityLabel={accessibilityLabel}
      initialNumToRender={2}
      windowSize={3}
      removeClippedSubviews={false}
      // Constant width cards: telling the list the geometry up front avoids a
      // measurement pass per card on a slow device.
      getItemLayout={(_, index) => ({
        length: exploreLayout.cardWidth + spacing.sm,
        offset: (exploreLayout.cardWidth + spacing.sm) * index,
        index,
      })}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
  },
  separator: {
    width: spacing.sm,
  },
});
