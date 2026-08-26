import type { RestaurantStory } from "@bookeat/api";
import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Animated,
  AppState,
  Easing,
  Modal,
  PanResponder,
  type PanResponderGestureState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openWebsite } from "../../lib/external-links";
import { PhotoView } from "../PhotoView";
import { IconButton } from "../IconButton";
import { CaretUp, X } from "../icons";

const t = getDictionary();

/** How long one story stays on screen before auto-advancing. Tap either half
 * to move faster; this is only the untouched pace. */
const STORY_DURATION_MS = 5000;
/** Minimum top padding on a platform whose Modal reports no safe-area inset
 * (Android with a translucent status bar), so the progress bars never hide
 * under the clock. */
const MIN_TOP_INSET = spacing.lg;
/**
 * How far the finger must travel UP before the gesture counts as a swipe up
 * and not as a tap that wobbled. 48dp is roughly a thumb's width — below that,
 * a tap on the tap-zone Pressable still wins.
 */
const SWIPE_UP_MIN_DISTANCE = 48;

/** Up, and more up than sideways — a diagonal drag is not an intent to open. */
function isSwipeUp(gesture: Pick<PanResponderGestureState, "dx" | "dy">): boolean {
  return gesture.dy <= -SWIPE_UP_MIN_DISTANCE && Math.abs(gesture.dx) < Math.abs(gesture.dy);
}

