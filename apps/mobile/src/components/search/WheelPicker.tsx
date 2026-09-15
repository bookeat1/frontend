import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import React, { useCallback, useEffect, useRef } from "react";
import {
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { hapticSelectionTick } from "../../lib/haptics";

/**
 * Колесо выбора — «Гости» и «Дата» в макетах 918:12428 и 918:12317.
 *
 * Значения идут столбиком, выбранное стоит по центру в светлой плашке,
 * соседние приглушены. Прокрутка липнет к строке (snapToInterval), поэтому
 * колесо не может остановиться между значениями и показать выбор, которого нет.
 *
 * Строки ещё и нажимаются. Это не украшение: попасть пальцем в нужное значение
 * прокруткой на длинном списке дат тяжело, а тап по видимой строке — самый
 * короткий путь. Скроллом и тапом управляет один и тот же обработчик, так что
 * два способа не могут разойтись в том, что считается выбранным.
 *
 * ТАКТИЛЬНЫЙ ЩЕЛЧОК НА КАЖДОЕ СМЕНИВШЕЕСЯ ЗНАЧЕНИЕ (правка владельца
 * 2026-09-01: «добавь микровибрацию как в нативках при скроле даты и
 * количества гостей»). Отклик привязан не к касанию и не к отпусканию, а к
 * тому, что под центром колеса встала ДРУГАЯ строка, — то есть щёлкает всю
 * прокрутку, а не один раз в конце, как это делает `onChange`.
 *
 * Почему нельзя было просто повесить вибрацию на `onChange`: наверх значение
 * уходит только когда колесо ОСТАНОВИЛОСЬ (`onMomentumScrollEnd`), и на
 * пролистывании двадцати дат гость получил бы ровно один щелчок вместо
 * двадцати. Системный барабан щёлкает каждое проехавшее значение — за ним и
 * идём.
 *
 * НА `react-native-web` `snapToInterval`/`decelerationRate`/`onScrollEndDrag`/
 * `onMomentumScrollEnd` не реализованы вовсе (проверено чтением
 * `react-native-web/dist/exports/ScrollView/index.js` и живым тестом в
 * headless-браузере — колбэки не вызываются НИ РАЗУ), поэтому на вебе
 * `settle()` ничем не запускается: колесо визуально замирало между строк, а
 * даже когда докручивалось глазами, применённое значение оставалось старым.
 * `webSnapStyle`/`webRowSnapStyle` (CSS `scroll-snap-*`) чинят докрутку до
 * грида, `WEB_SCROLL_END_DEBOUNCE_MS` ниже — вызов самого `settle()` через
 * единственное событие, которое RNW действительно шлёт (`onScroll`).
 */

export const WHEEL_ROW_HEIGHT = 48;
/** Сколько соседних строк видно сверху и снизу от выбранной. */
const VISIBLE_NEIGHBOURS = 1;

/**
 * CSS `scroll-snap-*` — веб-замена RN-only `snapToInterval` (см. комментарий
 * компонента выше). `undefined` на нативе: там снапом занимается сама ОС, а
 * незнакомые веб-CSS-поля лучше не передавать вовсе, чем полагаться на то,
 * что RN их молча проигнорирует. Нарочно БЕЗ `scrollSnapStop: "always"`:
 * это заставило бы браузер гасить флик на КАЖДОЙ строке, а список дат — это
 * ~30 строк, и на нативе `decelerationRate="fast"` спокойно проезжает
 * несколько за один флик — `"always"` тут ощутимо медленнее нативного чувства.
 */
const webSnapStyle: ViewStyle | undefined =
  Platform.OS === "web" ? ({ scrollSnapType: "y mandatory" } as ViewStyle) : undefined;
const webRowSnapStyle: ViewStyle | undefined =
  Platform.OS === "web" ? ({ scrollSnapAlign: "center" } as ViewStyle) : undefined;

/**
 * Сколько ждать тишины в потоке `onScroll`, прежде чем считать прокрутку на
 * вебе законченной и звать `settle()` — см. комментарий компонента. RNW сам
 * досылает ОДИН финальный `onScroll` спустя ~100мс после последнего реального
 * события (`ScrollViewBase.js`, `handleScrollEnd`) — этот довесок тоже
 * попадает в `tick` и переставляет наш таймер ещё раз, поэтому реальная
 * задержка коммита от последнего касания пальцем — не `WEB_SCROLL_END_
 * DEBOUNCE_MS`, а примерно 100мс (довесок RNW) + это число. Для черновика
 * колеса это по-прежнему незаметно, но при проверке в тестах фальшивыми
 * таймерами продвигать нужно на сумму обоих, не только на это число.
 */
const WEB_SCROLL_END_DEBOUNCE_MS = 120;

export interface WheelOption {
  /** Значение, которое вернётся наверх. */
  value: string;
  label: string;
}

export function WheelPicker({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: WheelOption[];
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
}) {
  const ref = useRef<ScrollView>(null);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  /**
   * Строка, которая стояла под центром в момент прошлого щелчка.
   *
   * Ref, а не состояние: от неё ничего не рисуется, а перерисовка на каждом
   * кадре прокрутки — ровно то, чего колесо себе позволить не может.
   */
  const tickedAt = useRef(index);

  // Держим колесо на выбранном значении: при открытии шторки и когда выбор
  // меняют снаружи (например, сменили дату и число гостей стало недоступным).
  //
  // Отметка щелчка двигается ВМЕСТЕ с колесом. Иначе программная прокрутка
  // (открытие шторки, тап по строке) прилетела бы обратно событием прокрутки
  // и щёлкнула бы вибромотором за то, чего человек пальцем не делал.
  useEffect(() => {
    tickedAt.current = index;
    ref.current?.scrollTo({ y: index * WHEEL_ROW_HEIGHT, animated: false });
  }, [index]);

  /** Строка под центром колеса при данном смещении прокрутки. */
  const rowUnderCentre = useCallback(
    (offsetY: number) =>
      Math.min(Math.max(Math.round(offsetY / WHEEL_ROW_HEIGHT), 0), options.length - 1),
    [options.length],
  );

  const settle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ROW_HEIGHT);
      const picked = options[Math.min(Math.max(next, 0), options.length - 1)];
      if (picked && picked.value !== value) onChange(picked.value);
    },
    [onChange, options, value],
  );

  /**
   * На вебе `settle` выше некому вызвать через `onScrollEndDrag`/
   * `onMomentumScrollEnd` — RNW их не шлёт (см. комментарий компонента).
   * Тайм-аут, который сам себя постоянно откладывает на каждый `onScroll`
   * (см. `tick` ниже), стреляет ровно тогда, когда поток событий прокрутки
   * затих на `WEB_SCROLL_END_DEBOUNCE_MS` — это и есть «колесо остановилось»
   * для веба.
   *
   * `mounted` — отдельный ref, а не просто «очистить таймер при
   * размонтировании»: у RNW есть СВОЙ внутренний `setTimeout` на ~100мс
   * (`ScrollViewBase.js`, довесок к `onScroll` — см. комментарий
   * `WEB_SCROLL_END_DEBOUNCE_MS`), который живёт в замыкании самого DOM-узла
   * и не знает о размонтировании React-дерева — он может выстрелить и
   * заново переставить НАШ таймер уже после того, как компонент ушёл.
   * Без проверки `mounted.current` это в итоге зовёт `onChange` шторки,
   * которой уже нет.
   */
  const webScrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
      if (webScrollEndTimer.current != null) clearTimeout(webScrollEndTimer.current);
    },
    [],
  );

  /**
   * Щелчок — ровно тогда, когда под центром встала ДРУГАЯ строка.
   *
   * Здесь нарочно не вызывается `onChange`: значение по-прежнему уходит наверх
   * только когда колесо остановилось. Иначе каждый кадр прокрутки перезапускал
   * бы поиск (см. WheelSheet), а «черновой выбор» перестал бы быть черновым.
   *
   * На вебе тот же вызов ещё и переставляет debounce-таймер `settle()` выше —
   * это единственное реально приходящее на RNW событие прокрутки, других
   * колбэков для отметки «конец жеста» там нет.
   */
  const tick = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Platform.OS === "web") {
        if (webScrollEndTimer.current != null) clearTimeout(webScrollEndTimer.current);
        webScrollEndTimer.current = setTimeout(() => {
          if (mounted.current) settle(e);
        }, WEB_SCROLL_END_DEBOUNCE_MS);
      }
      const centred = rowUnderCentre(e.nativeEvent.contentOffset.y);
      if (centred === tickedAt.current) return;
      tickedAt.current = centred;
      hapticSelectionTick();
    },
    [rowUnderCentre, settle],
  );

  const height = WHEEL_ROW_HEIGHT * (VISIBLE_NEIGHBOURS * 2 + 1);

  return (
    <View style={[styles.root, { height }]} accessibilityLabel={accessibilityLabel}>
      {/* Плашка выбранного значения лежит ПОД списком и не двигается: она
          обозначает центр колеса, а не конкретную строку. */}
      <View
        style={[styles.highlight, { top: WHEEL_ROW_HEIGHT * VISIBLE_NEIGHBOURS }]}
        pointerEvents="none"
      />
      <ScrollView
        ref={ref}
        style={webSnapStyle}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ROW_HEIGHT}
        decelerationRate="fast"
        onScroll={tick}
        // Без этого RN присылает событие прокрутки раз в секунду, и щелчки
        // отстанут от колеса настолько, что перестанут читаться как отклик на
        // него. 16 мс — кадр при 60 Гц.
        scrollEventThrottle={16}
        onMomentumScrollEnd={settle}
        // Медленное «дотягивание» пальцем не даёт momentum-события, и без этого
        // колесо молча оставалось бы на старом значении.
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: WHEEL_ROW_HEIGHT * VISIBLE_NEIGHBOURS }}
      >
        {options.map((option, i) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: i === index }}
            accessibilityLabel={option.label}
            onPress={() => {
              // Тап — это тоже смена значения, и колесо обязано отозваться так
              // же, как если бы до этой строки его докрутили. Условие ровно то
              // же, что у прокрутки: под центром встала ДРУГАЯ строка. Сам
              // переезд колеса щелчка уже не даст — отметку двигает эффект
              // выше.
              if (i !== tickedAt.current) {
                tickedAt.current = i;
                hapticSelectionTick();
              }
              onChange(option.value);
            }}
            style={[styles.row, webRowSnapStyle]}
          >
            <Text style={[styles.label, i === index && styles.labelSelected]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    justifyContent: "center",
  },
  highlight: {
    position: "absolute",
    left: 0,
    right: 0,
    height: WHEEL_ROW_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
  row: {
    height: WHEEL_ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  label: {
    ...typography.body,
    color: colors.text.muted,
  },
  labelSelected: {
    ...typography.titleSm,
    color: colors.text.primary,
  },
});
