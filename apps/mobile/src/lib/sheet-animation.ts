import { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

/**
 * Общая анимация нижних шторок.
 *
 * Системная `animationType="slide"` у Modal выезжает рывком и не трогает фон:
 * панель появлялась резко, затемнение — мгновенно, и шторка читалась как
 * подмена экрана, а не как слой поверх него. Здесь один прогресс двигает и
 * панель, и затемнение, поэтому они не могут разъехаться, а торможение в конце
 * даёт ощущение, что панель «приезжает», а не щёлкает.
 *
 * Хук держит шторку в дереве до конца анимации закрытия: если снять её сразу
 * по visible=false, она исчезнет мгновенно и весь смысл плавности пропадёт.
 */

/** Насколько панель уезжает вниз в закрытом состоянии. Заведомо больше высоты
 * любой нашей шторки: точная высота неизвестна до замера, а недоезд оставил бы
 * полоску видимой на закрытом экране. */
export const SHEET_TRAVEL = 640;

const OPEN_MS = 260;
const CLOSE_MS = 200;

export interface SheetAnimation {
  /** Держать ли Modal в дереве (true, пока идёт закрытие). */
  mounted: boolean;
  /** 0 — закрыта, 1 — раскрыта. Годится как opacity затемнения. */
  progress: Animated.Value;
  /** Готовый transform для панели. */
  translateY: Animated.AnimatedInterpolation<number>;
}

export function useSheetAnimation(visible: boolean): SheetAnimation {
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? OPEN_MS : CLOSE_MS,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    // Прерванная анимация (быстро закрыли и снова открыли) не должна оставить
    // панель на полпути — следующий запуск продолжит с текущего значения.
    return () => animation.stop();
  }, [visible, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_TRAVEL, 0],
  });

  return { mounted, progress, translateY };
}