/**
 * Fullscreen Instagram-style story viewer. Full-bleed image, segmented
 * progress bars pinned at the top (one per story, the active one filling),
 * the caption near the bottom and a close control top-right.
 *
 * Navigation: tap the RIGHT half → next story, tap the LEFT half → previous.
 * The active segment also fills on a timer and auto-advances; either way,
 * advancing past the LAST story (or the X, or the Android back button)
 * dismisses the viewer. Safe-area insets are respected top and bottom.
 *
 * A story that carries an `actionUrl` gains ONE more move: a swipe up opens
 * the link, Instagram-style. Three things that were easy to get wrong here:
 *
 *   1. A swipe must not read as a tap. The tap zones are Pressables, so the
 *      swipe lives on a PanResponder ABOVE them which only claims the gesture
 *      once the finger has travelled `SWIPE_UP_MIN_DISTANCE` upwards; claiming
 *      it terminates the Pressable, so the story does not also advance. On a
 *      story WITHOUT a link the responder never claims anything, so that story
 *      behaves exactly as it did before this existed.
 *   2. The timer must not run behind the browser. Opening the link pauses the
 *      story (the progress bar freezes where it stood) instead of quietly
 *      advancing three stories while the guest reads a web page.
 *   3. Nothing may leave the viewer frozen. `Linking.openURL` can reject (no
 *      browser, a scheme nobody handles) — `openWebsite` swallows that and
 *      returns false, and we un-pause immediately, because nothing opened and
 *      the app never left the foreground. And ANY tap un-pauses too, so even a
 *      device that never reports coming back to the foreground is one tap from
 *      a running story again.
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
  // Пауза бывает ровно по одной причине: гость ушёл по ссылке истории. Пока
  // она стоит, таймер не идёт и полоса прогресса замерла на своём месте.
  const [paused, setPaused] = React.useState(false);
  // Сколько сегмента уже заполнено (0..1). Нужно, чтобы после паузы досчитать
  // ОСТАТОК, а не начинать пять секунд заново.
  const filled = React.useRef(0);

  React.useEffect(() => {
    const id = progress.addListener(({ value }) => {
      filled.current = value;
    });
    return () => progress.removeListener(id);
  }, [progress]);

  // Каждое открытие начинает с той истории, по которой тапнули в ленте.
  React.useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  const clampedIndex = Math.min(index, stories.length - 1);
  const current: RestaurantStory | undefined = stories[clampedIndex];

  const goNext = React.useCallback(() => {
    // Любой тап снимает паузу: иначе история, оставленная на паузе ради
    // браузера, могла бы остаться без таймера навсегда.
    setPaused(false);
    if (clampedIndex < stories.length - 1) setIndex(clampedIndex + 1);
    else onClose();
  }, [clampedIndex, stories.length, onClose]);

  const goPrev = React.useCallback(() => {
    setPaused(false);
    // На первой истории «назад» перезапускает её, а не закрывает просмотр —
    // через restartTick, чтобы эффект автопрокрутки завёл таймер заново.
    if (clampedIndex > 0) setIndex(clampedIndex - 1);
    else setRestartTick((n) => n + 1);
  }, [clampedIndex]);

  const actionUrl = current?.actionUrl ?? null;

  /** Свайп вверх (и тап по подсказке) — открыть ссылку истории. */
  const openLink = React.useCallback(() => {
    if (!actionUrl) return;
    setPaused(true);
    // openWebsite НИКОГДА не бросает: Linking.openURL может отклониться
    // (нет браузера, схему никто не обрабатывает) — тогда false, и пауза
    // снимается сразу, потому что приложение никуда не уходило.
    void openWebsite(actionUrl).then((opened) => {
      if (!opened) setPaused(false);
    });
  }, [actionUrl]);

  // Возврат из браузера. Приложение уходило в фон, значит про историю гость
  // уже забыл и досматривать «остаток двух секунд» бессмысленно — текущая
  // история начинается ЗАНОВО (restartTick), а не продолжается и не пропускается.
  React.useEffect(() => {
    if (!paused) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      setPaused(false);
      setRestartTick((n) => n + 1);
    });
    return () => subscription.remove();
  }, [paused]);

  // Жест выдан нам системой ответчиков (значит, порог вверх пройден) и ещё не
  // отпущен. Ref, а не state: между grant и release перерисовка не нужна.
  const swipeArmed = React.useRef(false);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        // Тапы НЕ трогаем: на старте касания ответчиком остаётся зона тапа.
        onStartShouldSetPanResponder: () => false,
        // ИМЕННО Capture. Ответчиком на старте касания становится зона тапа
        // (Pressable), и обычный `onMoveShouldSetPanResponder` родителя у неё
        // жест уже не отбирает — проверено тестом. Capture-фаза идёт сверху
        // вниз и спрашивает родителя ПЕРВЫМ, поэтому свайп достаётся ему, а
        // тап (условие ложно) по-прежнему уходит вниз, в зону тапа.
        // У истории без ссылки условие ложно всегда — она ведёт себя ровно
        // так же, как до появления свайпа.
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          actionUrl !== null && isSwipeUp(gesture),
        // Жест достался нам — значит порог вверх уже пройден.
        onPanResponderGrant: () => {
          swipeArmed.current = true;
        },
        onPanResponderRelease: (_event, gesture) => {
          const armed = swipeArmed.current;
          swipeArmed.current = false;
          if (!armed) return;
          // ВАЖНО: после выдачи жеста RN обнуляет `dy` и считает его ОТ момента
          // выдачи, поэтому здесь нельзя переспросить isSwipeUp — там всегда
          // будет около нуля (на этом тест и поймал первую версию). Проверяем
          // обратное: палец не поехал назад вниз — это осознанная отмена.
          if (gesture.dy >= SWIPE_UP_MIN_DISTANCE) return;
          openLink();
        },
        onPanResponderTerminate: () => {
          swipeArmed.current = false;
        },
      }),
    [actionUrl, openLink],
  );

  // Сброс полосы живёт ОТДЕЛЬНЫМ эффектом и срабатывает только на смене
  // истории (или её перезапуске). Снятие паузы его не трогает — поэтому
  // после паузы досчитывается остаток, а не полные пять секунд.
  React.useEffect(() => {
    progress.setValue(0);
    filled.current = 0;
  }, [clampedIndex, restartTick, progress]);

  // Автопрокрутка: активный сегмент заполняется за STORY_DURATION_MS (после
  // паузы — за остаток), затем переход дальше. Стоит, пока лист закрыт или
  // пока история на паузе ради открытой ссылки.
  React.useEffect(() => {
    if (!visible || !current || paused) return;
    const remaining = Math.max(0, STORY_DURATION_MS * (1 - filled.current));
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: remaining,
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
  }, [visible, clampedIndex, current, goNext, progress, restartTick, paused]);

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
            (pointerEvents), а крестик нарисован сверху и ловит тап сам.
            Обёртка держит свайп вверх: она забирает жест у зоны тапа только
            когда палец ушёл вверх достаточно далеко (см. panResponder). */}
        <View style={styles.gestureLayer} {...panResponder.panHandlers}>
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
        </View>

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

        {current && (current.caption || actionUrl) ? (
          <View
            style={[styles.bottom, { paddingBottom: bottomInset }]}
            // box-none, а не none: подпись и градиент по-прежнему не ловят
            // касания, а подсказка со ссылкой — ловит.
            pointerEvents="box-none"
          >
            <LinearGradient
              colors={[colors.overlay.bannerGradientTop, colors.overlay.bannerGradientBottom]}
              style={styles.captionGradient}
              pointerEvents="none"
            />
            {current.caption ? (
              <Text style={styles.caption} pointerEvents="none">
                {current.caption}
              </Text>
            ) : null}
            {actionUrl ? (
              // Подсказка не только показывает невидимый жест, но и работает
              // как кнопка: свайп вверх скринридеру недоступен — VoiceOver и
              // TalkBack перехватывают жесты сами.
              <Pressable
                style={styles.linkHint}
                onPress={openLink}
                accessibilityRole="button"
                accessibilityLabel={t.restaurant.storyLinkAction}
              >
                <CaretUp size={16} color={colors.text.onDark} weight="bold" />
                <Text style={styles.linkHintLabel} numberOfLines={1}>
                  {t.restaurant.storyLinkHint}
                </Text>
              </Pressable>
            ) : null}
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
  gestureLayer: {
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
  linkHint: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "flex-end",
    // 44 — тот же минимум касания, что у остальных контролов приложения.
    minHeight: hitSlop.minTouchTarget,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.xxs,
  },
  linkHintLabel: {
    ...typography.labelSemiBold,
    color: colors.text.onDark,
  },
});
