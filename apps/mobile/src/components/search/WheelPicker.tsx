import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import React, { useCallback, useEffect, useRef } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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
 */

export const WHEEL_ROW_HEIGHT = 48;
/** Сколько соседних строк видно сверху и снизу от выбранной. */
const VISIBLE_NEIGHBOURS = 1;

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

  /**
   * Щелчок — ровно тогда, когда под центром встала ДРУГАЯ строка.
   *
   * Здесь нарочно не вызывается `onChange`: значение по-прежнему уходит наверх
   * только когда колесо остановилось. Иначе каждый кадр прокрутки перезапускал
   * бы поиск (см. WheelSheet), а «черновой выбор» перестал бы быть черновым.
   */
  const tick = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const centred = rowUnderCentre(e.nativeEvent.contentOffset.y);
      if (centred === tickedAt.current) return;
      tickedAt.current = centred;
      hapticSelectionTick();
    },
    [rowUnderCentre],
  );

  const settle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ROW_HEIGHT);
      const picked = options[Math.min(Math.max(next, 0), options.length - 1)];
      if (picked && picked.value !== value) onChange(picked.value);
    },
    [onChange, options, value],
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
            style={styles.row}
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
