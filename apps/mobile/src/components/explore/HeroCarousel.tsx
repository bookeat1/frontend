import { colors, exploreLayout, radius, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useCallback, useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { PhotoView } from "../PhotoView";
import type { HeroBanner } from "./placeholder";

const t = getDictionary();

/**
 * Full-bleed promo carousel at the very top of Explore — it runs UNDER the
 * status bar, which is why the screen renders it outside any SafeAreaView and
 * flips the status bar to light content while it is on screen.
 *
 * Paged (unlike the card strips below): a promo banner is one full screen wide,
 * so a half-scrolled banner would just look broken.
 *
 * DATA IS PLACEHOLDER — no promo-banner endpoint exists, see ./placeholder.ts.
 */
export function HeroCarousel({ banners }: { banners: readonly HeroBanner[] }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  // Kept in a ref as well so the scroll handler never re-creates itself and
  // the list is not re-rendered on every frame of a swipe.
  const indexRef = useRef(0);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      if (next !== indexRef.current) {
        indexRef.current = next;
        setIndex(next);
      }
    },
    [width],
  );

  if (banners.length === 0) {
    // An empty carousel must not collapse the sheet onto the status bar.
    return <View style={styles.fallback} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={banners as HeroBanner[]}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onScroll={onScroll}
        scrollEventThrottle={32}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => (
          <PhotoView
            uri={item.imageUrl}
            alt={`${item.alt}. ${t.explore.heroBanner(i + 1, banners.length)}`}
            style={[styles.image, { width }]}
            placeholderIconSize={40}
          />
        )}
      />

      <View style={styles.dots} pointerEvents="none">
        {banners.map((banner, i) => (
          <View
            key={banner.id}
            style={[styles.dot, i === index ? styles.dotActive : styles.dotIdle]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: exploreLayout.heroHeight,
    backgroundColor: colors.background.bannerPlaceholder,
  },
  fallback: {
    height: exploreLayout.heroHeight,
    backgroundColor: colors.background.bannerPlaceholder,
  },
  image: {
    height: exploreLayout.heroHeight,
  },
  dots: {
    position: "absolute",
    // Sits above the sheet overlap so the sheet's rounded corner never covers
    // the dots.
    bottom: exploreLayout.sheetOverlap + spacing.sm,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
  },
  dot: {
    height: 4,
    borderRadius: radius.pill,
  },
  dotIdle: {
    width: 4,
    backgroundColor: colors.overlay.carouselDot,
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.overlay.carouselDotActive,
  },
});
