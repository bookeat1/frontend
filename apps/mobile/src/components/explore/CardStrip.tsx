import { colors, exploreLayout, spacing } from "@bookeat/design-tokens";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useState } from "react";
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
 *
 * ЗАТУХАНИЕ У ПРАВОГО КРАЯ (правка владельца 2026-08-21: «нужно, чтобы было
 * понятно, что он скроллится»). Обрезанная карточка сама по себе намекает на
 * продолжение слабо — на узком экране она может не попасть в кадр вовсе.
 * Поэтому у правого края лежит короткая полоска, где белый фон блока переходит
 * в прозрачный: содержимое уходит ПОД неё, и видно, что ряд продолжается.
 *
 * Полоска исчезает, когда ряд домотали до конца: подсказка, которая обещает
 * продолжение там, где его уже нет, врёт. Касания она не перехватывает.
 */
export function CardStrip<T>({
  data,
  keyExtractor,
  renderItem,
  accessibilityLabel,
  itemWidth = exploreLayout.cardWidth,
  itemGap = spacing.sm,
}: {
  data: readonly T[];
  keyExtractor: (item: T) => string;
  renderItem: ListRenderItem<T>;
  accessibilityLabel: string;
  /** Fixed width of one item, so `getItemLayout` stays exact. Defaults to the
   * standard Explore card; the circular cuisine rail passes its own width. */
  itemWidth?: number;
  /** Просвет между элементами. По умолчанию 8 — столько между карточками в
   * макете; ряд кухонь передаёт свои 12 (node 3447:12763 — `gap-[12px]`). */
  itemGap?: number;
}) {
  const separator = useCallback(() => <View style={{ width: itemGap }} />, [itemGap]);
  // Ряд длиннее экрана и ещё не домотан до конца — только тогда подсказка
  // что-то обещает.
  const [contentWidth, setContentWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const scrollable = contentWidth > viewportWidth + 1;

  return (
    <View>
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
        length: itemWidth + itemGap,
        offset: (itemWidth + itemGap) * index,
        index,
      })}
      onContentSizeChange={(width) => setContentWidth(width)}
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      onScroll={(event) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        setAtEnd(contentOffset.x + layoutMeasurement.width >= contentSize.width - 1);
      }}
      scrollEventThrottle={16}
      />
      {scrollable && !atEnd ? (
        <LinearGradient
          colors={[colors.background.surfaceTransparent, colors.background.surface]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.edgeFade}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Ширина затухания: примерно половина просвета между карточками сверх
  // отступа блока — достаточно, чтобы прочитаться, и мало, чтобы не съесть
  // карточку.
  edgeFade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: spacing.xxxl,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
});
