import type { RestaurantStory } from "@bookeat/api";
import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PhotoView } from "../PhotoView";
import { IconButton } from "../IconButton";
import { X } from "../icons";

const t = getDictionary();

/** How long one story stays on screen before auto-advancing. Tap either half
 * to move faster; this is only the untouched pace. */
const STORY_DURATION_MS = 5000;
/** Minimum top padding on a platform whose Modal reports no safe-area inset
 * (Android with a translucent status bar), so the progress bars never hide
 * under the clock. */
const MIN_TOP_INSET = spacing.lg;

/**
 * Fullscreen Instagram-style story viewer. Full-bleed image, segmented
 * progress bars pinned at the top (one per story, the active one filling),
 * the caption near the bottom and a close control top-right.
 *
 * Navigation: tap the RIGHT half → next story, tap the LEFT half → previous.
 * The active segment also fills on a timer and auto-advances; either way,
 * advancing past the LAST story (or the X, or the Android back button)
 * dismisses the viewer. Safe-area insets are respected top and bottom.
 */
export function StoryViewer({
  stories,
  initialIndex,
  visible,
  onClose,
}: {
  stories: RestaurantStory[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = React.useState(initialIndex);
  const progress = React.useRef(new Animated.Value(0)).current;
  // Bumped to replay the CURRENT story without changing the index (a back-tap on
  // the first story). It is a dependency of the auto-advance effect, so bumping
  // it re-runs that effect and starts a fresh timer — calling progress.setValue
  // here directly would only STOP the in-flight animation (RN's setValue kills
  // the running node) and, since the index is unchanged, the effect would never
  // restart it, freezing auto-advance for the rest of the session.
  const [restartTick, setRestartTick] = React.useState(0);

  // Каждое открытие начинает с той истории, по которой тапнули в ленте.
  React.useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  const clampedIndex = Math.min(index, stories.length - 1);
  const current: RestaurantStory | undefined = stories[clampedIndex];

  const goNext = React.useCallback(() => {
    if (clampedIndex < stories.length - 1) setIndex(clampedIndex + 1);
    else onClose();
  }, [clampedIndex, stories.length, onClose]);

  const goPrev = React.useCallback(() => {
    // На первой истории «назад» перезапускает её, а не закрывает просмотр —
    // через restartTick, чтобы эффект автопрокрутки завёл таймер заново.
    if (clampedIndex > 0) setIndex(clampedIndex - 1);
    else setRestartTick((n) => n + 1);
  }, [clampedIndex]);

  // Автопрокрутка: активный сегмент заполняется за STORY_DURATION_MS, затем
  // переход дальше. Перезапускается на каждой смене истории и останавливается,
  // когда лист закрыт.
  React.useEffect(() => {
    if (!visible || !current) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION_MS,
      easing: Easing.linear,
      // Ширина сегмента не поддерживается нативным драйвером.
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) goNext();
    });
    return () => animation.stop();
    // restartTick re-runs this effect to replay the current story (back-tap on
    // the first one) even though the index has not changed.
  }, [visible, clampedIndex, current, goNext, progress, restartTick]);

  const topInset = Math.max(insets.top, MIN_TOP_INSET);
  const bottomInset = insets.bottom + spacing.lg;

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
      statusBarTranslucent
      transparent={false}
    >
      <View style={styles.root}>
        {current ? (
          <PhotoView
            uri={current.imageUrl}
            style={styles.image}
            contentFit="cover"
            decorative
            placeholderIcon={false}
            placeholderColor={colors.background.photoViewer}
          />
        ) : null}

        {/* Тап-зоны лежат ПОД оверлеями: подписи и прогресс их не перехватывают
            (pointerEvents), а крестик нарисован сверху и ловит тап сам. */}
        <Pressable
          style={[styles.tapZone, styles.tapLeft]}
          onPress={goPrev}
          accessibilityRole="button"
          accessibilityLabel={t.restaurant.storyPrevious}
        />
        <Pressable
          style={[styles.tapZone, styles.tapRight]}
          onPress={goNext}
          accessibilityRole="button"
          accessibilityLabel={t.restaurant.storyNext}
        />

        <View style={[styles.top, { paddingTop: topInset }]} pointerEvents="box-none">
          <View style={styles.progressRow} pointerEvents="none">
            {stories.map((story, i) => (
              <View key={story.id} style={styles.progressTrack}>
                {i < clampedIndex ? <View style={styles.progressFillFull} /> : null}
                {i === clampedIndex ? (
                  <Animated.View
                    style={[
                      styles.progressFillFull,
                      {
                        width: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>
          <View style={styles.headerRow} pointerEvents="box-none">
            <IconButton
              icon={X}
              tone="onImage"
              accessibilityLabel={t.a11y.closeButton}
              onPress={onClose}
            />
          </View>
        </View>

        {current?.caption ? (
          <View
            style={[styles.bottom, { paddingBottom: bottomInset }]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={[colors.overlay.bannerGradientTop, colors.overlay.bannerGradientBottom]}
              style={styles.captionGradient}
            />
            <Text style={styles.caption}>{current.caption}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.photoViewer,
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  tapZone: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  tapLeft: {
    left: 0,
    width: "50%",
  },
  tapRight: {
    right: 0,
    width: "50%",
  },
  top: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: spacing.md,
  },
  progressRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: colors.overlay.carouselDot,
  },
  progressFillFull: {
    height: "100%",
    backgroundColor: colors.overlay.carouselDotActive,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.sm,
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    justifyContent: "flex-end",
  },
  captionGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
  },
  caption: {
    ...typography.titleMd,
    color: colors.text.onDark,
  },
});
