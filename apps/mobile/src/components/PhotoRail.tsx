import { colors, radius, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { PhotoView } from "./PhotoView";

const t = getDictionary();

interface PhotoRailProps {
  /** Photos in the order they should be seen — cover first, gallery after it.
   * Blank/absent entries are dropped here, so a caller can splat a nullable
   * cover in front of a gallery without guarding it. */
  uris: (string | null | undefined)[];
  /** Height of one frame. Defaults to the 240 the event/promo cover uses. */
  height?: number;
  /** Width of one frame. Defaults to the screen minus the side insets — pass it
   * explicitly when the rail sits inside a padded card, where the screen width
   * is not the frame width. */
  frameWidth?: number;
  /** Side inset of the track. The detail screens inset their photos by 8 the
   * way the old single cover was; a rail flush inside a card passes 0. */
  inset?: number;
  style?: StyleProp<ViewStyle>;
  /** Corner radius of a frame — the hero radius on a detail screen, the
   * smaller media radius inside a card. */
  borderRadius?: number;
}

/**
 * A swipeable row of photos where one photo used to be — the «афиша»/«акция»
 * card and the collection block of the «Статья» design all draw their pictures
 * this way now that an event and a promo can carry a gallery beside the cover
 * (backend migration 0070).
 *
 * ONE photo is not a degenerate carousel: with a single frame the dots are
 * hidden and the rail is indistinguishable from the plain cover it replaced —
 * which matters, because most content still has exactly one picture and must
 * not suddenly look like something is missing.
 *
 * Snapping is on `frame + gap`, NOT `pagingEnabled`: the frames are inset, so
 * paging by screen width would drift the second photo left by the inset on
 * every swipe.
 */
export function PhotoRail({
  uris,
  height = 240,
  frameWidth,
  inset = spacing.sm,
  style,
  borderRadius = radius.photoHero,
}: PhotoRailProps) {
  const { width } = useWindowDimensions();
  const photos = uris.filter((uri): uri is string => typeof uri === "string" && uri.trim() !== "");
  const [index, setIndex] = React.useState(0);

  const frame = frameWidth ?? width - inset * 2;
  const interval = frame + spacing.sm;

  // A single photo (or none at all) keeps the old, non-scrolling cover: nothing
  // to snap to, nothing to swipe, no dots.
  if (photos.length <= 1) {
    return (
      <View style={[{ paddingHorizontal: inset }, style]}>
        <PhotoView
          uri={photos[0] ?? null}
          style={[styles.photo, { height, borderRadius }]}
          transition={200}
          priority="high"
          placeholderIconSize={40}
          decorative
        />
      </View>
    );
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / interval);
    // Clamped: an over-scroll bounce at either end rounds past the ends, which
    // would light up a dot that does not exist.
    setIndex(Math.max(0, Math.min(photos.length - 1, next)));
  };

  return (
    <View style={style}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        decelerationRate="fast"
        disableIntervalMomentum
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.track, { paddingHorizontal: inset }]}
        // The frames themselves are decorative; the rail is what a screen
        // reader announces, and it says WHERE in the set the guest is — which
        // is what the dots say to everyone else.
        accessibilityLabel={t.restaurant.photoOf(index + 1, photos.length)}
      >
        {photos.map((uri, i) => (
          <PhotoView
            key={`${uri}-${i}`}
            uri={uri}
            style={[styles.photo, { width: frame, height, borderRadius }]}
            transition={200}
            // Only the first frame is on screen at open; the rest load as the
            // guest swipes to them rather than competing with it.
            priority={i === 0 ? "high" : "normal"}
            placeholderIconSize={40}
            decorative
          />
        ))}
      </ScrollView>

      <View
        style={styles.dots}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {photos.map((uri, i) => (
          <View key={`${uri}-dot-${i}`} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    gap: spacing.sm,
  },
  photo: {
    width: "100%",
    backgroundColor: colors.background.chip,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.background.secondaryButton,
  },
  dotActive: {
    backgroundColor: colors.text.primary,
  },
});
